"""
Config router for managing user configurations.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_auth
from app.models.schemas import ConfigResponse, CookieConfigResponse
from app.services.config_service import config_service


router = APIRouter(prefix="/api/v1/config", tags=["config"])


# Request models
class ConfigUpdateRequest(BaseModel):
    ai_provider: Optional[str] = Field(None, description="AI provider (bailian/openai)")
    api_key: Optional[str] = Field(None, description="API key (encrypted)")
    base_url: Optional[str] = Field(None, description="API base URL")
    model: Optional[str] = Field(None, description="AI model")
    use_whisper: Optional[bool] = Field(None, description="Enable Whisper")
    whisper_model: Optional[str] = Field(None, description="Whisper model")
    proxy: Optional[dict] = Field(None, description="Proxy configuration")


class CookieUpdateRequest(BaseModel):
    bilibili_cookie: Optional[str] = Field(None, description="Bilibili cookie")


@router.get("", response_model=ConfigResponse)
async def get_config(
    user = Depends(require_auth),
):
    """
    Get user configuration.

    Returns current AI provider, Whisper settings, and proxy configuration.
    API key is not returned for security reasons.

    **Authentication**: Required
    """
    return await config_service.get_config(user.id)


@router.put("")
async def update_config(
    request: ConfigUpdateRequest,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user configuration.

    **Authentication**: Required
    """
    config_data = request.model_dump(exclude_unset=True)

    try:
        result = await config_service.update_config(user.id, config_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"配置更新失败: {str(e)}")


@router.get("/cookie", response_model=CookieConfigResponse)
async def get_cookie_config(
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Get cookie configuration.

    Returns whether cookies are configured (not the actual cookie value).

    **Authentication**: Required
    """
    bilibili_cookie = await config_service.get_cookie(db, user.id, "bilibili")

    return CookieConfigResponse(
        bilibili_cookie="***" if bilibili_cookie else None
    )


@router.put("/cookie")
async def update_cookie_config(
    request: CookieUpdateRequest,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Update cookie configuration.

    Cookies are encrypted before storage.

    **Authentication**: Required
    """
    if request.bilibili_cookie:
        await config_service.update_cookie(
            db, user.id, "bilibili", request.bilibili_cookie
        )

    return {"success": True, "message": "Cookie已更新"}


@router.delete("/cookie/{platform}")
async def delete_cookie(
    platform: str,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete cookie for a platform.

    **Authentication**: Required
    """
    deleted = await config_service.delete_cookie(db, user.id, platform)
    if not deleted:
        raise HTTPException(status_code=404, detail="Cookie不存在")

    return {"success": True, "message": "Cookie已删除"}
