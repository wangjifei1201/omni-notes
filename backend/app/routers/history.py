"""
History router for managing user analysis history.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_auth
from app.models.schemas import HistoryListResponse, HistoryItem
from app.services.history_service import history_service
from app.services.analysis_service import analysis_service


router = APIRouter(prefix="/api/v1/history", tags=["history"])


@router.get("", response_model=HistoryListResponse)
async def get_history(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    group_id: Optional[str] = Query(None, description="Filter by group ID"),
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user's analysis history.

    Returns paginated list of completed analysis tasks.

    **Authentication**: Required
    **Query Parameters**:
    - `page`: Page number (default: 1)
    - `limit`: Items per page (default: 20, max: 100)
    - `group_id`: Optional group ID to filter
    """
    print(f"[get_history] user_id={user.id}, page={page}, limit={limit}, group_id={group_id}")

    tasks, total = await history_service.list_history(
        db=db,
        user_id=user.id,
        page=page,
        limit=limit,
        group_id=group_id
    )

    print(f"[get_history] 查询结果: tasks_count={len(tasks)}, total={total}")

    # Convert to HistoryItem
    items = []
    for task in tasks:
        print(f"[get_history] 处理任务: id={task.id}, title={task.title}, status={task.status}")
        item = await history_service.to_history_item(db, task)
        items.append(item)

    print(f"[get_history] 返回 {len(items)} 条历史记录")
    return HistoryListResponse(items=items, total=total)


@router.delete("/{task_id}")
async def delete_history(
    task_id: str,
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a history item.

    **Authentication**: Required
    """
    deleted = await history_service.delete_history(db, task_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="记录不存在")

    return {"success": True, "message": "记录已删除"}


@router.get("/search")
async def search_history(
    keyword: str = Query(..., min_length=1, description="Search keyword"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user = Depends(require_auth),
    db: AsyncSession = Depends(get_db)
):
    """
    Search history by keyword.

    Searches in title, author, and transcript.

    **Authentication**: Required
    """
    tasks, total = await history_service.search_history(
        db=db,
        user_id=user.id,
        keyword=keyword,
        page=page,
        limit=limit
    )

    # Convert to HistoryItem
    items = []
    for task in tasks:
        item = await history_service.to_history_item(db, task)
        items.append(item)

    return HistoryListResponse(items=items, total=total)
