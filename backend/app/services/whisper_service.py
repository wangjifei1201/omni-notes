"""
Whisper service for audio transcription.
Supports downloading audio and transcribing with OpenAI Whisper.

Reference: server.js downloadAudio / transcribeAudio
"""
import asyncio
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable

import httpx
from fastapi import HTTPException

# Progress callback type: async function that receives a dict
ProgressCallback = Optional[Callable[[Dict[str, Any]], Any]]


class WhisperService:
    """Service for audio download and transcription using Whisper."""

    # Available Whisper models
    MODELS = ["tiny", "base", "small", "medium", "large"]

    # Regex patterns (compiled once)
    _DOWNLOAD_PROGRESS_RE = re.compile(
        r'\[download\]\s+(\d+\.?\d*)%\s+of\s+([\d.]+\w+)\s+at\s+([\d.]+\w+/s)'
    )
    _PROGRESS_RE = re.compile(r'\[PROGRESS\]\s*(\d+)%')
    _TEXT_RE = re.compile(r'\[TEXT\]\s*(.+)')
    _TIME_RE = re.compile(r'\[TIME\]\s*(\d+:\d+)\s*-->')
    _TQDM_RE = re.compile(r'(\d+)%\|')

    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "omni_notes_audio"
        self.temp_dir.mkdir(exist_ok=True)

    def _get_audio_path(self, task_id: str) -> Path:
        """Get path for temporary audio file."""
        return self.temp_dir / f"{task_id}.mp3"

    def _write_cookies_file(self, cookie_string: str, task_id: str) -> Path:
        """
        Convert raw HTTP Cookie header string to Netscape cookies.txt format.

        Args:
            cookie_string: Raw cookie string like "SESSDATA=xxx; bili_jct=yyy"
            task_id: Task ID for temp file naming

        Returns:
            Path to the cookies file
        """
        cookies_path = self.temp_dir / f"{task_id}_cookies.txt"
        lines = ["# Netscape HTTP Cookie File", "# https://curl.haxx.se/rfc/cookie_spec.html", ""]

        for part in cookie_string.split(";"):
            part = part.strip()
            if not part or "=" not in part:
                continue
            name, _, value = part.partition("=")
            name = name.strip()
            value = value.strip()
            # domain, include_subdomains, path, secure, expiry, name, value
            lines.append(f".bilibili.com\tTRUE\t/\tFALSE\t0\t{name}\t{value}")

        cookies_path.write_text("\n".join(lines), encoding="utf-8")
        return cookies_path

    def _format_timestamp(self, seconds: float) -> str:
        """Format seconds as MM:SS."""
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"

    # ------------------------------------------------------------------
    # Direct download audio (for Douyin where yt-dlp is broken)
    # ------------------------------------------------------------------

    async def download_audio_direct(
        self,
        video_download_url: str,
        task_id: str,
        proxy_url: Optional[str] = None,
        progress_callback: ProgressCallback = None,
    ) -> Path:
        """
        Download video directly via HTTP and extract audio with ffmpeg.

        Used for platforms where yt-dlp doesn't work (e.g., Douyin).

        Args:
            video_download_url: Direct video file URL
            task_id: Task ID for temp file naming
            proxy_url: Optional proxy URL for the download
            progress_callback: Async callback for progress updates

        Returns:
            Path to downloaded mp3 audio file
        """
        output_path = self._get_audio_path(task_id)
        video_path = self.temp_dir / f"{task_id}_video.mp4"

        try:
            # Step 1: Download video file with progress
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 "
                    "Mobile/15E148 Safari/604.1"
                ),
                "Referer": "https://www.iesdouyin.com/",
            }

            client_kwargs = {"timeout": 120.0, "follow_redirects": True}
            if proxy_url:
                client_kwargs["proxy"] = proxy_url
                print(f"[下载] 使用代理直接下载视频")

            async with httpx.AsyncClient(**client_kwargs) as client:
                async with client.stream("GET", video_download_url, headers=headers) as response:
                    response.raise_for_status()
                    total = int(response.headers.get("content-length", 0))
                    downloaded = 0

                    print(f"[下载] 直接下载视频: {total / 1024 / 1024:.1f}MB")

                    with open(video_path, "wb") as f:
                        async for chunk in response.aiter_bytes(chunk_size=65536):
                            f.write(chunk)
                            downloaded += len(chunk)
                            if total > 0 and progress_callback:
                                pct = int(downloaded * 100 / total)
                                await progress_callback({
                                    "percent": min(pct, 99),
                                    "size": f"{total / 1024 / 1024:.1f}MiB",
                                    "speed": "",
                                    "text": f"下载中 {pct}%",
                                })

            if not video_path.exists() or video_path.stat().st_size == 0:
                raise Exception("视频下载失败: 文件为空")

            print(f"[下载] 视频下载完成: {video_path.stat().st_size / 1024 / 1024:.1f}MB")

            # Step 2: Extract audio with ffmpeg
            print("[下载] 使用 ffmpeg 提取音频...")
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y",
                "-i", str(video_path),
                "-vn",                    # no video
                "-acodec", "libmp3lame",
                "-ab", "192k",
                "-ar", "44100",
                str(output_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()

            if proc.returncode != 0:
                err_msg = stderr.decode("utf-8", errors="replace")[-500:]
                raise Exception(f"ffmpeg 音频提取失败: {err_msg}")

            if not output_path.exists() or output_path.stat().st_size == 0:
                raise Exception("ffmpeg 输出文件为空")

            print(f"[下载] 音频提取完成: {output_path.stat().st_size / 1024 / 1024:.1f}MB")

            if progress_callback:
                await progress_callback({"percent": 100, "text": "下载完成"})

            return output_path

        finally:
            # Clean up video file
            if video_path.exists():
                try:
                    video_path.unlink()
                except OSError:
                    pass

    # ------------------------------------------------------------------
    # Download audio with real-time progress (via yt-dlp)
    # ------------------------------------------------------------------

    async def download_audio(
        self,
        video_url: str,
        task_id: str,
        proxy: Optional[str] = None,
        cookie: Optional[str] = None,
        progress_callback: ProgressCallback = None,
    ) -> Path:
        """
        Download audio from video URL using yt-dlp with real-time progress.

        Mirrors server.js downloadAudio: streams yt-dlp stdout line-by-line,
        parses ``[download] XX% of YY at ZZ/s`` and fires progress_callback.

        Args:
            video_url: Video URL
            task_id: Task ID for temp file naming
            proxy: Optional proxy URL
            cookie: Optional raw Bilibili cookie string
            progress_callback: Async callback receiving download progress dict

        Returns:
            Path to downloaded audio file
        """
        output_path = self._get_audio_path(task_id)

        # Build command
        python_exe = sys.executable or "python3"
        cmd = [
            python_exe, "-m", "yt_dlp",
            "-x",                       # extract audio
            "--audio-format", "mp3",
            "--audio-quality", "0",     # best quality
            "-o", str(output_path),
            "--no-playlist",
            "--newline",                # one progress line per update
            "--progress",
            "--retries", "3",
            "--extractor-retries", "3",
            # Bilibili needs proper headers to avoid 412
            "--referer", "https://www.bilibili.com",
            "--user-agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ]

        # Add cookies (critical for Bilibili 412 workaround)
        cookies_path: Optional[Path] = None
        if cookie:
            cookies_path = self._write_cookies_file(cookie, task_id)
            cmd.extend(["--cookies", str(cookies_path)])
            print("[下载] 使用用户配置的 cookie")
        elif "bilibili.com" in video_url or "b23.tv" in video_url or "douyin.com" in video_url:
            # Only try browser cookies if Chrome profile exists (local dev only)
            chrome_path = Path.home() / ".config" / "google-chrome"
            mac_chrome = Path.home() / "Library" / "Application Support" / "Google" / "Chrome"
            if chrome_path.exists() or mac_chrome.exists():
                cmd.extend(["--cookies-from-browser", "chrome"])
                print("[下载] 尝试从浏览器读取 cookie")
            else:
                print("[下载] 未配置 cookie 且无本地浏览器，将直接下载")

        # Add proxy if configured (proxy_url already resolved by caller)
        if proxy:
            cmd.extend(["--proxy", proxy])
            print(f"[下载] 使用代理下载")

        cmd.append(video_url)
        print(f"[下载] 执行命令: {' '.join(cmd[:6])}... {video_url}")

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stderr_chunks: List[str] = []

            async def _collect_stderr():
                while True:
                    line = await proc.stderr.readline()
                    if not line:
                        break
                    text = line.decode("utf-8", errors="replace")
                    stderr_chunks.append(text)

            async def _stream_and_wait():
                stderr_task = asyncio.create_task(_collect_stderr())

                while True:
                    line = await proc.stdout.readline()
                    if not line:
                        break
                    text = line.decode("utf-8", errors="replace").strip()
                    if not text:
                        continue

                    print(f"[下载 stdout] {text}")

                    match = self._DOWNLOAD_PROGRESS_RE.search(text)
                    if match and progress_callback:
                        pct = float(match.group(1))
                        size = match.group(2)
                        speed = match.group(3)
                        await progress_callback({
                            "percent": pct,
                            "size": size,
                            "speed": speed,
                            "text": f"{match.group(1)}% ({size} @ {speed})",
                        })

                await stderr_task
                await proc.wait()

            # 5-minute timeout
            try:
                await asyncio.wait_for(_stream_and_wait(), timeout=300)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                raise HTTPException(status_code=408, detail="下载音频超时 (5分钟)")

            stderr_text = "".join(stderr_chunks)
            if stderr_text:
                print(f"[下载 stderr] {stderr_text[:500]}")

            if proc.returncode != 0:
                error_msg = stderr_text.strip() or "未知错误"
                raise HTTPException(
                    status_code=500,
                    detail=f"下载音频失败: {error_msg[:300]}"
                )

            # yt-dlp might add extension; check for file
            if not output_path.exists():
                mp3_path = output_path.with_suffix('.mp3')
                if mp3_path.exists():
                    return mp3_path
                raise HTTPException(
                    status_code=500,
                    detail="下载完成后找不到音频文件"
                )

            print(f"[下载] 完成: {output_path}")
            return output_path

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"下载音频失败: {str(e)}")
        finally:
            if cookies_path and cookies_path.exists():
                try:
                    cookies_path.unlink()
                except OSError:
                    pass

    # ------------------------------------------------------------------
    # Transcribe with real-time streaming progress (via whisper_stream.py)
    # ------------------------------------------------------------------

    async def transcribe_with_stream(
        self,
        audio_path: Path,
        model: str = "base",
        language: str = "zh",
        progress_callback: ProgressCallback = None,
    ) -> str:
        """
        Transcribe audio using whisper_stream.py subprocess for real-time progress.

        Mirrors server.js transcribeAudio: spawns whisper_stream.py, parses
        [PROGRESS], [TEXT], [TIME] markers from stdout and tqdm from stderr.

        Args:
            audio_path: Path to audio file
            model: Whisper model name
            language: Language code (zh, en, ja, ...)
            progress_callback: Async callback receiving transcribe progress dict

        Returns:
            Formatted transcript with timestamps
        """
        if model not in self.MODELS:
            model = "base"

        python_exe = sys.executable or "python3"
        script_path = Path(__file__).resolve().parent.parent.parent / "scripts" / "whisper_stream.py"

        if not script_path.exists():
            raise HTTPException(
                status_code=500,
                detail=f"找不到 whisper_stream.py: {script_path}"
            )

        lang_map = {"zh": "Chinese", "en": "English", "ja": "Japanese"}
        whisper_lang = lang_map.get(language, language)

        cmd = [
            python_exe,
            str(script_path),
            str(audio_path),
            model,
            str(self.temp_dir),
            whisper_lang,
        ]

        print(f"[转录] 执行命令: {python_exe} whisper_stream.py {audio_path.name} {model}")

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Shared mutable state for cross-task progress tracking
        state = {"percent": 0, "text": "", "time": ""}
        stderr_lines: List[str] = []

        async def _read_stderr():
            """Read stderr in chunks to handle tqdm \\r-delimited output."""
            buf = b""
            while True:
                chunk = await proc.stderr.read(4096)
                if not chunk:
                    break
                buf += chunk
                parts = re.split(rb'[\r\n]+', buf)
                buf = parts[-1]  # keep incomplete tail
                for part in parts[:-1]:
                    line = part.decode("utf-8", errors="replace").strip()
                    if not line:
                        continue
                    stderr_lines.append(line)
                    print(f"[转录 stderr] {line}")
                    # Parse tqdm real progress (e.g. "24%|...")
                    m = self._TQDM_RE.search(line)
                    if m:
                        real_pct = int(m.group(1))
                        if real_pct > state["percent"]:
                            state["percent"] = real_pct
                            if progress_callback:
                                await progress_callback(dict(state))
            # Flush remaining buffer
            if buf:
                line = buf.decode("utf-8", errors="replace").strip()
                if line:
                    stderr_lines.append(line)

        async def _stream_and_wait():
            stderr_task = asyncio.create_task(_read_stderr())

            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                text = line.decode("utf-8", errors="replace").strip()
                if not text:
                    continue

                print(f"[转录] {text}")

                should_notify = False

                pm = self._PROGRESS_RE.search(text)
                if pm:
                    pct = int(pm.group(1))
                    if pct > state["percent"]:
                        state["percent"] = pct
                        should_notify = True

                tm = self._TEXT_RE.search(text)
                if tm and tm.group(1).strip():
                    state["text"] = tm.group(1).strip()
                    should_notify = True

                timem = self._TIME_RE.search(text)
                if timem:
                    state["time"] = timem.group(1)
                    should_notify = True

                if should_notify and progress_callback:
                    await progress_callback(dict(state))

            await stderr_task
            await proc.wait()

        # 10-minute timeout (same as server.js)
        try:
            await asyncio.wait_for(_stream_and_wait(), timeout=600)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            raise HTTPException(status_code=408, detail="语音转文字超时 (10分钟)")

        if proc.returncode != 0:
            error_output = "\n".join(stderr_lines)
            error_msg = f"Whisper 进程退出码 {proc.returncode}"
            if "SSL" in error_output or "CERTIFICATE_VERIFY_FAILED" in error_output:
                error_msg = "SSL 证书验证失败，无法下载 Whisper 模型。"
            elif "urlopen error" in error_output:
                error_msg = "网络连接失败，无法下载 Whisper 模型。"
            elif "No such file" in error_output:
                error_msg = "找不到音频文件或模型文件。"
            elif "[ERROR]" in error_output:
                m = re.search(r'\[ERROR\]\s*(.+)', error_output)
                if m:
                    error_msg = m.group(1).strip()
            if len(error_msg) > 200:
                error_msg = error_msg[:200] + "..."
            raise HTTPException(
                status_code=500,
                detail=f"语音转文字失败: {error_msg}"
            )

        # Read output JSON written by whisper_stream.py
        json_path = self.temp_dir / audio_path.name.replace(".mp3", ".json")
        if not json_path.exists():
            json_path = self.temp_dir / f"{audio_path.stem}.json"

        if not json_path.exists():
            raise HTTPException(
                status_code=500,
                detail="转录完成但找不到结果文件"
            )

        with open(json_path, "r", encoding="utf-8") as f:
            result = json.load(f)

        # Clean up JSON temp file
        try:
            json_path.unlink()
        except OSError:
            pass

        # Format as timestamped text (same format as old transcribe_with_timestamps)
        segments = result.get("segments", [])
        lines = []
        for seg in segments:
            start = self._format_timestamp(seg.get("start", 0))
            text = seg.get("text", "").strip()
            if text:
                lines.append(f"[{start}] {text}")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Combined download + transcribe (entry point for task_runner)
    # ------------------------------------------------------------------

    async def transcribe_video(
        self,
        video_url: str,
        task_id: str,
        model: str = "base",
        language: str = "zh",
        proxy: Optional[str] = None,
        cookie: Optional[str] = None,
        download_progress_callback: ProgressCallback = None,
        transcribe_progress_callback: ProgressCallback = None,
    ) -> str:
        """
        Download and transcribe video in one step with real-time progress.

        Args:
            video_url: Video URL
            task_id: Task ID
            model: Whisper model
            language: Language code
            proxy: Optional proxy URL
            cookie: Optional raw Bilibili cookie string
            download_progress_callback: Callback for download progress
            transcribe_progress_callback: Callback for transcribe progress

        Returns:
            Transcript text with timestamps
        """
        try:
            # Download audio
            audio_path = await self.download_audio(
                video_url, task_id,
                proxy=proxy,
                cookie=cookie,
                progress_callback=download_progress_callback,
            )

            # Transcribe with streaming progress
            transcript = await self.transcribe_with_stream(
                audio_path, model, language,
                progress_callback=transcribe_progress_callback,
            )

            return transcript

        finally:
            # Clean up audio file
            await self.cleanup(task_id)

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    async def cleanup(self, task_id: str) -> bool:
        """
        Clean up temporary audio file.

        Args:
            task_id: Task ID

        Returns:
            True if file was deleted or doesn't exist
        """
        audio_path = self._get_audio_path(task_id)

        try:
            if audio_path.exists():
                audio_path.unlink()
            # Also clean up related files
            for ext in ['.mp3', '.wav', '.m4a', '.webm']:
                related = audio_path.with_suffix(ext)
                if related.exists():
                    related.unlink()
            return True
        except Exception:
            return False


# Global whisper service instance
whisper_service = WhisperService()
