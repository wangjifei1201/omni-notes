"""
Progress service for managing analysis task progress.
Uses in-memory storage with automatic cleanup.

Mirrors server.js progress structure: multi-step state with
real-time download/transcribe sub-progress.
"""
import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, Optional, Any, List


@dataclass
class StepInfo:
    """Status information for a single pipeline step."""
    status: str = "pending"  # pending / running / completed / error / skipped
    start_time: Optional[float] = None
    end_time: Optional[float] = None


@dataclass
class FullTaskProgress:
    """
    Rich progress object that mirrors the server.js analysisProgress structure.

    Contains per-step state *and* real-time sub-progress for download & transcribe.
    """
    task_id: str
    status: str = "running"           # running / completed / error / no_subtitle
    current_step: str = "extract"     # which step is currently active
    steps: Dict[str, StepInfo] = field(default_factory=dict)
    # Real-time sub-progress (set during download / transcribe)
    download_progress: Optional[Dict[str, Any]] = None   # {percent, size, speed, text}
    transcribe_live: Optional[Dict[str, Any]] = None     # {percent, time, text}
    start_time: float = field(default_factory=time.time)
    error: Optional[str] = None
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize for SSE transmission."""
        steps_dict = {}
        for name, info in self.steps.items():
            steps_dict[name] = {
                "status": info.status,
                "start_time": info.start_time,
                "end_time": info.end_time,
            }

        result: Dict[str, Any] = {
            "status": self.status,
            "current_step": self.current_step,
            "steps": steps_dict,
        }

        if self.download_progress:
            result["download_progress"] = self.download_progress
        if self.transcribe_live:
            result["transcribe_live"] = self.transcribe_live
        if self.error:
            result["error"] = self.error

        return result


STEP_NAMES = ["extract", "download", "transcribe", "analyze"]


class ProgressService:
    """
    Service for managing task progress.
    Uses in-memory storage with automatic cleanup.
    """

    def __init__(self):
        self._progress: Dict[str, FullTaskProgress] = {}
        self._lock = asyncio.Lock()
        # Cleanup settings
        self._cleanup_interval = 3600
        self._retention_time = 3600
        self._max_entries = 1000
        self._cleanup_task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start_cleanup_task(self) -> None:
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop_cleanup_task(self) -> None:
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

    async def _cleanup_loop(self) -> None:
        while True:
            try:
                await asyncio.sleep(self._cleanup_interval)
                await self._cleanup_old_entries()
            except asyncio.CancelledError:
                break
            except Exception:
                pass

    async def _cleanup_old_entries(self) -> int:
        async with self._lock:
            now = datetime.utcnow()
            to_remove = []
            for task_id, prog in self._progress.items():
                if prog.status in ("completed", "error"):
                    age = (now - prog.updated_at).total_seconds()
                    if age > self._retention_time:
                        to_remove.append(task_id)
            for task_id in to_remove:
                del self._progress[task_id]
            # Cap max entries
            if len(self._progress) > self._max_entries:
                sorted_items = sorted(
                    self._progress.items(),
                    key=lambda x: x[1].updated_at
                )
                for task_id, _ in sorted_items[: len(self._progress) - self._max_entries]:
                    del self._progress[task_id]
            return len(to_remove)

    # ------------------------------------------------------------------
    # Init / query
    # ------------------------------------------------------------------

    async def init_progress(self, task_id: str) -> FullTaskProgress:
        """Initialize progress for a new task (all 4 steps pending)."""
        async with self._lock:
            prog = FullTaskProgress(
                task_id=task_id,
                steps={name: StepInfo() for name in STEP_NAMES},
            )
            self._progress[task_id] = prog
            print(f"[DEBUG] init_progress: task_id={task_id}, current_step={prog.current_step}")
            return prog

    async def get_progress(self, task_id: str) -> Optional[FullTaskProgress]:
        """Return the full progress object (or None)."""
        async with self._lock:
            prog = self._progress.get(task_id)
            print(f"[DEBUG] progress_service.get_progress: task_id={task_id}, progress={prog}")
            if prog:
                print(f"[DEBUG] progress.current_step={prog.current_step}, status={prog.status}")
            return prog

    async def get_progress_dict(self, task_id: str) -> Dict[str, Any]:
        """Return serialized progress dict for SSE."""
        async with self._lock:
            prog = self._progress.get(task_id)
            if prog:
                return prog.to_dict()
            return {"status": "unknown", "current_step": "unknown", "steps": {}}

    # ------------------------------------------------------------------
    # Step transitions
    # ------------------------------------------------------------------

    async def update_step(self, task_id: str, step: str, status: str) -> None:
        """
        Update a step's status and automatically manage timestamps
        and current_step pointer.
        """
        async with self._lock:
            prog = self._progress.get(task_id)
            if not prog:
                print(f"[DEBUG] update_step: task_id={task_id}, step={step}, status={status} - PROGRESS NOT FOUND")
                return
            info = prog.steps.get(step)
            if not info:
                print(f"[DEBUG] update_step: task_id={task_id}, step={step}, status={status} - STEP NOT FOUND")
                return

            print(f"[DEBUG] update_step: task_id={task_id}, step={step}, status={status}")
            info.status = status
            now = time.time()

            if status == "running":
                info.start_time = now
                prog.current_step = step
                print(f"[DEBUG]   -> current_step set to {step}")
            elif status in ("completed", "skipped"):
                info.end_time = now
                if not info.start_time:
                    info.start_time = now
                # When a step is completed/skipped, advance current_step to next step
                step_index = STEP_NAMES.index(step) if step in STEP_NAMES else -1
                if step_index >= 0 and step_index < len(STEP_NAMES) - 1:
                    prog.current_step = STEP_NAMES[step_index + 1]
                    print(f"[DEBUG]   -> step completed/skipped, current_step advanced to {STEP_NAMES[step_index + 1]}")
            elif status == "error":
                info.end_time = now

            prog.updated_at = datetime.utcnow()

    # ------------------------------------------------------------------
    # Sub-progress updates (real-time)
    # ------------------------------------------------------------------

    async def update_download_progress(
        self,
        task_id: str,
        percent: float,
        size: Optional[str] = None,
        speed: Optional[str] = None,
        text: Optional[str] = None,
    ) -> None:
        async with self._lock:
            prog = self._progress.get(task_id)
            if prog:
                prog.download_progress = {
                    "percent": percent,
                    "size": size,
                    "speed": speed,
                    "text": text,
                }
                prog.updated_at = datetime.utcnow()

    async def update_transcribe_live(
        self,
        task_id: str,
        percent: int,
        time_str: Optional[str] = None,
        text: Optional[str] = None,
    ) -> None:
        async with self._lock:
            prog = self._progress.get(task_id)
            if prog:
                prog.transcribe_live = {
                    "percent": percent,
                    "time": time_str,
                    "text": text,
                }
                prog.updated_at = datetime.utcnow()

    # ------------------------------------------------------------------
    # Terminal states
    # ------------------------------------------------------------------

    async def mark_completed(self, task_id: str) -> None:
        async with self._lock:
            prog = self._progress.get(task_id)
            if prog:
                prog.status = "completed"
                prog.updated_at = datetime.utcnow()

    async def mark_error(self, task_id: str, error_msg: str) -> None:
        async with self._lock:
            prog = self._progress.get(task_id)
            if prog:
                prog.status = "error"
                prog.error = error_msg
                prog.updated_at = datetime.utcnow()

    # ------------------------------------------------------------------
    # Housekeeping
    # ------------------------------------------------------------------

    async def delete_progress(self, task_id: str) -> bool:
        async with self._lock:
            if task_id in self._progress:
                del self._progress[task_id]
                return True
            return False

    async def get_all_progress(self) -> List[FullTaskProgress]:
        async with self._lock:
            return list(self._progress.values())

    async def clear_all(self) -> int:
        async with self._lock:
            count = len(self._progress)
            self._progress.clear()
            return count


# Global progress service instance
progress_service = ProgressService()
