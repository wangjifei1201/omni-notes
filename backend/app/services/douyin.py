"""
Douyin video parsing service.

Uses iesdouyin.com/share/video/ as primary data source,
which returns _ROUTER_DATA with full video info (unlike douyin.com
which returns JS VM protection shell).
"""
import json
import re
from typing import Optional, Dict, Any

import httpx
from fastapi import HTTPException

from app.models.schemas import VideoInfo


class DouyinService:
    """Service for parsing Douyin video URLs."""

    # Headers for iesdouyin.com requests
    MOBILE_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 "
            "Mobile/15E148 Safari/604.1"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Referer": "https://www.douyin.com/",
    }

    DESKTOP_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://www.douyin.com/",
    }

    @staticmethod
    def is_douyin_url(url: str) -> bool:
        """
        Check if URL is a Douyin video URL.

        Args:
            url: URL to check

        Returns:
            True if Douyin URL
        """
        patterns = [
            r'^https?://(www\.)?douyin\.com/video/\d+',
            r'^https?://(www\.)?douyin\.com/.*[?&]modal_id=\d+',
            r'^https?://(www\.)?douyin\.com/note/\d+',
            r'^https?://v\.douyin\.com/[a-zA-Z0-9]+',
            r'^https?://(www\.)?iesdouyin\.com/share/video/\d+',
        ]
        return any(re.match(pattern, url, re.IGNORECASE) for pattern in patterns)

    @staticmethod
    def is_short_url(url: str) -> bool:
        """
        Check if URL is a Douyin short URL (v.douyin.com).

        Args:
            url: URL to check

        Returns:
            True if short URL
        """
        return 'v.douyin.com' in url.lower()

    @staticmethod
    async def resolve_short_url(short_url: str) -> str:
        """
        Resolve Douyin short URL to full URL.

        Args:
            short_url: Short URL (e.g., https://v.douyin.com/xxxxx)

        Returns:
            Full video URL

        Raises:
            HTTPException: If URL cannot be resolved
        """
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
                # Try HEAD first
                try:
                    response = await client.head(
                        short_url,
                        headers=DouyinService.MOBILE_HEADERS
                    )
                    if response.status_code in (200, 301, 302, 307, 308):
                        return str(response.url)
                except httpx.HTTPStatusError:
                    pass

                # Try GET if HEAD fails
                response = await client.get(
                    short_url,
                    headers=DouyinService.MOBILE_HEADERS
                )
                return str(response.url)

        except httpx.TimeoutException:
            raise HTTPException(status_code=408, detail="解析抖音短链超时")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"无法解析抖音短链: {str(e)}")

    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        """
        Extract video ID from Douyin URL.

        Args:
            url: Douyin video URL

        Returns:
            Video ID string, or None
        """
        # Match /video/1234567890 pattern
        match = re.search(r'/video/(\d+)', url)
        if match:
            return match.group(1)

        # Match /share/video/1234567890 pattern
        match = re.search(r'/share/video/(\d+)', url)
        if match:
            return match.group(1)

        # Match /note/1234567890 pattern
        match = re.search(r'/note/(\d+)', url)
        if match:
            return match.group(1)

        # Match modal_id query parameter (e.g. ?modal_id=7596262124284890411)
        match = re.search(r'[?&]modal_id=(\d+)', url)
        if match:
            return match.group(1)

        return None

    @staticmethod
    def _build_iesdouyin_url(video_id: str) -> str:
        """Build iesdouyin.com share URL for given video ID."""
        return f"https://www.iesdouyin.com/share/video/{video_id}/"

    @staticmethod
    async def _fetch_page(url: str) -> str:
        """
        Fetch a page with retry using different header sets.

        Returns:
            HTML content

        Raises:
            HTTPException: If page cannot be fetched
        """
        headers_list = [DouyinService.MOBILE_HEADERS, DouyinService.DESKTOP_HEADERS]

        for headers in headers_list:
            try:
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                    response = await client.get(url, headers=headers)
                    response.raise_for_status()
                    return response.text

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 403:
                    continue
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"获取视频页面失败: {e.response.status_code}"
                )
            except httpx.TimeoutException:
                raise HTTPException(status_code=408, detail="获取视频页面超时")

        raise HTTPException(status_code=403, detail="无法获取视频信息，可能需要Cookie或遇到反爬虫")

    @staticmethod
    def _parse_router_data(html: str) -> Optional[Dict[str, Any]]:
        """
        Parse window._ROUTER_DATA from iesdouyin.com HTML.

        Returns:
            Parsed _ROUTER_DATA dict or None
        """
        pattern = r'window\._ROUTER_DATA\s*=\s*(\{.+?\})\s*</script>'
        match = re.search(pattern, html, re.DOTALL)
        if not match:
            return None

        try:
            data_str = match.group(1).strip()
            if data_str.endswith(';'):
                data_str = data_str[:-1]
            return json.loads(data_str)
        except (json.JSONDecodeError, IndexError):
            return None

    @staticmethod
    def _extract_from_router_data(router_data: Dict[str, Any], video_id: str) -> Optional[Dict[str, Any]]:
        """
        Extract video info from _ROUTER_DATA.

        Data path: loaderData["video_(id)/page"].videoInfoRes.item_list[0]
        """
        try:
            loader_data = router_data.get("loaderData", {})

            # The key format is "video_(id)/page"
            page_key = f"video_({video_id})/page"
            page_data = loader_data.get(page_key)

            # Primary: the key is literally "video_(id)/page"
            if not page_data:
                page_data = loader_data.get("video_(id)/page")

            # Fallback: search for any key matching video_*/page pattern
            if not page_data:
                for key, value in loader_data.items():
                    if key.startswith("video_") and key.endswith("/page"):
                        page_data = value
                        break

            if not page_data:
                return None

            video_info_res = page_data.get("videoInfoRes", {})
            item_list = video_info_res.get("item_list", [])
            if not item_list:
                return None

            item = item_list[0]
            author = item.get("author", {})
            video = item.get("video", {})

            # Duration is in milliseconds, convert to seconds
            duration_ms = video.get("duration", 0)
            duration_sec = duration_ms // 1000 if duration_ms > 0 else 0

            # Cover: prefer url_list first item
            cover_info = video.get("cover", {})
            cover_urls = cover_info.get("url_list", [])
            cover = cover_urls[0] if cover_urls else ""

            return {
                "title": item.get("desc", ""),
                "author": author.get("nickname", ""),
                "author_id": author.get("short_id", "") or str(author.get("uid", "")),
                "duration": duration_sec,
                "cover": cover,
                "desc": item.get("desc", ""),
            }
        except Exception as e:
            print(f"[抖音] 从 _ROUTER_DATA 提取信息失败: {e}")
            return None

    @staticmethod
    def _extract_from_html_meta(html: str) -> Optional[Dict[str, Any]]:
        """
        Fallback: extract video info from HTML meta tags.
        """
        info = {}

        title_match = re.search(r'<meta[^>]*property="og:title"[^>]*content="([^"]+)"', html, re.IGNORECASE)
        if title_match:
            info['title'] = title_match.group(1)
        else:
            title_match = re.search(r'<meta[^>]*name="description"[^>]*content="([^"]+)"', html, re.IGNORECASE)
            if title_match:
                info['desc'] = title_match.group(1)

        image_match = re.search(r'<meta[^>]*property="og:image"[^>]*content="([^"]+)"', html, re.IGNORECASE)
        if image_match:
            info['cover'] = image_match.group(1)

        author_match = re.search(r'"nickname"[:\s]*"([^"]+)"', html)
        if author_match:
            info['author'] = author_match.group(1)

        return info if info else None

    @staticmethod
    async def get_video_download_url(video_id: str) -> Optional[str]:
        """
        Get direct video download URL from iesdouyin.com _ROUTER_DATA.

        Returns:
            Direct video URL (play_addr) or None
        """
        try:
            ies_url = DouyinService._build_iesdouyin_url(video_id)
            html = await DouyinService._fetch_page(ies_url)
            router_data = DouyinService._parse_router_data(html)
            if not router_data:
                return None

            loader_data = router_data.get("loaderData", {})
            page_data = loader_data.get("video_(id)/page")
            if not page_data:
                for key, value in loader_data.items():
                    if key.startswith("video_") and key.endswith("/page"):
                        page_data = value
                        break
            if not page_data:
                return None

            item_list = page_data.get("videoInfoRes", {}).get("item_list", [])
            if not item_list:
                return None

            play_addr = item_list[0].get("video", {}).get("play_addr", {})
            url_list = play_addr.get("url_list", [])
            return url_list[0] if url_list else None
        except Exception as e:
            print(f"[抖音] 获取视频下载地址失败: {e}")
            return None

    @staticmethod
    async def resolve(url: str) -> VideoInfo:
        """
        Resolve Douyin URL to video information.

        Strategy:
        1. Extract video ID from any supported URL format
        2. Fetch from iesdouyin.com/share/video/{id}/ (primary, returns _ROUTER_DATA)
        3. Parse _ROUTER_DATA for video info
        4. Fallback to HTML meta tags if _ROUTER_DATA parsing fails
        """
        original_url = url

        # Step 1: Resolve short URL if needed
        if DouyinService.is_short_url(url):
            url = await DouyinService.resolve_short_url(url)

        # Step 2: Extract video ID
        video_id = DouyinService.extract_video_id(url)
        if not video_id:
            raise HTTPException(status_code=400, detail="无法从URL中提取视频ID")

        print(f"[抖音] 视频ID: {video_id}, 来源: {original_url}")

        # Step 3: Fetch from iesdouyin.com (primary data source)
        ies_url = DouyinService._build_iesdouyin_url(video_id)
        print(f"[抖音] 请求: {ies_url}")

        html = await DouyinService._fetch_page(ies_url)

        # Step 4: Parse _ROUTER_DATA (primary method)
        video_info = None
        router_data = DouyinService._parse_router_data(html)
        if router_data:
            video_info = DouyinService._extract_from_router_data(router_data, video_id)
            if video_info:
                print(f"[抖音] 从 _ROUTER_DATA 解析成功: {video_info.get('title', '')[:30]}")

        # Step 5: Fallback to meta tags
        if not video_info or not video_info.get('title'):
            print("[抖音] _ROUTER_DATA 解析失败，尝试 meta 标签")
            meta_info = DouyinService._extract_from_html_meta(html)
            if meta_info:
                if video_info:
                    for k, v in meta_info.items():
                        if not video_info.get(k):
                            video_info[k] = v
                else:
                    video_info = meta_info

        # Validate minimum info
        if not video_info or (not video_info.get('title') and not video_info.get('desc')):
            raise HTTPException(status_code=400, detail="无法解析抖音视频信息，视频可能不存在或已被删除")

        title = video_info.get('title', '') or video_info.get('desc', '')
        desc = video_info.get('desc', '') or video_info.get('title', '')

        return VideoInfo(
            platform="douyin",
            video_id=video_id,
            title=title,
            author=video_info.get('author', ''),
            author_id=video_info.get('author_id', ''),
            duration=video_info.get('duration', 0),
            cover=video_info.get('cover', ''),
            original_url=original_url,
            desc=desc
        )
