"""
Proxy utility module.

Supports two proxy modes:
- direct: static proxy URL (e.g., http://127.0.0.1:7890)
- private: dynamic proxy from API with username/password authentication
  (e.g., KDLA / XunProxy services)

Reference: server.js getProxyFromAPI / buildPrivateProxyUrl / createTunnelAgent
"""
from typing import Optional

import httpx

from app.config import settings


async def get_proxy_from_api(api_url: str) -> str:
    """
    Fetch a proxy IP from a proxy provider API.

    Mirrors server.js getProxyFromAPI: call the API, parse the IP string,
    handle various response formats (plain text, JSON with data field, etc.).

    Args:
        api_url: Proxy provider API endpoint

    Returns:
        Proxy IP string like "1.2.3.4:8080"

    Raises:
        Exception: If proxy cannot be obtained
    """
    print(f"[代理] 从API获取代理IP: {api_url}")
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(api_url)
        response.raise_for_status()

    data = response.text.strip()

    # Some APIs return JSON like {"code": 0, "data": "1.2.3.4:8080"}
    if data.startswith("{"):
        import json
        try:
            obj = json.loads(data)
            if obj.get("code") not in (0, None, "0"):
                msg = obj.get("msg") or obj.get("message") or f"code {obj.get('code')}"
                raise Exception(f"代理API返回错误: {msg}")
            data = str(obj.get("data", "")).strip()
        except json.JSONDecodeError:
            pass

    if not data:
        raise Exception("代理API返回空内容")

    # Take first proxy if multiple returned (separated by ; or newline)
    proxy_str = data.split(";")[0].split("\n")[0].split("|")[0].strip()

    if not proxy_str:
        raise Exception("代理API返回的IP为空")

    print(f"[代理] 成功获取代理: {proxy_str}")
    return proxy_str


def build_private_proxy_url(
    proxy_ip: str,
    username: str,
    password: str,
) -> str:
    """
    Build an authenticated proxy URL.

    Mirrors server.js buildPrivateProxyUrl.

    Args:
        proxy_ip: Proxy IP, e.g. "1.2.3.4" or "1.2.3.4:8080"
        username: Proxy auth username
        password: Proxy auth password

    Returns:
        Full proxy URL like "http://username:password@1.2.3.4:8080/"
    """
    if ":" in proxy_ip:
        proxy_url = f"http://{username}:{password}@{proxy_ip}/"
    else:
        proxy_url = f"http://{username}:{password}@{proxy_ip}:80/"

    print(f"[代理] 构建私密代理URL: http://***:***@{proxy_ip}/")
    return proxy_url


async def resolve_proxy_url() -> Optional[str]:
    """
    Resolve the final proxy URL based on current settings.

    Logic (mirrors server.js processAnalysis proxy resolution):
    1. If proxy not enabled -> None
    2. If proxy_type == "private" and api_url + username + password are set:
       -> call API to get dynamic IP, build authenticated URL
    3. Else if proxy_url is set -> use it directly
    4. Else -> None

    Returns:
        Final proxy URL string or None
    """
    if not settings.proxy_enabled:
        return None

    proxy_type = getattr(settings, "proxy_type", "direct")

    # Private proxy mode: fetch dynamic IP from API
    if proxy_type == "private":
        api_url = getattr(settings, "proxy_api_url", None)
        username = settings.proxy_username
        password = settings.proxy_password

        if api_url and username and password:
            try:
                proxy_ip = await get_proxy_from_api(api_url)
                return build_private_proxy_url(proxy_ip, username, password)
            except Exception as e:
                print(f"[代理] 私密代理获取失败: {e}，尝试回退到直连")
                # Fall through to direct proxy or no proxy
        else:
            print("[代理] 私密代理配置不完整(需要 api_url+username+password)，尝试回退")

    # Direct proxy mode or private fallback
    if settings.proxy_url:
        url = settings.proxy_url
        # If username/password are set but URL doesn't contain auth, apply them
        if (
            settings.proxy_username
            and settings.proxy_password
            and "@" not in url
        ):
            # Parse and inject auth: http://host:port -> http://user:pass@host:port
            url = url.replace("http://", f"http://{settings.proxy_username}:{settings.proxy_password}@", 1)
            url = url.replace("https://", f"https://{settings.proxy_username}:{settings.proxy_password}@", 1)
        print(f"[代理] 使用直接代理: {_mask_proxy_url(url)}")
        return url

    return None


def _mask_proxy_url(url: str) -> str:
    """Mask credentials in proxy URL for logging."""
    import re
    return re.sub(r'://([^:]+):([^@]+)@', '://***:***@', url)
