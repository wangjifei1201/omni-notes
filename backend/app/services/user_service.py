"""
User service for user management operations.
"""

import random
import string
from datetime import datetime
from typing import Optional, List, Tuple

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.schemas import UserCreate
from app.utils.crypto import hash_password, verify_password, generate_uuid
from app.config import settings


class UserService:
    """Service for user-related operations."""

    @staticmethod
    async def create_user(db: AsyncSession, user_data: UserCreate) -> User:
        """
        Create a new registered user.

        Args:
            db: Database session
            user_data: User creation data

        Returns:
            Created User instance
        """
        # Check if username already exists
        existing = await UserService.get_user_by_username(db, user_data.username)
        if existing:
            raise ValueError(f"用户名 '{user_data.username}' 已被使用")

        # Create user
        user = User(
            id=generate_uuid(),
            username=user_data.username,
            password_hash=hash_password(user_data.password),
            is_guest=False,
            usage_count=0,
            created_at=datetime.utcnow(),
            last_login_at=datetime.utcnow(),
        )

        db.add(user)
        await db.commit()
        await db.refresh(user)

        return user

    @staticmethod
    async def create_user_by_phone(
        db: AsyncSession, phone: str, openid: str, username: str
    ) -> User:
        """
        Create a new user by phone number (WeChat login).

        Args:
            db: Database session
            phone: Phone number
            openid: WeChat openid
            username: Username

        Returns:
            Created User instance
        """
        # Generate a random password for WeChat users
        random_password = "".join(
            random.choices(string.ascii_letters + string.digits, k=32)
        )

        user = User(
            id=generate_uuid(),
            username=username,
            password_hash=hash_password(random_password),
            phone=phone,
            openid=openid,
            is_guest=False,
            usage_count=0,
            created_at=datetime.utcnow(),
            last_login_at=datetime.utcnow(),
        )

        db.add(user)
        await db.commit()
        await db.refresh(user)

        return user

    @staticmethod
    async def create_user_by_openid(db: AsyncSession, openid: str, username: str = None) -> User:
        """通过 openid 创建新用户"""
        if username is None:
            # 生成默认用户名
            username = f"微信用户_{openid[:8]}"

        new_user = User(
            username=username,
            openid=openid,
            is_guest=False,
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user

    @staticmethod
    async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
        """
        Get user by username.

        Args:
            db: Database session
            username: Username to search

        Returns:
            User instance or None
        """
        result = await db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
        """
        Get user by ID.

        Args:
            db: Database session
            user_id: User ID to search

        Returns:
            User instance or None
        """
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create_guest_user(db: AsyncSession) -> User:
        """
        Create a new guest user.

        Args:
            db: Database session

        Returns:
            Created guest User instance
        """
        # Generate random guest username
        random_suffix = "".join(
            random.choices(string.ascii_lowercase + string.digits, k=8)
        )
        username = f"guest_{random_suffix}"

        # Ensure username is unique
        while await UserService.get_user_by_username(db, username):
            random_suffix = "".join(
                random.choices(string.ascii_lowercase + string.digits, k=8)
            )
            username = f"guest_{random_suffix}"

        # Create guest user with random password (won't be used for login)
        user = User(
            id=generate_uuid(),
            username=username,
            password_hash=hash_password(generate_uuid()),  # Random password
            is_guest=True,
            usage_count=0,
            created_at=datetime.utcnow(),
            last_login_at=datetime.utcnow(),
        )

        db.add(user)
        await db.commit()
        await db.refresh(user)

        return user

    @staticmethod
    async def increment_usage_count(db: AsyncSession, user_id: str) -> int:
        """
        Increment guest user's usage count.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            New usage count
        """
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(usage_count=User.usage_count + 1)
        )
        await db.commit()

        # Get updated count
        user = await UserService.get_user_by_id(db, user_id)
        return user.usage_count if user else 0

    @staticmethod
    async def check_guest_limit(db: AsyncSession, user_id: str) -> Tuple[bool, int]:
        """
        Check if guest user has reached usage limit.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            Tuple of (has_reached_limit, current_usage_count)
        """
        user = await UserService.get_user_by_id(db, user_id)
        if not user:
            return True, 0

        if not user.is_guest:
            return False, user.usage_count

        return user.usage_count >= settings.guest_usage_limit, user.usage_count

    @staticmethod
    async def migrate_guest_data(
        db: AsyncSession, guest_user_id: str, new_user_id: str
    ) -> bool:
        """
        Migrate guest user's data to a new registered user.

        Args:
            db: Database session
            guest_user_id: Guest user ID
            new_user_id: New registered user ID

        Returns:
            True if migration successful
        """
        from app.models.analysis import AnalysisTask
        from app.models.group import Group

        # Update all tasks to new user
        await db.execute(
            update(AnalysisTask)
            .where(AnalysisTask.user_id == guest_user_id)
            .values(user_id=new_user_id)
        )

        # Update all groups to new user
        await db.execute(
            update(Group)
            .where(Group.user_id == guest_user_id)
            .values(user_id=new_user_id)
        )

        # Delete guest user
        guest_user = await UserService.get_user_by_id(db, guest_user_id)
        if guest_user:
            await db.delete(guest_user)

        await db.commit()
        return True

    @staticmethod
    async def update_last_login(db: AsyncSession, user_id: str) -> None:
        """
        Update user's last login time.

        Args:
            db: Database session
            user_id: User ID
        """
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(last_login_at=datetime.utcnow())
        )
        await db.commit()

    @staticmethod
    async def delete_user(db: AsyncSession, user_id: str) -> bool:
        """
        Delete a user and all associated data.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            True if deletion successful
        """
        user = await UserService.get_user_by_id(db, user_id)
        if not user:
            return False

        await db.delete(user)
        await db.commit()
        return True

    @staticmethod
    async def change_password(
        db: AsyncSession, user_id: str, old_password: str, new_password: str
    ) -> bool:
        """
        Change user password.

        Args:
            db: Database session
            user_id: User ID
            old_password: Current password
            new_password: New password

        Returns:
            True if password changed successfully

        Raises:
            ValueError: If old password is incorrect
        """
        user = await UserService.get_user_by_id(db, user_id)
        if not user:
            raise ValueError("用户不存在")

        # Verify old password
        if not verify_password(old_password, user.password_hash):
            raise ValueError("当前密码不正确")

        # Update password
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(password_hash=hash_password(new_password))
        )
        await db.commit()
        return True
