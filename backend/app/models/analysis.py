"""
Analysis task ORM model.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, CheckConstraint, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class AnalysisTask(Base):
    """Analysis task model for video analysis jobs."""
    __tablename__ = "analysis_tasks"

    __table_args__ = (
        CheckConstraint("platform IN ('bilibili', 'douyin')", name="check_platform"),
        CheckConstraint(
            "status IN ('pending', 'queued', 'running', 'completed', 'failed')",
            name="check_status"
        ),
    )

    id = Column(String, primary_key=True, default=lambda: f"task_{uuid.uuid4().hex[:16]}")
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    platform = Column(String, nullable=False)  # 'bilibili', 'douyin'
    video_id = Column(String, nullable=False)  # BV号/抖音ID
    original_url = Column(String, nullable=False)
    title = Column(String, nullable=True)
    author = Column(String, nullable=True)
    cover = Column(String, nullable=True)
    duration = Column(Integer, nullable=True)  # seconds
    status = Column(String, default="pending")  # pending/queued/running/completed/failed
    queue_position = Column(Integer, default=0)
    estimated_wait_seconds = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    result = Column(JSON, nullable=True)  # AI analysis result
    transcript = Column(Text, nullable=True)  # Full transcript
    use_whisper = Column(Integer, default=0)  # 0 = false, 1 = true
    whisper_model = Column(String, default="base")  # tiny, base, small, medium
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="tasks")
    groups = relationship("Group", secondary="task_groups", back_populates="tasks")

    def __repr__(self):
        return f"<AnalysisTask(id={self.id}, platform={self.platform}, status={self.status})>"
