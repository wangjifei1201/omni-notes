"""
History service for managing user analysis history.
"""
from typing import Optional, List, Tuple

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analysis import AnalysisTask
from app.models.schemas import HistoryItem, HistoryListResponse


class HistoryService:
    """Service for managing user analysis history."""

    @staticmethod
    async def list_history(
        db: AsyncSession,
        user_id: str,
        page: int = 1,
        limit: int = 20,
        group_id: Optional[str] = None
    ) -> Tuple[List[AnalysisTask], int]:
        """
        Get paginated history list for a user.

        Args:
            db: Database session
            user_id: User ID
            page: Page number (1-indexed)
            limit: Items per page
            group_id: Optional group ID filter

        Returns:
            Tuple of (tasks list, total count)
        """
        # Build base query - only return completed tasks
        query = select(AnalysisTask).where(
            AnalysisTask.user_id == user_id,
            AnalysisTask.status == 'completed'
        )

        # Filter by group if specified
        if group_id:
            from app.models.group import task_groups
            query = query.join(
                task_groups,
                AnalysisTask.id == task_groups.c.task_id
            ).where(task_groups.c.group_id == group_id)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Get paginated results
        query = query.order_by(desc(AnalysisTask.created_at))
        query = query.offset((page - 1) * limit).limit(limit)

        result = await db.execute(query)
        tasks = result.scalars().all()

        return list(tasks), total

    @staticmethod
    async def delete_history(
        db: AsyncSession,
        task_id: str,
        user_id: str
    ) -> bool:
        """
        Delete a history item.

        Args:
            db: Database session
            task_id: Task ID
            user_id: User ID for permission check

        Returns:
            True if deleted, False if not found
        """
        from app.services.analysis_service import analysis_service

        return await analysis_service.delete_task(db, task_id, user_id)

    @staticmethod
    async def to_history_item(
        db: AsyncSession,
        task: AnalysisTask
    ) -> HistoryItem:
        """
        Convert AnalysisTask to HistoryItem.

        Args:
            db: Database session
            task: AnalysisTask instance

        Returns:
            HistoryItem
        """
        # Get group IDs for this task
        from app.models.group import task_groups
        from sqlalchemy import select

        result = await db.execute(
            select(task_groups.c.group_id)
            .where(task_groups.c.task_id == task.id)
        )
        group_ids = [row[0] for row in result.fetchall()]

        # Extract summary and key_points from result if available
        summary = None
        key_points = []
        if task.result:
            if isinstance(task.result, dict):
                summary = task.result.get("summary")
                key_points = task.result.get("key_points", [])
            else:
                summary = getattr(task.result, "summary", None)
                key_points = getattr(task.result, "key_points", [])

        return HistoryItem(
            id=task.id,
            platform=task.platform,
            title=task.title,
            author=task.author,
            cover=task.cover,
            duration=task.duration,
            status=task.status,
            created_at=task.created_at,
            group_ids=group_ids,
            summary=summary,
            key_points=key_points
        )

    @staticmethod
    async def search_history(
        db: AsyncSession,
        user_id: str,
        keyword: str,
        page: int = 1,
        limit: int = 20
    ) -> Tuple[List[AnalysisTask], int]:
        """
        Search history by keyword.

        Args:
            db: Database session
            user_id: User ID
            keyword: Search keyword
            page: Page number
            limit: Items per page

        Returns:
            Tuple of (tasks list, total count)
        """
        from sqlalchemy import or_

        query = select(AnalysisTask).where(
            AnalysisTask.user_id == user_id,
            AnalysisTask.status == 'completed',
            or_(
                AnalysisTask.title.ilike(f"%{keyword}%"),
                AnalysisTask.author.ilike(f"%{keyword}%"),
                AnalysisTask.transcript.ilike(f"%{keyword}%")
            )
        )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Get paginated results
        query = query.order_by(desc(AnalysisTask.created_at))
        query = query.offset((page - 1) * limit).limit(limit)

        result = await db.execute(query)
        tasks = result.scalars().all()

        return list(tasks), total


# Global history service instance
history_service = HistoryService()
