"""
Analysis router for video analysis tasks.
"""
import asyncio
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    get_db, require_auth, check_guest_limit
)
from app.models.schemas import (
    AnalysisTaskCreate, AnalysisTaskResponse, AnalysisTaskDetailResponse
)
from app.services.analysis_service import analysis_service
from app.services.queue_service import queue_service
from app.services.progress_service import progress_service
from app.services.bilibili import BilibiliService
from app.services.douyin import DouyinService
from app.utils.validators import validate_url
from app.utils.sse import sse_ping, sse_progress_full, sse_queue_status, sse_completed, sse_error
from app.config import settings


class AIModel(BaseModel):
    """AI Model information."""
    id: str
    name: str
    provider: str
    description: Optional[str] = None


router = APIRouter(prefix="/api/v1/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisTaskResponse)
async def create_analysis(
    request: AnalysisTaskCreate,
    user = Depends(check_guest_limit),
    db: AsyncSession = Depends(get_db)
):
    """
    Submit a video for analysis.

    The video will be added to the queue and processed when resources are available.

    **Authentication**: Required
    **Guest Limit**: Guest users are limited to 10 analyses
    """
    # Validate URL
    is_valid, platform = validate_url(request.url)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="不支持的链接格式。目前仅支持B站和抖音视频链接"
        )

    # Check queue capacity
    is_full = await queue_service.is_full()
    if is_full:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "QUEUE_FULL",
                "message": "当前分析任务过多，请稍后重试",
                "retry_after": 300  # Suggest retry after 5 minutes
            }
        )

    # Resolve video info first
    try:
        if platform == "bilibili":
            video_info = await BilibiliService.resolve(request.url)
        else:  # douyin
            video_info = await DouyinService.resolve(request.url)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"解析视频信息失败: {str(e)}"
        )

    # Resolve use_whisper and whisper_model: request value takes priority, fall back to system config
    use_whisper = request.use_whisper if request.use_whisper is not None else settings.use_whisper
    whisper_model = request.whisper_model if request.whisper_model is not None else settings.whisper_model

    # Create task in database
    task = await analysis_service.create_task(
        db=db,
        user_id=user.id,
        platform=platform,
        video_id=video_info.video_id,
        original_url=request.url,
        title=video_info.title,
        author=video_info.author,
        cover=video_info.cover,
        duration=video_info.duration,
        use_whisper=use_whisper,
        whisper_model=whisper_model
    )

    # Add to queue
    queue_result = await queue_service.add_task(task.id, user.id)

    # Update guest usage count if guest
    if user.is_guest:
        from app.services.user_service import UserService
        await UserService.increment_usage_count(db, user.id)

    # If task can run immediately, start it in background
    if queue_result["status"] == "running":
        from app.services.task_runner import task_runner
        asyncio.create_task(task_runner.run_task(task.id))

    # Return response
    response_data = {
        "task_id": task.id,
        "platform": task.platform,
        "video_id": task.video_id,
        "title": task.title,
        "author": task.author,
        "cover": task.cover,
        "duration": task.duration,
        "status": queue_result["status"],
        "queue_position": queue_result.get("queue_info", {}).get("position", 0),
        "estimated_wait_seconds": queue_result.get("queue_info", {}).get("estimated_wait_seconds", 0),
        "created_at": task.created_at,
    }

    return response_data


@router.get("/{task_id}/progress")
async def get_progress(
    task_id: str,
    request: Request,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Get real-time progress updates via Server-Sent Events (SSE).

    This endpoint streams progress updates as the analysis task runs.
    Events include:
    - `queue`: Task is waiting in queue
    - `progress`: Task progress updates
    - `completed`: Task completed successfully
    - `error`: Task failed with error
    - `ping`: Keep-alive heartbeat every 10 seconds

    **Authentication**: Required
    """
    # Verify task ownership
    task = await analysis_service.get_task(db, task_id, user.id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    async def event_generator():
        """Generate SSE events."""
        last_ping = asyncio.get_event_loop().time()

        # Send immediate ping so the client knows the connection is alive
        yield sse_ping()

        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            # Get latest progress
            progress = await progress_service.get_progress(task_id)

            if progress:
                # Check overall task status (not individual step status)
                if progress.status == "completed":
                    # Send final progress snapshot before completed event
                    progress_dict = await progress_service.get_progress_dict(task_id)
                    yield sse_progress_full(progress_dict)
                    yield sse_completed()
                    break
                elif progress.status == "error":
                    yield sse_error(progress.error or "未知错误")
                    break

                # Send full progress snapshot
                progress_dict = await progress_service.get_progress_dict(task_id)
                yield sse_progress_full(progress_dict)
            else:
                # Task might still be in queue or just starting
                queue_info = await queue_service.get_queue_info(task_id)
                task_info = queue_info.get("task_info")

                if task_info:
                    yield sse_queue_status(
                        position=task_info["position"],
                        estimated_wait_seconds=task_info["estimated_wait_seconds"],
                        message=f"队列中，前面还有 {task_info.get('ahead_count', 0)} 个任务"
                    )
                else:
                    # Task is running but progress not yet initialized - send ping
                    yield sse_ping()

            # Send ping every 10 seconds
            current_time = asyncio.get_event_loop().time()
            if current_time - last_ping >= 10:
                yield sse_ping()
                last_ping = current_time

            # Wait before next update
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@router.get("/{task_id}", response_model=AnalysisTaskDetailResponse)
async def get_analysis(
    task_id: str,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Get analysis task details and results.

    **Authentication**: Required
    """
    task = await analysis_service.get_task(db, task_id, user.id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    return {
        "task_id": task.id,
        "platform": task.platform,
        "video_id": task.video_id,
        "title": task.title,
        "author": task.author,
        "cover": task.cover,
        "duration": task.duration,
        "status": task.status,
        "queue_position": task.queue_position or 0,
        "estimated_wait_seconds": task.estimated_wait_seconds or 0,
        "result": task.result,
        "created_at": task.created_at,
        "started_at": task.started_at,
        "completed_at": task.completed_at,
        "transcript": task.transcript,
    }


@router.post("/{task_id}/regenerate", response_model=AnalysisTaskResponse)
async def regenerate_analysis(
    task_id: str,
    user = Depends(check_guest_limit),
    db: AsyncSession = Depends(get_db)
):
    """
    Regenerate analysis for a completed task.

    This will re-run the AI analysis with a different perspective.

    **Authentication**: Required
    **Guest Limit**: Guest users are limited to 10 analyses
    """
    # Verify task ownership
    task = await analysis_service.get_task(db, task_id, user.id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # Check if task has transcript (required for regeneration)
    if not task.transcript:
        raise HTTPException(
            status_code=400,
            detail="该任务没有字幕数据，无法重新生成"
        )

    # Reset task for regeneration
    task = await analysis_service.regenerate_task(db, task_id, user.id)

    # Add to queue
    queue_result = await queue_service.add_task(task.id, user.id)

    # Increment guest usage if guest
    if user.is_guest:
        from app.services.user_service import UserService
        await UserService.increment_usage_count(db, user.id)

    # Start task if can run immediately
    if queue_result["status"] == "running":
        from app.services.task_runner import task_runner
        asyncio.create_task(task_runner.run_task(task.id, regenerate=True))

    return {
        "task_id": task.id,
        "status": queue_result["status"],
        **queue_result.get("queue_info", {})
    }


@router.get("/{task_id}/status")
async def get_status(
    task_id: str,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current task status (non-SSE, for polling).

    **Authentication**: Required
    """
    task = await analysis_service.get_task(db, task_id, user.id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    progress = await progress_service.get_progress(task_id)
    queue_info = await queue_service.get_queue_info(task_id)

    progress_data = {}
    if progress:
        progress_data = await progress_service.get_progress_dict(task_id)

    return {
        "task_id": task_id,
        "status": task.status,
        "progress": progress_data,
        "queue": queue_info.get("task_info")
    }


@router.get("/models", response_model=List[AIModel])
async def get_models():
    """
    Get available AI models.

    Returns list of supported AI models for analysis.
    """
    models = [
        # 千问
        AIModel(
            id="qwen3.5-plus",
            name="qwen3.5-plus",
            provider="qwen",
            description="文本生成、深度思考、视觉理解"
        ),
        AIModel(
            id="qwen3-max-2026-01-23",
            name="qwen3-max",
            provider="qwen",
            description="文本生成、深度思考"
        ),
        AIModel(
            id="qwen3-coder-next",
            name="qwen3-coder-next",
            provider="qwen",
            description="文本生成"
        ),
        AIModel(
            id="qwen3-coder-plus",
            name="qwen3-coder-plus",
            provider="qwen",
            description="文本生成"
        ),
        # 智谱
        AIModel(
            id="glm-5",
            name="glm-5",
            provider="zhipu",
            description="文本生成、深度思考"
        ),
        AIModel(
            id="glm-4.7",
            name="glm-4.7",
            provider="zhipu",
            description="文本生成、深度思考"
        ),
        # Kimi
        AIModel(
            id="kimi-k2.5",
            name="kimi-k2.5",
            provider="kimi",
            description="文本生成、深度思考、视觉理解"
        ),
        # MiniMax
        AIModel(
            id="MiniMax-M2.5",
            name="MiniMax-M2.5",
            provider="minimax",
            description="文本生成、深度思考"
        ),
    ]
    return models
