"""
Analysis task service for managing analysis tasks.
"""
from datetime import datetime
from typing import Optional, List, Tuple

from sqlalchemy import select, update, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.analysis import AnalysisTask
from app.models.schemas import AnalysisTaskCreate, AnalysisResult


class AnalysisService:
    """Service for managing analysis tasks."""

    @staticmethod
    async def create_task(
        db: AsyncSession,
        user_id: str,
        platform: str,
        video_id: str,
        original_url: str,
        title: Optional[str] = None,
        author: Optional[str] = None,
        cover: Optional[str] = None,
        duration: Optional[int] = None,
        use_whisper: bool = False,
        whisper_model: str = "base"
    ) -> AnalysisTask:
        """
        Create a new analysis task.

        Args:
            db: Database session
            user_id: User ID
            platform: Video platform
            video_id: Video ID
            original_url: Original video URL
            title: Video title
            author: Video author
            cover: Video cover URL
            duration: Video duration
            use_whisper: Whether to use Whisper
            whisper_model: Whisper model

        Returns:
            Created AnalysisTask
        """
        task = AnalysisTask(
            user_id=user_id,
            platform=platform,
            video_id=video_id,
            original_url=original_url,
            title=title,
            author=author,
            cover=cover,
            duration=duration,
            status="pending",
            use_whisper=use_whisper,
            whisper_model=whisper_model,
            created_at=datetime.utcnow()
        )

        db.add(task)
        await db.commit()
        await db.refresh(task)

        return task

    @staticmethod
    async def get_task(
        db: AsyncSession,
        task_id: str,
        user_id: Optional[str] = None
    ) -> Optional[AnalysisTask]:
        """
        Get task by ID.

        Args:
            db: Database session
            task_id: Task ID
            user_id: Optional user ID for permission check

        Returns:
            AnalysisTask or None
        """
        query = select(AnalysisTask).where(AnalysisTask.id == task_id)

        if user_id:
            query = query.where(AnalysisTask.user_id == user_id)

        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_tasks(
        db: AsyncSession,
        user_id: str,
        page: int = 1,
        limit: int = 20,
        group_id: Optional[str] = None
    ) -> Tuple[List[AnalysisTask], int]:
        """
        List analysis tasks for a user.

        Args:
            db: Database session
            user_id: User ID
            page: Page number
            limit: Items per page
            group_id: Optional group ID filter

        Returns:
            Tuple of (tasks, total_count)
        """
        # Build query
        query = select(AnalysisTask).where(AnalysisTask.user_id == user_id)

        # Filter by group if specified
        if group_id:
            # Join with task_groups table
            from app.models.group import task_groups
            query = query.join(
                task_groups,
                AnalysisTask.id == task_groups.c.task_id
            ).where(task_groups.c.group_id == group_id)

        # Get total count
        count_query = select(AnalysisTask).where(AnalysisTask.user_id == user_id)
        if group_id:
            count_query = count_query.join(
                task_groups,
                AnalysisTask.id == task_groups.c.task_id
            ).where(task_groups.c.group_id == group_id)

        total_result = await db.execute(count_query)
        total = len(total_result.scalars().all())

        # Get paginated results
        query = query.order_by(desc(AnalysisTask.created_at))
        query = query.offset((page - 1) * limit).limit(limit)

        result = await db.execute(query)
        tasks = result.scalars().all()

        return list(tasks), total

    @staticmethod
    async def update_task_status(
        db: AsyncSession,
        task_id: str,
        status: str,
        error_message: Optional[str] = None
    ) -> Optional[AnalysisTask]:
        """
        Update task status.

        Args:
            db: Database session
            task_id: Task ID
            status: New status
            error_message: Optional error message

        Returns:
            Updated AnalysisTask or None
        """
        update_values = {"status": status}

        if status == "running":
            update_values["started_at"] = datetime.utcnow()
        elif status in ("completed", "failed"):
            update_values["completed_at"] = datetime.utcnow()

        if error_message:
            update_values["error_message"] = error_message

        await db.execute(
            update(AnalysisTask)
            .where(AnalysisTask.id == task_id)
            .values(**update_values)
        )
        await db.commit()

        return await AnalysisService.get_task(db, task_id)

    @staticmethod
    async def update_task_result(
        db: AsyncSession,
        task_id: str,
        result: AnalysisResult,
        transcript: Optional[str] = None
    ) -> Optional[AnalysisTask]:
        """
        Update task result.

        Args:
            db: Database session
            task_id: Task ID
            result: Analysis result
            transcript: Optional transcript

        Returns:
            Updated AnalysisTask or None
        """
        update_values = {
            "result": result.model_dump() if hasattr(result, 'model_dump') else result,
            "status": "completed",
            "completed_at": datetime.utcnow()
        }

        if transcript:
            update_values["transcript"] = transcript

        await db.execute(
            update(AnalysisTask)
            .where(AnalysisTask.id == task_id)
            .values(**update_values)
        )
        await db.commit()

        return await AnalysisService.get_task(db, task_id)

    @staticmethod
    async def update_transcript(
        db: AsyncSession,
        task_id: str,
        transcript: str
    ) -> Optional[AnalysisTask]:
        """
        Update task transcript.

        Args:
            db: Database session
            task_id: Task ID
            transcript: Transcript text

        Returns:
            Updated AnalysisTask or None
        """
        await db.execute(
            update(AnalysisTask)
            .where(AnalysisTask.id == task_id)
            .values(transcript=transcript)
        )
        await db.commit()

        return await AnalysisService.get_task(db, task_id)

    @staticmethod
    async def delete_task(
        db: AsyncSession,
        task_id: str,
        user_id: str
    ) -> bool:
        """
        Delete a task.

        Args:
            db: Database session
            task_id: Task ID
            user_id: User ID for permission check

        Returns:
            True if deleted, False if not found
        """
        task = await AnalysisService.get_task(db, task_id, user_id)
        if not task:
            return False

        await db.delete(task)
        await db.commit()
        return True

    @staticmethod
    async def update_task(
        db: AsyncSession,
        task_id: str,
        user_id: str,
        group_id: Optional[str] = None,
        is_favorite: Optional[bool] = None
    ) -> bool:
        """
        Update a task (group_id or is_favorite).

        Args:
            db: Database session
            task_id: Task ID
            user_id: User ID for permission check
            group_id: New group ID (None means ungrouped)
            is_favorite: New favorite status

        Returns:
            True if updated, False if not found
        """
        task = await AnalysisService.get_task(db, task_id, user_id)
        if not task:
            return False

        # Handle group_id (many-to-many relationship)
        if group_id is not None:
            from app.models.group import task_groups

            # Remove from all existing groups first
            await db.execute(
                task_groups.delete().where(task_groups.c.task_id == task_id)
            )

            # Add to new group if specified
            if group_id:
                await db.execute(
                    task_groups.insert().values(task_id=task_id, group_id=group_id)
                )

        await db.commit()
        return True

    @staticmethod
    async def regenerate_task(
        db: AsyncSession,
        task_id: str,
        user_id: str
    ) -> Optional[AnalysisTask]:
        """
        Prepare task for regeneration.

        Args:
            db: Database session
            task_id: Task ID
            user_id: User ID for permission check

        Returns:
            Updated AnalysisTask or None
        """
        task = await AnalysisService.get_task(db, task_id, user_id)
        if not task:
            return None

        # Reset status
        await db.execute(
            update(AnalysisTask)
            .where(AnalysisTask.id == task_id)
            .values(
                status="pending",
                result=None,
                error_message=None,
                completed_at=None
            )
        )
        await db.commit()

        return await AnalysisService.get_task(db, task_id)

    @staticmethod
    async def update_queue_info(
        db: AsyncSession,
        task_id: str,
        position: int,
        estimated_wait: int
    ) -> None:
        """
        Update task queue information.

        Args:
            db: Database session
            task_id: Task ID
            position: Queue position
            estimated_wait: Estimated wait seconds
        """
        await db.execute(
            update(AnalysisTask)
            .where(AnalysisTask.id == task_id)
            .values(
                queue_position=position,
                estimated_wait_seconds=estimated_wait
            )
        )
        await db.commit()


# Global analysis service instance
analysis_service = AnalysisService()
