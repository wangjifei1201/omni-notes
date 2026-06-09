from app.config import settings
from app.services.config_service import ConfigService


def test_update_proxy_enabled_only_keeps_existing_proxy_fields():
    original = {
        "enabled": settings.proxy_enabled,
        "type": settings.proxy_type,
        "url": settings.proxy_url,
        "api_url": settings.proxy_api_url,
        "username": settings.proxy_username,
        "password": settings.proxy_password,
    }
    settings.proxy_enabled = True
    settings.proxy_type = "private"
    settings.proxy_url = "http://127.0.0.1:7890"
    settings.proxy_api_url = "https://proxy.example/api"
    settings.proxy_username = "user"
    settings.proxy_password = "pass"

    try:
        ConfigService._update_proxy_settings({"enabled": False})

        assert settings.proxy_enabled is False
        assert settings.proxy_type == "private"
        assert settings.proxy_url == "http://127.0.0.1:7890"
        assert settings.proxy_api_url == "https://proxy.example/api"
        assert settings.proxy_username == "user"
        assert settings.proxy_password == "pass"
    finally:
        settings.proxy_enabled = original["enabled"]
        settings.proxy_type = original["type"]
        settings.proxy_url = original["url"]
        settings.proxy_api_url = original["api_url"]
        settings.proxy_username = original["username"]
        settings.proxy_password = original["password"]


def test_update_proxy_empty_url_clears_only_url():
    original = {
        "enabled": settings.proxy_enabled,
        "type": settings.proxy_type,
        "url": settings.proxy_url,
        "api_url": settings.proxy_api_url,
        "username": settings.proxy_username,
        "password": settings.proxy_password,
    }
    settings.proxy_enabled = True
    settings.proxy_type = "private"
    settings.proxy_url = "http://127.0.0.1:7890"
    settings.proxy_api_url = "https://proxy.example/api"
    settings.proxy_username = "user"
    settings.proxy_password = "pass"

    try:
        ConfigService._update_proxy_settings({"url": ""})

        assert settings.proxy_url is None
        assert settings.proxy_enabled is True
        assert settings.proxy_type == "private"
        assert settings.proxy_api_url == "https://proxy.example/api"
        assert settings.proxy_username == "user"
        assert settings.proxy_password == "pass"
    finally:
        settings.proxy_enabled = original["enabled"]
        settings.proxy_type = original["type"]
        settings.proxy_url = original["url"]
        settings.proxy_api_url = original["api_url"]
        settings.proxy_username = original["username"]
        settings.proxy_password = original["password"]
