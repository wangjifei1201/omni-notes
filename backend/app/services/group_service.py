"""
Group service for managing user groups.
"""
from datetime import datetime
from typing import Optional, List

from sqlalchemy import select, update, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group, task_groups
from app.models.schemas import GroupCreate, GroupUpdate, GroupResponse


class GroupService:
    """Service for managing user groups."""

    @staticmethod
    async def create_group(
        db: AsyncSession,
        user_id: str,
        name: str
    ) -> Group:
        """
        Create a new group.

        Args:
            db: Database session
            user_id: User ID
            name: Group name

        Returns:
            Created Group
        """
        # Get max sort order
        result = await db.execute(
            select(func.max(Group.sort_order))
            .where(Group.user_id == user_id)
        )
        max_order = result.scalar() or 0

        group = Group(
            user_id=user_id,
            name=name,
            sort_order=max_order + 1,
            created_at=datetime.utcnow()
        )

        db.add(group)
        await db.commit()
        await db.refresh(group)

        return group

    @staticmethod
    async def get_group(
        db: AsyncSession,
        group_id: str,
        user_id: Optional[str] = None
    ) -> Optional[Group]:
        """
        Get group by ID.

        Args:
            db: Database session
            group_id: Group ID
            user_id: Optional user ID for permission check

        Returns:
            Group or None
        """
        query = select(Group).where(Group.id == group_id)

        if user_id:
            query = query.where(Group.user_id == user_id)

        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_groups(
        db: AsyncSession,
        user_id: str
    ) -> List[Group]:
        """
        List all groups for a user.

        Args:
            db: Database session
            user_id: User ID

        Returns:
            List of Groups
        """
        result = await db.execute(
            select(Group)
            .where(Group.user_id == user_id)
            .order_by(Group.sort_order, desc(Group.created_at))
        )
        return list(result.scalars().all())

    @staticmethod
    async def update_group(
        db: AsyncSession,
        group_id: str,
        user_id: str,
        name: Optional[str] = None,
        sort_order: Optional[int] = None
    ) -> Optional[Group]:
        """
        Update a group.

        Args:
            db: Database session
            group_id: Group ID
            user_id: User ID
            name: New name (optional)
            sort_order: New sort order (optional)

        Returns:
            Updated Group or None
        """
        update_values = {}
        if name is not None:
            update_values["name"] = name
        if sort_order is not None:
            update_values["sort_order"] = sort_order

        if not update_values:
            return await GroupService.get_group(db, group_id, user_id)

        await db.execute(
            update(Group)
            .where(Group.id == group_id, Group.user_id == user_id)
            .values(**update_values)
        )
        await db.commit()

        return await GroupService.get_group(db, group_id, user_id)

    @staticmethod
    async def delete_group(
        db: AsyncSession,
        group_id: str,
        user_id: str
    ) -> bool:
        """
        Delete a group.

        Args:
            db: Database session
            group_id: Group ID
            user_id: User ID

        Returns:
            True if deleted, False if not found
        """
        group = await GroupService.get_group(db, group_id, user_id)
        if not group:
            return False

        await db.delete(group)
        await db.commit()
        return True

    @staticmethod
    async def add_task_to_group(
        db: AsyncSession,
        group_id: str,
        task_id: str,
        user_id: str
    ) -> bool:
        """
        Add a task to a group.

        Args:
            db: Database session
            group_id: Group ID
            task_id: Task ID
            user_id: User ID

        Returns:
            True if added, False if already exists
        """
        # Verify group ownership
        group = await GroupService.get_group(db, group_id, user_id)
        if not group:
            raise ValueError("分组不存在")

        # Check if already exists
        result = await db.execute(
            select(task_groups)
            .where(
                task_groups.c.group_id == group_id,
                task_groups.c.task_id == task_id
            )
        )
        if result.fetchone():
            return False  # Already exists

        # Insert
        await db.execute(
            task_groups.insert().values(
                group_id=group_id,
                task_id=task_id
            )
        )
        await db.commit()
        return True

    @staticmethod
    async def remove_task_from_group(
        db: AsyncSession,
        group_id: str,
        task_id: str,
        user_id: str
    ) -> bool:
        """
        Remove a task from a group.

        Args:
            db: Database session
            group_id: Group ID
            task_id: Task ID
            user_id: User ID

        Returns:
            True if removed, False if not found
        """
        # Verify group ownership
        group = await GroupService.get_group(db, group_id, user_id)
        if not group:
            raise ValueError("分组不存在")

        # Delete
        result = await db.execute(
            task_groups.delete()
            .where(
                task_groups.c.group_id == group_id,
                task_groups.c.task_id == task_id
            )
        )
        await db.commit()

        return result.rowcount > 0

    @staticmethod
    async def get_group_item_count(
        db: AsyncSession,
        group_id: str
    ) -> int:
        """
        Get number of tasks in a group.

        Args:
            db: Database session
            group_id: Group ID

        Returns:
            Item count
        """
        result = await db.execute(
            select(func.count())
            .select_from(task_groups)
            .where(task_groups.c.group_id == group_id)
        )
        return result.scalar() or 0

    @staticmethod
    async def reorder_groups(
        db: AsyncSession,
        user_id: str,
        group_orders: List[str]
    ) -> bool:
        """
        Reorder groups by ID list.

        Args:
            db: Database session
            user_id: User ID
            group_orders: List of group IDs in new order

        Returns:
            True if successful
        """
        for index, group_id in enumerate(group_orders):
            await db.execute(
                update(Group)
                .where(Group.id == group_id, Group.user_id == user_id)
                .values(sort_order=index)
            )

        await db.commit()
        return True

    @staticmethod
    async def get_task_groups(
        db: AsyncSession,
        task_id: str,
        user_id: str
    ) -> List[Group]:
        """
        Get all groups a task belongs to.

        Args:
            db: Database session
            task_id: Task ID
            user_id: User ID for permission check

        Returns:
            List of Group objects
        """
        result = await db.execute(
            select(Group)
            .join(task_groups, Group.id == task_groups.c.group_id)
            .where(
                task_groups.c.task_id == task_id,
                Group.user_id == user_id,
            )
            .order_by(Group.sort_order)
        )
        return list(result.scalars().all())


# Global group service instance
group_service = GroupService()
