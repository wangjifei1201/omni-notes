"""
Server-Sent Events (SSE) utilities.

Uses unnamed events (no 'event:' line) so that the browser EventSource.onmessage
handler fires for every message. The event type is embedded as an "event" field
inside the JSON data payload.
"""
import json
from typing import Dict, Any, Optional


def sse_event(event_type: str, data: Dict[str, Any]) -> str:
    """
    Format data as an unnamed SSE data line.

    The event type is embedded in the JSON so that the frontend can
    dispatch via ``switch(data.event)``.
    """
    payload = {"event": event_type, **data}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def sse_ping() -> str:
    """Generate SSE ping event to keep connection alive."""
    return sse_event("ping", {})


def sse_progress_full(progress_dict: Dict[str, Any]) -> str:
    """
    Generate SSE progress event with full progress snapshot.

    Args:
        progress_dict: Serialized FullTaskProgress dict containing
            status, current_step, steps, download_progress, transcribe_live, etc.
    """
    return sse_event("progress", progress_dict)


def sse_queue_status(
    position: int,
    estimated_wait_seconds: int,
    message: str
) -> str:
    """Generate SSE queue status event."""
    data = {
        "status": "queued",
        "position": position,
        "estimated_wait_seconds": estimated_wait_seconds,
        "message": message
    }
    return sse_event("queue", data)


def sse_completed(result: Optional[Dict[str, Any]] = None) -> str:
    """Generate SSE completed event."""
    data = {"status": "completed"}
    if result:
        data["result"] = result
    return sse_event("completed", data)


def sse_error(message: str, code: Optional[str] = None) -> str:
    """Generate SSE error event."""
    data = {"status": "error", "message": message}
    if code:
        data["code"] = code
    return sse_event("error", data)
