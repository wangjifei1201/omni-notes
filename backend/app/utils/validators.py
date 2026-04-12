"""
Validation utilities.
"""
import re
from typing import Optional, Tuple
from urllib.parse import urlparse


# URL patterns for supported platforms
BILIBILI_PATTERNS = [
    r'^https?://(www\.)?bilibili\.com/video/[Bb][Vv][a-zA-Z0-9]+',
    r'^https?://(www\.)?bilibili\.com/video/[Aa][Vv]\d+',
    r'^https?://b23\.tv/[a-zA-Z0-9]+',
]

DOUYIN_PATTERNS = [
    r'^https?://(www\.)?douyin\.com/video/\d+',
    r'^https?://(www\.)?douyin\.com/.*[?&]modal_id=\d+',
    r'^https?://(www\.)?douyin\.com/note/\d+',
    r'^https?://v\.douyin\.com/[a-zA-Z0-9]+',
    r'^https?://(www\.)?iesdouyin\.com/share/video/\d+',
]


def validate_url(url: str) -> Tuple[bool, Optional[str]]:
    """
    Validate if URL is a supported video URL.

    Automatically extracts the first URL from text that may contain
    surrounding text (e.g. mobile share format: 【标题】 https://b23.tv/xxx).

    Args:
        url: URL string or text containing a URL

    Returns:
        Tuple of (is_valid, platform)
        platform is None if URL is not supported
    """
    if not url:
        return False, None

    # Extract URL from text if it doesn't start with http
    url = extract_url(url)
    if not url:
        return False, None

    # Check Bilibili patterns
    for pattern in BILIBILI_PATTERNS:
        if re.match(pattern, url, re.IGNORECASE):
            return True, 'bilibili'

    # Check Douyin patterns
    for pattern in DOUYIN_PATTERNS:
        if re.match(pattern, url, re.IGNORECASE):
            return True, 'douyin'

    return False, None


def extract_url(text: str) -> str:
    """
    Extract the first HTTP(S) URL from text.

    Handles mobile share formats like:
    - 【标题-哔哩哔哩】 https://b23.tv/xxx
    - 标题 https://v.douyin.com/xxx 复制打开抖音

    Args:
        text: Input text that may contain a URL

    Returns:
        Extracted URL string, or the original text if it's already a URL
    """
    text = text.strip()
    if text.startswith(('http://', 'https://')):
        # Already a URL, just strip trailing whitespace/text
        return text.split()[0]

    # Find first URL in text
    match = re.search(r'https?://[^\s\u3000<>"\'\]）)]+', text)
    if match:
        return match.group(0)

    return text


def validate_username(username: str) -> Tuple[bool, Optional[str]]:
    """
    Validate username format.

    Args:
        username: Username to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not username:
        return False, "用户名不能为空"

    if len(username) < 3:
        return False, "用户名至少需要 3 个字符"

    if len(username) > 20:
        return False, "用户名不能超过 20 个字符"

    # Allow letters, numbers, underscores, and Chinese characters
    if not re.match(r'^[\w\u4e00-\u9fa5]+$', username):
        return False, "用户名只能包含字母、数字、下划线和中文"

    return True, None


def validate_password(password: str) -> Tuple[bool, Optional[str]]:
    """
    Validate password format.

    Args:
        password: Password to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if not password:
        return False, "密码不能为空"

    if len(password) < 6:
        return False, "密码至少需要 6 个字符"

    return True, None


def extract_bilibili_video_id(url: str) -> Optional[str]:
    """
    Extract Bilibili video ID (BV or AV) from URL.

    Args:
        url: Bilibili video URL

    Returns:
        Video ID or None if not found
    """
    # Match BV ID
    bv_match = re.search(r'/[Bb][Vv]([a-zA-Z0-9]+)', url)
    if bv_match:
        return f"BV{bv_match.group(1)}"

    # Match AV ID
    av_match = re.search(r'/[Aa][Vv](\d+)', url)
    if av_match:
        return f"AV{av_match.group(1)}"

    return None


def is_short_url(url: str) -> bool:
    """Check if URL is a short URL that needs resolution."""
    short_domains = ['b23.tv', 'v.douyin.com']
    parsed = urlparse(url)
    return any(domain in parsed.netloc for domain in short_domains)
