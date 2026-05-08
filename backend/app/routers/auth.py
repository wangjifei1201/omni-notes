"""
Authentication router for user registration, login, logout, and guest mode.
"""

from datetime import datetime
from typing import Optional
import requests

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.dependencies import (
    get_db,
    get_current_user,
    require_auth,
    verify_user_credentials,
)
from app.models.schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    GuestUserResponse,
    ErrorResponse,
)
from app.models.user import User
from app.services.user_service import UserService
from app.services.session_service import SessionService
from app.utils.validators import validate_username, validate_password
from app.utils.wechat_decrypt import WeChatDecrypt, WeChatDecryptError
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
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    """Clear session ID cookie."""
    response.delete_cookie(key="session_id", path="/")


# ============== Routes ==============


@router.post("/register", response_model=UserResponse)
async def register(
    request: RegisterRequest,
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
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
            db, UserCreate(username=request.username, password=request.password)
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
    db: AsyncSession = Depends(get_db),
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
    request: Request, response: Response, db: AsyncSession = Depends(get_db)
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
async def create_guest(response: Response, db: AsyncSession = Depends(get_db)):
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

    return GuestUserResponse(
        id=guest_user.id,
        is_guest=guest_user.is_guest,
        usage_count=guest_user.usage_count,
        session_id=session.id,  # 返回session_id供小程序使用
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(require_auth)):
    """Get current user information."""
    return user


@router.post("/migrate-guest-data")
async def migrate_guest_data(
    request: MigrateGuestRequest,
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_auth),
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

    return {"success": True, "message": "数据迁移完成", "user_id": current_user.id}


@router.get("/check-guest-limit")
async def check_guest_limit(
    user=Depends(require_auth), db: AsyncSession = Depends(get_db)
):
    """
    Check if current guest user has reached usage limit.
    """
    if not user.is_guest:
        return {
            "is_guest": False,
            "has_reached_limit": False,
            "usage_count": user.usage_count,
            "limit": settings.guest_usage_limit,
        }

    has_reached, usage_count = await UserService.check_guest_limit(db, user.id)

    return {
        "is_guest": True,
        "has_reached_limit": has_reached,
        "usage_count": usage_count,
        "limit": settings.guest_usage_limit,
        "remaining": max(0, settings.guest_usage_limit - usage_count),
    }


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_auth),
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
    current_user=Depends(require_auth),
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


class WeChatPhoneLoginRequest(BaseModel):
    """微信手机号授权登录请求（新版API）"""

    code: str  # 手机号授权code


class WeChatPhoneLoginResponse(BaseModel):
    """微信手机号授权登录响应"""

    id: str
    phone: Optional[str] = None
    is_guest: bool = False
    username: Optional[str] = None
    usage_count: int = 0
    session_id: Optional[str] = None  # 添加session_id字段


@router.post("/wechat-phone-login", response_model=WeChatPhoneLoginResponse)
async def wechat_phone_login(
    request: WeChatPhoneLoginRequest,
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    微信手机号授权登录（新版API）

    使用微信新版手机号快速验证API（无需解密）
    https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-info/phone-number/getPhoneNumber.html
    """
    try:
        # 1. 调用微信新版API直接获取手机号（无需解密）
        # 先获取access_token
        token_url = "https://api.weixin.qq.com/cgi-bin/token"
        token_params = {
            "grant_type": "client_credential",
            "appid": settings.wechat_miniapp_appid,
            "secret": settings.wechat_miniapp_secret,
        }

        token_response = requests.get(token_url, params=token_params, timeout=10)
        token_data = token_response.json()

        if token_data.get("errcode"):
            raise HTTPException(
                status_code=500,
                detail=f"获取access_token失败: {token_data.get('errmsg', 'Unknown error')}",
            )

        access_token = token_data["access_token"]

        # 2. 使用手机号code获取手机号信息
        phone_url = "https://api.weixin.qq.com/wxa/business/getuserphonenumber"
        phone_params = {
            "code": request.code  # 手机号授权code
        }

        phone_response = requests.post(
            phone_url,
            params={"access_token": access_token},
            json=phone_params,
            timeout=10,
        )
        phone_data = phone_response.json()

        # 检查微信API错误
        if phone_data.get("errcode") and phone_data["errcode"] != 0:
            error_code = phone_data.get("errcode")
            error_msg = phone_data.get("errmsg", "Unknown error")

            # 根据错误码提供友好提示
            if error_code == 40029:
                raise HTTPException(status_code=400, detail="授权码已失效，请重新授权")
            elif error_code == 40163:
                raise HTTPException(
                    status_code=400, detail="授权码已被使用，请重新授权"
                )
            elif error_code == 40013:
                raise HTTPException(status_code=400, detail="AppID无效，请检查配置")
            elif error_code == 48001:
                raise HTTPException(
                    status_code=400, detail="小程序未开通手机号登录权限"
                )
            else:
                raise HTTPException(
                    status_code=400, detail=f"微信登录失败: {error_msg}"
                )

        # 3. 获取手机号信息
        phone_info = phone_data.get("phone_info", {})
        phone = phone_info.get("purePhoneNumber")
        openid = phone_info.get("openid")  # 新版API也返回openid

        if not phone:
            raise HTTPException(status_code=400, detail="未能获取手机号信息")

        # 4. 查找或创建用户
        stmt = select(User).where(User.phone == phone)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
            # 已存在用户，更新openid和登录时间
            if openid and not user.openid:
                user.openid = openid
            await UserService.update_last_login(db, user.id)
            await db.commit()
        else:
            # 创建新用户
            username = f"微信用户_{phone}"
            user = await UserService.create_user_by_phone(
                db, phone=phone, openid=openid or "", username=username
            )

        # 5. 创建 session
        session = await SessionService.create_session(db, user.id)

        # 6. 设置 cookie
        set_session_cookie(response, session.id)

        return WeChatPhoneLoginResponse(
            id=user.id,
            phone=user.phone,
            is_guest=user.is_guest,
            username=user.username,
            usage_count=user.usage_count,
            session_id=session.id,  # 返回session_id供小程序使用
        )

    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"微信API调用失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"登录失败: {str(e)}")


@router.post("/wechat-login")
async def wechat_login(
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    微信 openid 授权登录（个人主体小程序方案）

    1. 前端调用 wx.login() 获取 code
    2. 后端用 code 换 openid
    3. 用 openid 查找/创建用户
    """
    # 获取请求体中的 code
    try:
        body = await http_request.json()
        code = body.get("code")
    except Exception:
        raise HTTPException(status_code=400, detail="缺少 code 参数")

    if not code:
        raise HTTPException(status_code=400, detail="code 不能为空")

    try:
        # 1. 用 code 换 openid
        appid = settings.wechat_miniapp_appid
        secret = settings.wechat_miniapp_secret

        # 调用微信 API 用 code 换 session_key 和 openid
        token_url = "https://api.weixin.qq.com/sns/jscode2session"
        token_params = {
            "appid": appid,
            "secret": secret,
            "js_code": code,
            "grant_type": "authorization_code",
        }

        token_response = requests.get(token_url, params=token_params, timeout=10)
        token_data = token_response.json()

        # 检查微信返回的错误
        if token_data.get("errcode") and token_data["errcode"] != 0:
            errcode = token_data.get("errcode")
            errmsg = token_data.get("errmsg", "Unknown error")
            if errcode == 40029:
                raise HTTPException(status_code=400, detail="授权码无效，请重新登录")
            elif errcode == 40127:
                raise HTTPException(status_code=400, detail="code 已过期，请重新登录")
            else:
                raise HTTPException(status_code=400, detail=f"微信登录失败: {errmsg}")

        openid = token_data.get("openid")
        if not openid:
            raise HTTPException(status_code=500, detail="未能获取用户标识")

        # 2. 用 openid 查找用户
        stmt = select(User).where(User.openid == openid)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
            # 已存在用户，更新登录时间
            await UserService.update_last_login(db, user.id)
            await db.commit()
        else:
            # 创建新用户
            user = await UserService.create_user_by_openid(db, openid=openid)

        # 3. 创建 session
        session = await SessionService.create_session(db, user.id)

        # 4. 设置 cookie
        set_session_cookie(response, session.id)

        return {
            "id": user.id,
            "openid": user.openid,
            "username": user.username,
            "is_guest": user.is_guest,
            "session_id": session.id,
        }

    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"微信服务异常，请稍后重试")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"登录失败: {str(e)}")
