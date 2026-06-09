"""
Queue service for managing analysis task queue.
Uses asyncio.Queue for in-memory queue management.
"""
import asyncio
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Set
from datetime import datetime

from app.config import settings


@dataclass
class QueueTask:
    """Task in the queue."""
    task_id: str
    user_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)


class QueueService:
    """
    Service for managing the analysis task queue.
    Uses asyncio.Queue for in-memory queue management.
    """

    def __init__(self):
        self.max_concurrent = settings.max_concurrent_tasks
        self.max_queue_size = settings.max_queue_size

        # Queue for pending tasks
        self._queue: asyncio.Queue[QueueTask] = asyncio.Queue(maxsize=self.max_queue_size)

        # Set of currently running task IDs
        self._running: Set[str] = set()

        # Lock for thread-safe operations
        self._lock = asyncio.Lock()

        # Average task duration for estimating wait time (in seconds)
        self._avg_task_duration = 300  # 5 minutes default

        # Task duration history for calculating average
        self._task_durations: List[float] = []
        self._max_duration_history = 100

    async def add_task(self, task_id: str, user_id: str) -> Dict[str, any]:
        """
        Add a task to the queue.

        Args:
            task_id: Task ID
            user_id: User ID

        Returns:
            Dict with queue_info if queued, or status info if can run immediately

        Raises:
            asyncio.QueueFull: If queue is full
        """
        async with self._lock:
            # Check if we can run immediately
            if len(self._running) < self.max_concurrent:
                self._running.add(task_id)
                return {
                    "status": "running",
                    "task_id": task_id,
                    "message": "任务立即开始执行"
                }

            # Add to queue
            queue_task = QueueTask(task_id=task_id, user_id=user_id)
            try:
                self._queue.put_nowait(queue_task)
            except asyncio.QueueFull:
                raise asyncio.QueueFull(f"队列已满，最多 {self.max_queue_size} 个任务在等待")

            # Calculate queue info
            position = self._queue.qsize()
            estimated_wait = await self._calculate_wait_time(position)

            return {
                "status": "queued",
                "task_id": task_id,
                "queue_info": {
                    "position": position,
                    "estimated_wait_seconds": estimated_wait,
                    "ahead_count": position - 1
                }
            }

    async def complete_task(self, task_id: str, duration: Optional[float] = None) -> Optional[str]:
        """
        Mark a task as completed and start next task if available.

        Args:
            task_id: Task ID that completed
            duration: Task execution duration in seconds

        Returns:
            Next task ID to run, or None if no tasks in queue
        """
        async with self._lock:
            # Remove from running
            self._running.discard(task_id)

            # Update average duration
            if duration is not None:
                self._update_avg_duration(duration)

            # Get next task from queue
            try:
                next_task = self._queue.get_nowait()
                self._running.add(next_task.task_id)
                return next_task.task_id
            except asyncio.QueueEmpty:
                return None

    async def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a task in the queue.

        Args:
            task_id: Task ID to cancel

        Returns:
            True if cancelled, False if not found
        """
        async with self._lock:
            # Check if running
            if task_id in self._running:
                self._running.discard(task_id)
                return True

            # Check in queue (need to rebuild queue without the task)
            temp_queue = asyncio.Queue(maxsize=self.max_queue_size)
            found = False

            while not self._queue.empty():
                try:
                    task = self._queue.get_nowait()
                    if task.task_id == task_id:
                        found = True
                    else:
                        temp_queue.put_nowait(task)
                except asyncio.QueueEmpty:
                    break

            # Replace queue
            self._queue = temp_queue
            return found

    async def get_queue_info(self, task_id: Optional[str] = None) -> Dict[str, any]:
        """
        Get current queue information.

        Args:
            task_id: Optional task ID to get specific position

        Returns:
            Queue statistics
        """
        async with self._lock:
            queued_count = self._queue.qsize()
            running_count = len(self._running)

            info = {
                "queued_count": queued_count,
                "running_count": running_count,
                "total_tasks": queued_count + running_count,
                "max_concurrent": self.max_concurrent,
                "max_queue_size": self.max_queue_size,
                "avg_task_duration": self._avg_task_duration
            }

            if task_id:
                # Find position of specific task
                position = await self._get_task_position(task_id)
                if position:
                    info["task_info"] = {
                        "task_id": task_id,
                        "position": position,
                        "estimated_wait_seconds": await self._calculate_wait_time(position)
                    }

            return info

    async def _get_task_position(self, task_id: str) -> Optional[int]:
        """Get position of a task in queue."""
        position = 0
        temp_items = []

        # Empty queue to find position
        while not self._queue.empty():
            try:
                task = self._queue.get_nowait()
                temp_items.append(task)
                position += 1
                if task.task_id == task_id:
                    # Put all items back
                    for item in temp_items:
                        try:
                            self._queue.put_nowait(item)
                        except asyncio.QueueFull:
                            pass
                    return position
            except asyncio.QueueEmpty:
                break

        # Put all items back if not found
        for item in temp_items:
            try:
                self._queue.put_nowait(item)
            except asyncio.QueueFull:
                pass

        return None

    async def _calculate_wait_time(self, position: int) -> int:
        """Calculate estimated wait time for a position in queue."""
        async with self._lock:
            # Running tasks will complete first
            running_time = len(self._running) * self._avg_task_duration

            # Then queued tasks ahead
            queue_time = max(0, position - 1) * self._avg_task_duration

            total_wait = running_time + queue_time

            # Return as integer seconds
            return int(total_wait)

    def _update_avg_duration(self, duration: float) -> None:
        """Update average task duration with new data."""
        self._task_durations.append(duration)

        # Keep only recent history
        if len(self._task_durations) > self._max_duration_history:
            self._task_durations = self._task_durations[-self._max_duration_history:]

        # Calculate average
        if self._task_durations:
            self._avg_task_duration = sum(self._task_durations) / len(self._task_durations)

    async def is_full(self) -> bool:
        """Check if queue is full."""
        async with self._lock:
            return self._queue.full()

    async def is_running(self, task_id: str) -> bool:
        """Check if a task is currently running."""
        async with self._lock:
            return task_id in self._running

    async def get_running_tasks(self) -> List[str]:
        """Get list of currently running task IDs."""
        async with self._lock:
            return list(self._running)


# Global queue service instance
queue_service = QueueService()
