"""
Groups router for managing user groups.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_auth
from app.models.schemas import GroupCreate, GroupUpdate, GroupResponse
from app.services.group_service import group_service


router = APIRouter(prefix="/api/v1/groups", tags=["groups"])


class ReorderRequest(BaseModel):
    group_ids: List[str]


@router.get("", response_model=List[GroupResponse])
async def get_groups(
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all groups for the current user.

    **Authentication**: Required
    """
    groups = await group_service.list_groups(db, user.id)

    # Get item counts
    result = []
    for group in groups:
        item_count = await group_service.get_group_item_count(db, group.id)
        result.append(GroupResponse(
            id=group.id,
            name=group.name,
            sort_order=group.sort_order,
            item_count=item_count
        ))

    return result


@router.get("/by-task/{task_id}", response_model=List[GroupResponse])
async def get_task_groups(
    task_id: str,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all groups that a task belongs to.

    **Authentication**: Required
    """
    groups = await group_service.get_task_groups(db, task_id, user.id)
    result = []
    for group in groups:
        item_count = await group_service.get_group_item_count(db, group.id)
        result.append(GroupResponse(
            id=group.id,
            name=group.name,
            sort_order=group.sort_order,
            item_count=item_count
        ))
    return result


@router.post("", response_model=GroupResponse)
async def create_group(
    request: GroupCreate,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new group.

    **Authentication**: Required
    """
    group = await group_service.create_group(db, user.id, request.name)

    return GroupResponse(
        id=group.id,
        name=group.name,
        sort_order=group.sort_order,
        item_count=0
    )


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: str,
    request: GroupUpdate,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a group.

    **Authentication**: Required
    """
    group = await group_service.update_group(
        db,
        group_id,
        user.id,
        name=request.name,
        sort_order=request.sort_order
    )

    if not group:
        raise HTTPException(status_code=404, detail="分组不存在")

    item_count = await group_service.get_group_item_count(db, group.id)

    return GroupResponse(
        id=group.id,
        name=group.name,
        sort_order=group.sort_order,
        item_count=item_count
    )


@router.delete("/{group_id}")
async def delete_group(
    group_id: str,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a group.

    Tasks in the group will not be deleted, just removed from the group.

    **Authentication**: Required
    """
    deleted = await group_service.delete_group(db, group_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="分组不存在")

    return {"success": True, "message": "分组已删除"}


@router.post("/{group_id}/tasks/{task_id}")
async def add_task_to_group(
    group_id: str,
    task_id: str,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a task to a group.

    **Authentication**: Required
    """
    try:
        added = await group_service.add_task_to_group(db, group_id, task_id, user.id)
        if not added:
            return {"success": True, "message": "任务已在分组中"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"success": True, "message": "任务已添加到分组"}


@router.delete("/{group_id}/tasks/{task_id}")
async def remove_task_from_group(
    group_id: str,
    task_id: str,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove a task from a group.

    **Authentication**: Required
    """
    try:
        removed = await group_service.remove_task_from_group(db, group_id, task_id, user.id)
        if not removed:
            raise HTTPException(status_code=404, detail="任务不在该分组中")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"success": True, "message": "任务已从分组移除"}


@router.post("/reorder")
async def reorder_groups(
    request: ReorderRequest,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Reorder groups.

    Provide a list of group IDs in the desired order.

    **Authentication**: Required
    """
    await group_service.reorder_groups(db, user.id, request.group_ids)
    return {"success": True, "message": "分组顺序已更新"}
