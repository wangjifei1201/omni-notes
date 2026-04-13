"""
Config service for managing user configurations.
"""
from typing import Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserCookie
from app.models.schemas import ConfigResponse, CookieConfigResponse
from app.utils.crypto import encrypt_data, decrypt_data
from app.config import settings


class ConfigService:
    """Service for managing user configurations."""

    @staticmethod
    async def get_config(user_id: str) -> ConfigResponse:
        """
        Get user configuration.

        Args:
            user_id: User ID

        Returns:
            ConfigResponse
        """
        # Return current settings (stored globally or per-user)
        return ConfigResponse(
            ai_provider=settings.ai_provider,
            base_url=settings.ai_base_url,
            model=settings.ai_model,
            use_whisper=settings.use_whisper,
            whisper_model=settings.whisper_model,
            proxy_enabled=settings.proxy_enabled,
            proxy_type=settings.proxy_type if settings.proxy_enabled else "direct",
            proxy_url=settings.proxy_url,
            proxy_api_url=getattr(settings, "proxy_api_url", None),
        )

    @staticmethod
    async def update_config(
        user_id: str,
        config_data: Dict[str, Any]
    ) -> ConfigResponse:
        """
        Update user configuration.

        Args:
            user_id: User ID
            config_data: Configuration data

        Returns:
            Updated ConfigResponse
        """
        # In a real implementation, you'd save to database
        # For now, we just update in-memory settings
        global settings

        if 'ai_provider' in config_data:
            settings.ai_provider = config_data['ai_provider']
        if 'base_url' in config_data:
            settings.ai_base_url = config_data['base_url']
        if 'model' in config_data:
            settings.ai_model = config_data['model']
        if 'use_whisper' in config_data:
            settings.use_whisper = config_data['use_whisper']
        if 'whisper_model' in config_data:
            settings.whisper_model = config_data['whisper_model']

        # Handle proxy config
        proxy = config_data.get('proxy')
        if proxy:
            settings.proxy_enabled = proxy.get('enabled', False)
            settings.proxy_type = proxy.get('type', 'direct')
            settings.proxy_url = proxy.get('url') or settings.proxy_url
            settings.proxy_api_url = proxy.get('apiUrl') or settings.proxy_api_url
            settings.proxy_username = proxy.get('username') or settings.proxy_username
            settings.proxy_password = proxy.get('password') or settings.proxy_password

        # Handle API key (encrypt and store)
        api_key = config_data.get('api_key')
        if api_key:
            # In production, save encrypted key to database
            # For now, just update settings
            settings.ai_api_key = api_key

        return await ConfigService.get_config(user_id)

    @staticmethod
    async def get_cookie(
        db: AsyncSession,
        user_id: str,
        platform: str
    ) -> Optional[str]:
        """
        Get decrypted cookie for a platform.

        Args:
            db: Database session
            user_id: User ID
            platform: Platform name

        Returns:
            Decrypted cookie or None
        """
        result = await db.execute(
            select(UserCookie)
            .where(
                UserCookie.user_id == user_id,
                UserCookie.platform == platform
            )
            .order_by(UserCookie.updated_at.desc())
        )
        cookie = result.scalar_one_or_none()

        if not cookie:
            return None

        try:
            return decrypt_data(cookie.cookie_encrypted)
        except Exception:
            return None

    @staticmethod
    async def update_cookie(
        db: AsyncSession,
        user_id: str,
        platform: str,
        cookie_data: str
    ) -> bool:
        """
        Update cookie for a platform.

        Args:
            db: Database session
            user_id: User ID
            platform: Platform name
            cookie_data: Cookie string

        Returns:
            True if successful
        """
        from datetime import datetime

        # Encrypt cookie
        encrypted = encrypt_data(cookie_data)

        # Check if exists
        result = await db.execute(
            select(UserCookie)
            .where(
                UserCookie.user_id == user_id,
                UserCookie.platform == platform
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update
            existing.cookie_encrypted = encrypted
            existing.updated_at = datetime.utcnow()
        else:
            # Create new
            new_cookie = UserCookie(
                user_id=user_id,
                platform=platform,
                cookie_encrypted=encrypted
            )
            db.add(new_cookie)

        await db.commit()
        return True

    @staticmethod
    async def delete_cookie(
        db: AsyncSession,
        user_id: str,
        platform: str
    ) -> bool:
        """
        Delete cookie for a platform.

        Args:
            db: Database session
            user_id: User ID
            platform: Platform name

        Returns:
            True if deleted
        """
        result = await db.execute(
            select(UserCookie)
            .where(
                UserCookie.user_id == user_id,
                UserCookie.platform == platform
            )
        )
        cookie = result.scalar_one_or_none()

        if cookie:
            await db.delete(cookie)
            await db.commit()
            return True

        return False


# Global config service instance
config_service = ConfigService()
