"""
Bilibili video parsing service.
"""
import re
from typing import Optional, Dict, Any
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import HTTPException

from app.models.schemas import VideoInfo


class BilibiliService:
    """Service for parsing Bilibili video URLs."""

    # Common headers for Bilibili requests
    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://www.bilibili.com/",
    }

    # API endpoints
    API_VIDEO_INFO = "https://api.bilibili.com/x/web-interface/view"
    API_SHORT_URL = "https://b23.tv/"

    @staticmethod
    def is_bilibili_url(url: str) -> bool:
        """
        Check if URL is a Bilibili video URL.

        Args:
            url: URL to check

        Returns:
            True if Bilibili URL
        """
        patterns = [
            r'^https?://(www\.)?bilibili\.com/video/[Bb][Vv][a-zA-Z0-9]+',
            r'^https?://(www\.)?bilibili\.com/video/[Aa][Vv]\d+',
            r'^https?://b23\.tv/[a-zA-Z0-9]+',
        ]
        return any(re.match(pattern, url, re.IGNORECASE) for pattern in patterns)

    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        """
        Extract BV or AV ID from URL.

        Args:
            url: Bilibili video URL

        Returns:
            BVxxxxx or AVxxxxx string, or None
        """
        # Match BV ID (case insensitive)
        bv_match = re.search(r'/(?:BV|bv|Bv|bV)([a-zA-Z0-9]+)', url)
        if bv_match:
            return f"BV{bv_match.group(1)}"

        # Match AV ID (case insensitive)
        av_match = re.search(r'/(?:AV|av|Av|aV)(\d+)', url)
        if av_match:
            return f"AV{av_match.group(1)}"

        return None

    @staticmethod
    def is_short_url(url: str) -> bool:
        """
        Check if URL is a Bilibili short URL (b23.tv).

        Args:
            url: URL to check

        Returns:
            True if short URL
        """
        return 'b23.tv' in url or 'bilibili.com' in url and len(url) < 50

    @staticmethod
    async def resolve_short_url(short_url: str, cookie: Optional[str] = None, proxy_url: Optional[str] = None) -> str:
        """
        Resolve Bilibili short URL to full URL.

        Args:
            short_url: Short URL (e.g., https://b23.tv/xxxxx)
            cookie: Optional Bilibili cookie
            proxy_url: Optional proxy URL for the request

        Returns:
            Full video URL

        Raises:
            HTTPException: If URL cannot be resolved
        """
        headers = BilibiliService.HEADERS.copy()
        if cookie:
            headers["Cookie"] = cookie

        client_kwargs: Dict[str, Any] = {"follow_redirects": True, "timeout": 10.0}
        if proxy_url:
            client_kwargs["proxy"] = proxy_url

        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                response = await client.head(short_url, headers=headers)

                # Get final URL after redirects
                final_url = str(response.url)

                # Check if we got a valid video URL
                if 'bilibili.com/video' in final_url:
                    return final_url

                # If HEAD didn't work, try GET
                if response.status_code in (301, 302, 307, 308):
                    response = await client.get(short_url, headers=headers)
                    final_url = str(response.url)

                return final_url

        except httpx.TimeoutException:
            raise HTTPException(status_code=408, detail="解析短链超时，请稍后重试")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"无法解析短链: {str(e)}")

    @staticmethod
    async def get_video_info(
        video_id: str,
        cookie: Optional[str] = None,
        proxy_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get video information from Bilibili API.

        Args:
            video_id: BV or AV ID
            cookie: Optional Bilibili cookie for restricted videos
            proxy_url: Optional proxy URL for the request

        Returns:
            Video information dictionary

        Raises:
            HTTPException: If video info cannot be retrieved
        """
        headers = BilibiliService.HEADERS.copy()
        if cookie:
            headers["Cookie"] = cookie

        # Prepare params based on ID type
        params = {}
        if video_id.startswith(('BV', 'bv', 'Bv', 'bV')):
            params['bvid'] = video_id
        elif video_id.startswith(('AV', 'av', 'Av', 'aV')):
            params['aid'] = video_id[2:]
        else:
            raise HTTPException(status_code=400, detail=f"无效的视频ID格式: {video_id}")

        client_kwargs: Dict[str, Any] = {"timeout": 15.0}
        if proxy_url:
            client_kwargs["proxy"] = proxy_url
            print(f"[B站] 使用隧道代理获取视频信息")

        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                response = await client.get(
                    BilibiliService.API_VIDEO_INFO,
                    params=params,
                    headers=headers
                )
                response.raise_for_status()
                data = response.json()

                if data.get('code') != 0:
                    error_msg = data.get('message', '获取视频信息失败')
                    if data.get('code') == -403:
                        raise HTTPException(status_code=403, detail="该视频需要登录或Cookie才能访问")
                    elif data.get('code') == -404:
                        raise HTTPException(status_code=404, detail="视频不存在或已被删除")
                    else:
                        raise HTTPException(status_code=400, detail=error_msg)

                return data['data']

        except httpx.TimeoutException:
            raise HTTPException(status_code=408, detail="获取视频信息超时")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"获取视频信息失败: {str(e)}")

    @staticmethod
    def format_duration(seconds: int) -> str:
        """
        Format duration in seconds to human-readable string.

        Args:
            seconds: Duration in seconds

        Returns:
            Formatted string like "12:34" or "1:23:45"
        """
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60

        if hours > 0:
            return f"{hours}:{minutes:02d}:{secs:02d}"
        return f"{minutes}:{secs:02d}"

    @staticmethod
    async def resolve(
        url: str,
        cookie: Optional[str] = None,
        proxy_url: Optional[str] = None,
    ) -> VideoInfo:
        """
        Resolve Bilibili URL to video information.

        This is the main entry point for Bilibili video resolution.

        Args:
            url: Bilibili video URL (short or full)
            cookie: Optional Bilibili cookie
            proxy_url: Optional proxy URL for API requests (tunnel proxy)

        Returns:
            VideoInfo object

        Raises:
            HTTPException: If URL cannot be resolved
        """
        original_url = url

        # Step 1: Resolve short URL if needed
        if BilibiliService.is_short_url(url):
            url = await BilibiliService.resolve_short_url(url, cookie, proxy_url)

        # Step 2: Extract video ID
        video_id = BilibiliService.extract_video_id(url)
        if not video_id:
            raise HTTPException(status_code=400, detail="无法从URL中提取视频ID")

        # Step 3: Get video info from API
        info = await BilibiliService.get_video_info(video_id, cookie, proxy_url)

        # Step 4: Format response
        owner = info.get('owner', {})
        stat = info.get('stat', {})

        return VideoInfo(
            platform="bilibili",
            video_id=video_id,
            title=info.get('title', ''),
            author=owner.get('name', ''),
            author_id=str(owner.get('mid', '')),
            duration=info.get('duration', 0),
            cover=info.get('pic', ''),
            original_url=original_url,
            desc=info.get('desc', '')
        )
