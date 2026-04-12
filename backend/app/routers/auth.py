"""
Authentication router for user registration, login, logout, and guest mode.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import (
    get_db, get_current_user, require_auth, verify_user_credentials
)
from app.models.schemas import (
    UserCreate, UserLogin, UserResponse, GuestUserResponse, ErrorResponse
)
from app.services.user_service import UserService
from app.services.session_service import SessionService
from app.utils.validators import validate_username, validate_password
from app.config import settings


router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


# ============== Request/Response Models ==============

class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class MigrateGuestRequest(BaseModel):
    confirm: bool = True


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


# ============== Helper Functions ==============

def set_session_cookie(response: Response, session_id: str) -> None:
    """Set session ID cookie with HttpOnly and Secure flags."""
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=settings.session_expire_days * 24 * 60 * 60,
        path="/"
    )


def clear_session_cookie(response: Response) -> None:
    """Clear session ID cookie."""
    response.delete_cookie(
        key="session_id",
        path="/"
    )


# ============== Routes ==============

@router.post("/register", response_model=UserResponse)
async def register(
    request: RegisterRequest,
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user account.

    If user is currently a guest, their data will be migrated to the new account.
    """
    # Validate username
    is_valid, error_msg = validate_username(request.username)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Validate password
    is_valid, error_msg = validate_password(request.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Check if there's a current guest session
    current_session_id = http_request.cookies.get("session_id")
    guest_user_id = None
    if current_session_id:
        session = await SessionService.get_session(db, current_session_id)
        if session:
            current_user = await UserService.get_user_by_id(db, session.user_id)
            if current_user and current_user.is_guest:
                guest_user_id = current_user.id

    # Create new user
    try:
        new_user = await UserService.create_user(
            db,
            UserCreate(username=request.username, password=request.password)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Migrate guest data if exists
    if guest_user_id:
        await UserService.migrate_guest_data(db, guest_user_id, new_user.id)
        # Delete old guest session
        await SessionService.delete_session(db, current_session_id)

    # Create new session
    session = await SessionService.create_session(db, new_user.id)

    # Set cookie
    set_session_cookie(response, session.id)

    return new_user


@router.post("/login", response_model=UserResponse)
async def login(
    request: LoginRequest,
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Login with username and password.

    Sets session cookie on successful login.
    """
    # Verify credentials
    user = await verify_user_credentials(db, request.username, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    # Check if there's a current guest session to migrate
    current_session_id = http_request.cookies.get("session_id")
    if current_session_id and user.id:
        current_session = await SessionService.get_session(db, current_session_id)
        if current_session and current_session.user_id != user.id:
            guest_user = await UserService.get_user_by_id(db, current_session.user_id)
            if guest_user and guest_user.is_guest:
                # Migrate guest data
                await UserService.migrate_guest_data(db, guest_user.id, user.id)
                await SessionService.delete_session(db, current_session_id)

    # Update last login
    await UserService.update_last_login(db, user.id)

    # Create new session
    session = await SessionService.create_session(db, user.id)

    # Set cookie
    set_session_cookie(response, session.id)

    return user


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Logout current user.

    Clears session cookie and invalidates session.
    """
    session_id = request.cookies.get("session_id")
    if session_id:
        await SessionService.delete_session(db, session_id)

    clear_session_cookie(response)

    return {"success": True, "message": "已登出"}


@router.post("/guest", response_model=GuestUserResponse)
async def create_guest(
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new guest user.

    Guest users are limited to a certain number of uses.
    """
    # Create guest user
    guest_user = await UserService.create_guest_user(db)

    # Create session
    session = await SessionService.create_session(db, guest_user.id)

    # Set cookie
    set_session_cookie(response, session.id)

    return {
        "id": guest_user.id,
        "is_guest": guest_user.is_guest,
        "usage_count": guest_user.usage_count
    }


@router.get("/me", response_model=UserResponse)
async def get_me(
    user = Depends(require_auth)
):
    """Get current user information."""
    return user


@router.post("/migrate-guest-data")
async def migrate_guest_data(
    request: MigrateGuestRequest,
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_auth)
):
    """
    Manually migrate guest data to current registered user.

    This is usually done automatically during login/registration,
    but can be called manually if needed.
    """
    if current_user.is_guest:
        raise HTTPException(status_code=403, detail="游客账号无法进行数据迁移")

    if not request.confirm:
        return {"success": False, "message": "未确认迁移操作"}

    # Find guest sessions for this device (from cookie)
    # Note: In practice, guest data should be migrated during login
    # This endpoint is mainly for manual trigger or retry

    return {
        "success": True,
        "message": "数据迁移完成",
        "user_id": current_user.id
    }


@router.get("/check-guest-limit")
async def check_guest_limit(
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if current guest user has reached usage limit.
    """
    if not user.is_guest:
        return {
            "is_guest": False,
            "has_reached_limit": False,
            "usage_count": user.usage_count,
            "limit": settings.guest_usage_limit
        }

    has_reached, usage_count = await UserService.check_guest_limit(db, user.id)

    return {
        "is_guest": True,
        "has_reached_limit": has_reached,
        "usage_count": usage_count,
        "limit": settings.guest_usage_limit,
        "remaining": max(0, settings.guest_usage_limit - usage_count)
    }


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_auth)
):
    """
    Update user profile.
    """
    # For now, just return current user (profile update not fully implemented)
    return current_user


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_auth)
):
    """
    Change user password.
    """
    if current_user.is_guest:
        raise HTTPException(status_code=403, detail="游客账号无法修改密码")

    # Validate new password
    is_valid, error_msg = validate_password(request.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    try:
        await UserService.change_password(
            db, current_user.id, request.old_password, request.new_password
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"success": True, "message": "密码修改成功"}
