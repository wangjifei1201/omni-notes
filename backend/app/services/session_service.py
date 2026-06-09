"""
Session service for authentication session management.
"""
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Session as UserSession
from app.utils.crypto import generate_session_id, get_session_expiry
from app.config import settings


class SessionService:
    """Service for session management."""

    @staticmethod
    async def create_session(
        db: AsyncSession,
        user_id: str
    ) -> UserSession:
        """
        Create a new session for a user.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            Created Session instance
        """
        # Clean up expired sessions for this user first
        await SessionService.cleanup_user_sessions(db, user_id)

        session = UserSession(
            id=generate_session_id(),
            user_id=user_id,
            expires_at=get_session_expiry(),
            created_at=datetime.utcnow()
        )

        db.add(session)
        await db.commit()
        await db.refresh(session)

        return session

    @staticmethod
    async def get_session(
        db: AsyncSession,
        session_id: str
    ) -> Optional[UserSession]:
        """
        Get session by ID if not expired.

        Args:
            db: Database session
            session_id: Session ID

        Returns:
            Session instance or None if not found or expired
        """
        result = await db.execute(
            select(UserSession).where(
                UserSession.id == session_id,
                UserSession.expires_at > datetime.utcnow()
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def delete_session(db: AsyncSession, session_id: str) -> bool:
        """
        Delete a session.

        Args:
            db: Database session
            session_id: Session ID

        Returns:
            True if deleted, False if not found
        """
        result = await db.execute(
            delete(UserSession).where(UserSession.id == session_id)
        )
        await db.commit()
        return result.rowcount > 0

    @staticmethod
    async def delete_all_user_sessions(db: AsyncSession, user_id: str) -> int:
        """
        Delete all sessions for a user.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            Number of sessions deleted
        """
        result = await db.execute(
            delete(UserSession).where(UserSession.user_id == user_id)
        )
        await db.commit()
        return result.rowcount

    @staticmethod
    async def cleanup_user_sessions(db: AsyncSession, user_id: str, keep_count: int = 5) -> int:
        """
        Clean up old sessions for a user, keeping only the most recent ones.

        Args:
            db: Database session
            user_id: User ID
            keep_count: Number of recent sessions to keep

        Returns:
            Number of sessions deleted
        """
        # Get all active sessions for user ordered by creation time
        result = await db.execute(
            select(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.expires_at > datetime.utcnow()
            )
            .order_by(UserSession.created_at.desc())
        )
        sessions = result.scalars().all()

        # Delete old sessions beyond keep_count
        sessions_to_delete = sessions[keep_count:]
        for session in sessions_to_delete:
            await db.delete(session)

        if sessions_to_delete:
            await db.commit()

        return len(sessions_to_delete)

    @staticmethod
    async def cleanup_expired_sessions(db: AsyncSession) -> int:
        """
        Clean up all expired sessions.

        Args:
            db: Database session

        Returns:
            Number of sessions deleted
        """
        result = await db.execute(
            delete(UserSession).where(UserSession.expires_at <= datetime.utcnow())
        )
        await db.commit()
        return result.rowcount

    @staticmethod
    async def extend_session(
        db: AsyncSession,
        session_id: str
    ) -> Optional[UserSession]:
        """
        Extend session expiry time.

        Args:
            db: Database session
            session_id: Session ID

        Returns:
            Updated Session instance or None
        """
        session = await SessionService.get_session(db, session_id)
        if not session:
            return None

        session.expires_at = get_session_expiry()
        await db.commit()
        await db.refresh(session)

        return session

    @staticmethod
    async def get_user_sessions_count(db: AsyncSession, user_id: str) -> int:
        """
        Get count of active sessions for a user.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            Number of active sessions
        """
        result = await db.execute(
            select(UserSession)
            .where(
                UserSession.user_id == user_id,
                UserSession.expires_at > datetime.utcnow()
            )
        )
        return len(result.scalars().all())
