"""
Application configuration using pydantic-settings.
"""
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Application
    app_name: str = "Omni-Notes API"
    debug: bool = False

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://user:password@localhost:5432/omni_notes",
        alias="DATABASE_URL"
    )

    # Security
    cookie_encryption_key: str = Field(
        default="your-secret-key-here-must-be-32-bytes!",
        alias="COOKIE_ENCRYPTION_KEY"
    )
    session_expire_days: int = 7

    # CORS
    cors_origins: str = Field(default="http://localhost:3000")

    # AI Configuration (optional defaults)
    ai_provider: str = "bailian"  # bailian or openai
    ai_base_url: Optional[str] = None
    ai_api_key: Optional[str] = None
    ai_model: str = "qwen3.5-plus"

    # Whisper Configuration
    use_whisper: bool = True
    whisper_model: str = "base"  # tiny, base, small, medium

    # Proxy Configuration
    proxy_enabled: bool = False
    proxy_url: Optional[str] = None
    proxy_username: Optional[str] = None
    proxy_password: Optional[str] = None

    # Transcript Cache
    transcript_cache_dir: str = "data/transcript_cache"

    # Queue Configuration
    max_concurrent_tasks: int = 2
    max_queue_size: int = 10

    # Guest Mode
    guest_usage_limit: int = 10

    @property
    def database_url_async(self) -> str:
        """Ensure database URL uses asyncpg driver."""
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


# Global settings instance
settings = Settings()
