"""
Task runner for executing analysis tasks in the background.
Coordinates video download, transcription, and AI analysis.

Mirrors server.js processAnalysis: step transitions + real-time
download/transcribe progress via progress_service.
"""
import asyncio
import time
from datetime import datetime
from typing import Optional, Set, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.analysis import AnalysisTask
from app.services.analysis_service import analysis_service
from app.services.queue_service import queue_service
from app.services.progress_service import progress_service
from app.services.whisper_service import whisper_service
from app.services.ai_service import ai_service
from app.services.config_service import config_service
from app.services.transcript_cache import transcript_cache
from app.services.douyin import DouyinService
from app.utils.proxy import resolve_proxy_url


class TaskRunner:
    """Background task runner for video analysis."""

    def __init__(self):
        self._running_tasks: Set[str] = set()
        self._lock = asyncio.Lock()

    async def run_task(self, task_id: str, regenerate: bool = False) -> None:
        """
        Run an analysis task.

        Args:
            task_id: Task ID
            regenerate: Whether this is a regeneration
        """
        async with self._lock:
            if task_id in self._running_tasks:
                return
            self._running_tasks.add(task_id)

        start_time = time.time()

        try:
            # Initialize multi-step progress
            await progress_service.init_progress(task_id)

            # Create database session
            async with AsyncSessionLocal() as db:
                # Get task
                task = await analysis_service.get_task(db, task_id)
                if not task:
                    return

                # Update status to running
                await analysis_service.update_task_status(db, task_id, "running")

                # Run analysis pipeline
                await self._run_analysis_pipeline(db, task, regenerate)

        except Exception as e:
            # Update status to failed
            async with AsyncSessionLocal() as db:
                await analysis_service.update_task_status(
                    db, task_id, "failed", str(e)
                )
            await progress_service.update_step(task_id, "analyze", "error")
            await progress_service.mark_error(task_id, f"分析失败: {str(e)}")

        finally:
            # Remove from running tasks
            async with self._lock:
                self._running_tasks.discard(task_id)

            # Complete task in queue and start next
            duration = time.time() - start_time
            next_task_id = await queue_service.complete_task(task_id, duration)

            # Start next task if available
            if next_task_id:
                asyncio.create_task(self.run_task(next_task_id))

    async def _run_analysis_pipeline(
        self,
        db: AsyncSession,
        task: AnalysisTask,
        regenerate: bool
    ) -> None:
        """
        Run the analysis pipeline:
        - If video has subtitles: extract -> analyze
        - If no subtitles: extract -> download -> transcribe -> analyze

        Args:
            db: Database session
            task: Analysis task
            regenerate: Whether this is a regeneration
        """
        task_id = task.id
        transcript = task.transcript

        # Step 1: Extract (already done during task creation)
        await progress_service.update_step(task_id, "extract", "running")
        await progress_service.update_step(task_id, "extract", "completed")

        # Check if we need to download and transcribe
        has_subtitles = transcript and len(transcript.strip()) > 0

        if not regenerate or not transcript:
            if has_subtitles:
                # Video has subtitles from API - skip download and transcribe
                await progress_service.update_step(task_id, "download", "skipped")
                await progress_service.update_step(task_id, "transcribe", "skipped")
                # Also cache API subtitles for future use
                transcript_cache.save(task.platform, task.video_id, transcript)
            elif task.use_whisper:
                # Check local transcript cache first
                cached = transcript_cache.get(task.platform, task.video_id)
                if cached:
                    # Cache hit - skip download and transcribe
                    print(f"[任务] 使用缓存的转录结果: {task.platform}/{task.video_id}")
                    await progress_service.update_step(task_id, "download", "skipped")
                    await progress_service.update_step(task_id, "transcribe", "skipped")
                    await analysis_service.update_transcript(db, task_id, cached)
                    task = await analysis_service.get_task(db, task_id)
                    transcript = task.transcript
                else:
                    # No cache - need to download and transcribe
                    await self._download_and_transcribe(db, task)
                    task = await analysis_service.get_task(db, task_id)
                    transcript = task.transcript
            else:
                # No subtitles and whisper disabled
                raise Exception("视频无字幕且未启用语音识别")

        # Step 4: AI Analysis
        if transcript:
            await self._analyze_content(db, task, transcript, regenerate)
        else:
            raise Exception("没有可用的字幕数据进行分析")

    async def _download_and_transcribe(
        self,
        db: AsyncSession,
        task: AnalysisTask
    ) -> None:
        """
        Download audio and transcribe with Whisper.
        Wires real-time progress callbacks to progress_service.

        Mirrors server.js processAnalysis proxy logic:
        1. Resolve proxy URL (private API -> build auth URL, or direct URL)
        2. Pass proxy to download service (yt-dlp --proxy or httpx proxy)

        Args:
            db: Database session
            task: Analysis task
        """
        task_id = task.id
        video_url = task.original_url

        # Normalize URLs so yt-dlp can recognize the platform
        if task.platform == "bilibili" and task.video_id and "bilibili.com/video/" not in video_url:
            video_url = f"https://www.bilibili.com/video/{task.video_id}"
            print(f"[下载] B站 URL 规范化: {task.original_url} -> {video_url}")
        elif task.platform == "douyin" and task.video_id and "/video/" not in video_url:
            video_url = f"https://www.douyin.com/video/{task.video_id}"
            print(f"[下载] 抖音 URL 规范化: {task.original_url} -> {video_url}")

        # --- Resolve proxy (private API / direct / none) ---
        proxy_url = None
        try:
            proxy_url = await resolve_proxy_url()
        except Exception as e:
            print(f"[下载] 代理解析失败，将直连下载: {e}")

        # --- Download step ---
        await progress_service.update_step(task_id, "download", "running")

        # Look up user's Bilibili cookie from database
        bilibili_cookie = None
        if task.user_id and task.platform == "bilibili":
            try:
                bilibili_cookie = await config_service.get_cookie(
                    db, task.user_id, "bilibili"
                )
                if bilibili_cookie:
                    print(f"[下载] 已获取用户 Bilibili cookie")
            except Exception as e:
                print(f"[下载] 获取 cookie 失败: {e}，将继续不使用 cookie")

        # Progress callbacks that update progress_service
        async def on_download_progress(data: Dict[str, Any]) -> None:
            await progress_service.update_download_progress(
                task_id,
                percent=data.get("percent", 0),
                size=data.get("size"),
                speed=data.get("speed"),
                text=data.get("text"),
            )

        async def on_transcribe_progress(data: Dict[str, Any]) -> None:
            await progress_service.update_transcribe_live(
                task_id,
                percent=data.get("percent", 0),
                time_str=data.get("time"),
                text=data.get("text"),
            )

        try:
            # Download audio: Douyin uses direct download, others use yt-dlp
            if task.platform == "douyin":
                # yt-dlp Douyin extractor is broken, use direct download
                download_url = await DouyinService.get_video_download_url(
                    task.video_id, proxy_url
                )
                if not download_url:
                    raise Exception("无法获取抖音视频下载地址")
                print(f"[下载] 抖音直接下载: {download_url[:80]}...")
                audio_path = await whisper_service.download_audio_direct(
                    video_download_url=download_url,
                    task_id=task_id,
                    proxy_url=proxy_url,
                    progress_callback=on_download_progress,
                )
            else:
                audio_path = await whisper_service.download_audio(
                    video_url=video_url,
                    task_id=task_id,
                    proxy=proxy_url,
                    cookie=bilibili_cookie,
                    progress_callback=on_download_progress,
                )
            await progress_service.update_step(task_id, "download", "completed")

            # --- Transcribe step ---
            await progress_service.update_step(task_id, "transcribe", "running")

            transcript = await whisper_service.transcribe_with_stream(
                audio_path=audio_path,
                model=task.whisper_model or "base",
                language="zh",
                progress_callback=on_transcribe_progress,
            )
            await progress_service.update_step(task_id, "transcribe", "completed")

            # Save transcript
            await analysis_service.update_transcript(db, task_id, transcript)

            # Save to local cache for future re-analysis
            transcript_cache.save(task.platform, task.video_id, transcript)

        except Exception as e:
            # Determine which step failed based on current state
            prog = await progress_service.get_progress(task_id)
            if prog and prog.steps.get("download") and prog.steps["download"].status == "running":
                await progress_service.update_step(task_id, "download", "error")
            else:
                await progress_service.update_step(task_id, "transcribe", "error")
            raise
        finally:
            # Clean up audio file
            await whisper_service.cleanup(task_id)

    async def _analyze_content(
        self,
        db: AsyncSession,
        task: AnalysisTask,
        transcript: str,
        regenerate: bool
    ) -> None:
        """
        Analyze content with AI.

        Args:
            db: Database session
            task: Analysis task
            transcript: Transcript text
            regenerate: Whether this is a regeneration
        """
        task_id = task.id

        # Update progress
        await progress_service.update_step(task_id, "analyze", "running")

        try:
            # Call AI service
            if regenerate:
                result = await ai_service.regenerate(transcript)
            else:
                result = await ai_service.analyze(transcript)

            # Convert result to AnalysisResult
            from app.models.schemas import AnalysisResult

            analysis_result = AnalysisResult(
                summary=result.get("summary", ""),
                key_points=result.get("key_points", []),
                chapters=result.get("chapters", []),
                mindmap=result.get("mindmap", {})
            )

            # Save result
            await analysis_service.update_task_result(
                db, task_id, analysis_result, transcript
            )

            await progress_service.update_step(task_id, "analyze", "completed")
            await progress_service.mark_completed(task_id)

        except Exception as e:
            await progress_service.update_step(task_id, "analyze", "error")
            raise

    def is_task_running(self, task_id: str) -> bool:
        """Check if a task is currently running."""
        return task_id in self._running_tasks


# Global task runner instance
task_runner = TaskRunner()
