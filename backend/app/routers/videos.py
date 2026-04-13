"""
Video resolution router for parsing video URLs from various platforms.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user, require_auth
from app.models.schemas import VideoInfo, VideoResolveRequest
from app.services.bilibili import BilibiliService
from app.services.douyin import DouyinService
from app.services.user_service import UserService
from app.utils.crypto import decrypt_data
from app.utils.validators import validate_url, extract_url
from app.utils.proxy import resolve_proxy_url


router = APIRouter(prefix="/api/v1/videos", tags=["videos"])


@router.get("/bilibili-short", response_model=VideoInfo)
async def resolve_bilibili(
    url: str = Query(..., description="Bilibili video URL (short or full)"),
    user = Depends(require_auth),
    db = Depends(get_db)
):
    """
    Resolve Bilibili video URL to video information.

    Supports:
    - Short URLs: https://b23.tv/xxxxx
    - Full URLs: https://www.bilibili.com/video/BVxxxxx
    - AV URLs: https://www.bilibili.com/video/AVxxxxx

    **Authentication**: Required (registered user or guest)
    """
    # Validate URL format
    is_valid, platform = validate_url(url)
    if not is_valid or platform != 'bilibili':
        raise HTTPException(
            status_code=400,
            detail="无效的B站视频链接，请检查链接格式"
        )

    # Get user's Bilibili cookie if available
    cookie = None
    user_cookies = await db.execute(
        text("""
        SELECT cookie_encrypted FROM user_cookies
        WHERE user_id = :user_id AND platform = 'bilibili'
        ORDER BY updated_at DESC LIMIT 1
        """),
        {"user_id": str(user.id)}
    )
    cookie_row = user_cookies.fetchone()
    if cookie_row:
        try:
            cookie = decrypt_data(cookie_row[0])
        except Exception:
            pass  # Ignore decryption errors

    # Resolve proxy for tunnel (API requests)
    proxy_url = None
    try:
        proxy_url = await resolve_proxy_url()
    except Exception:
        pass

    # Resolve URL
    try:
        video_info = await BilibiliService.resolve(url, cookie, proxy_url)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"解析视频失败: {str(e)}"
        )

    return video_info


@router.get("/douyin", response_model=VideoInfo)
async def resolve_douyin(
    url: str = Query(..., description="Douyin video URL (short or full)"),
    user = Depends(require_auth),
    db = Depends(get_db)
):
    """
    Resolve Douyin video URL to video information.

    Supports:
    - Short URLs: https://v.douyin.com/xxxxx
    - Full URLs: https://www.douyin.com/video/1234567890

    **Authentication**: Required (registered user or guest)
    **Note**: Douyin resolution may be affected by anti-scraping measures.
    """
    # Validate URL format
    is_valid, platform = validate_url(url)
    if not is_valid or platform != 'douyin':
        raise HTTPException(
            status_code=400,
            detail="无效的抖音视频链接，请检查链接格式"
        )

    # Resolve proxy for tunnel (API requests)
    proxy_url = None
    try:
        proxy_url = await resolve_proxy_url()
    except Exception:
        pass

    # Resolve URL
    try:
        video_info = await DouyinService.resolve(url, proxy_url)
    except HTTPException as e:
        # Provide more specific error messages for common issues
        if e.status_code == 403:
            raise HTTPException(
                status_code=403,
                detail="无法访问抖音视频，可能遇到反爬虫限制，请稍后重试"
            )
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"解析视频失败: {str(e)}"
        )

    return video_info


@router.post("/parse", response_model=VideoInfo)
async def resolve_parse(
    request: VideoResolveRequest,
    user = Depends(require_auth),
    db = Depends(get_db)
):
    """
    Parse video URL and return video information.

    This is the main endpoint used by the frontend for video parsing.
    """
    return await resolve_auto(request, user, db)


@router.post("/auto", response_model=VideoInfo)
async def resolve_auto(
    request: VideoResolveRequest,
    user = Depends(require_auth),
    db = Depends(get_db)
):
    """
    Auto-detect platform and resolve video URL.

    Automatically detects whether the URL is Bilibili or Douyin
    and routes to the appropriate resolver.

    **Authentication**: Required (registered user or guest)
    """
    url = extract_url(request.url)

    # Validate URL format
    is_valid, platform = validate_url(url)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="不支持的链接格式。目前仅支持B站和抖音视频链接"
        )

    # Route to appropriate service
    if platform == 'bilibili':
        return await resolve_bilibili(url, user, db)
    elif platform == 'douyin':
        return await resolve_douyin(url, user, db)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的平台: {platform}"
        )


@router.get("/{video_id}", response_model=VideoInfo)
async def get_video(
    video_id: str,
    user = Depends(require_auth),
):
    """
    Get video information by ID.

    Note: Video info is obtained during analysis task creation.
    This endpoint returns basic info for the video ID.
    """
    # Since videos are not stored persistently, we return a placeholder
    # In a full implementation, videos would be stored in the database
    raise HTTPException(
        status_code=501,
        detail="视频详情获取暂未实现，请通过分析任务获取视频信息"
    )


@router.get("/{video_id}/subtitles")
async def get_video_subtitles(
    video_id: str,
    user = Depends(require_auth),
):
    """
    Get video subtitles.

    Note: Subtitles are obtained during video parsing.
    This endpoint would return stored subtitles for a video.
    """
    # Subtitles are not stored separately in current implementation
    raise HTTPException(
        status_code=501,
        detail="字幕获取功能暂未实现，请通过视频解析获取字幕"
    )
