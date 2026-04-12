"""
User ORM models.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    """User model for both registered users and guests."""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_guest = Column(Boolean, default=False)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)

    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    cookies = relationship("UserCookie", back_populates="user", cascade="all, delete-orphan")
    tasks = relationship("AnalysisTask", back_populates="user", cascade="all, delete-orphan")
    groups = relationship("Group", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, is_guest={self.is_guest})>"


class Session(Base):
    """Session model for authentication."""
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="sessions")

    def __repr__(self):
        return f"<Session(id={self.id}, user_id={self.user_id})>"


class UserCookie(Base):
    """Encrypted cookie storage for video platforms."""
    __tablename__ = "user_cookies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    platform = Column(String, nullable=False)  # 'bilibili', 'douyin'
    cookie_encrypted = Column(Text, nullable=False)  # Fernet encrypted
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="cookies")

    def __repr__(self):
        return f"<UserCookie(id={self.id}, user_id={self.user_id}, platform={self.platform})>"
