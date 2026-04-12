"""
Group ORM models.
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Table, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


# Association table for task-group many-to-many relationship
task_groups = Table(
    "task_groups",
    Base.metadata,
    Column("task_id", String, ForeignKey("analysis_tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("group_id", String, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
)


class Group(Base):
    """Group model for organizing analysis tasks."""
    __tablename__ = "groups"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="groups")
    tasks = relationship("AnalysisTask", secondary=task_groups, back_populates="groups")

    def __repr__(self):
        return f"<Group(id={self.id}, name={self.name})>"
