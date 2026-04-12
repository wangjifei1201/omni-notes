"""
FastAPI dependencies for authentication and authorization.
"""
from typing import Optional

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.user_service import UserService
from app.services.session_service import SessionService
from app.utils.crypto import verify_password


# Security scheme for Bearer token (though we primarily use cookies)
security = HTTPBearer(auto_error=False)


async def get_db() -> AsyncSession:
    """
    Dependency for getting async database session.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Get current user from session cookie.

    Args:
        request: FastAPI request object
        db: Database session

    Returns:
        User instance or None if not authenticated
    """
    # Get session ID from cookie
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None

    # Get session from database
    session = await SessionService.get_session(db, session_id)
    if not session:
        return None

    # Get user
    user = await UserService.get_user_by_id(db, session.user_id)
    if not user:
        return None

    return user


async def get_current_user_or_guest(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get current user from session cookie, or create a guest user if not authenticated.

    Args:
        request: FastAPI request object
        db: Database session

    Returns:
        User instance (registered or guest)
    """
    # Try to get existing user
    user = await get_current_user(request, db)
    if user:
        return user

    # Create new guest user
    guest_user = await UserService.create_guest_user(db)
    return guest_user


async def require_auth(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Require authentication - raises 401 if not authenticated.

    Args:
        request: FastAPI request object
        db: Database session

    Returns:
        User instance

    Raises:
        HTTPException: 401 if not authenticated
    """
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="请先登录",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return user


async def require_registered_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Require registered user (not guest) - raises 401/403 if not.

    Args:
        request: FastAPI request object
        db: Database session

    Returns:
        User instance

    Raises:
        HTTPException: 401 if not authenticated, 403 if guest
    """
    user = await require_auth(request, db)
    if user.is_guest:
        raise HTTPException(
            status_code=403,
            detail="此功能需要登录后才能使用"
        )
    return user


async def check_guest_limit(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Check if guest user has reached usage limit.

    Args:
        user: Current user
        db: Database session

    Returns:
        User instance

    Raises:
        HTTPException: 403 if guest limit reached
    """
    if not user.is_guest:
        return user

    has_reached, usage_count = await UserService.check_guest_limit(db, user.id)
    if has_reached:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "GUEST_LIMIT_REACHED",
                "message": f"游客体验次数已用完 ({usage_count}/{user.usage_count}次)，请注册账号继续使用",
                "usage_count": usage_count
            }
        )

    return user


async def verify_user_credentials(
    db: AsyncSession,
    username: str,
    password: str
) -> Optional[User]:
    """
    Verify user credentials.

    Args:
        db: Database session
        username: Username
        password: Plain text password

    Returns:
        User instance if credentials valid, None otherwise
    """
    user = await UserService.get_user_by_username(db, username)
    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user
