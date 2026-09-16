"""Lightweight debugging helpers for Vibe Widgets."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterable, Any
import inspect
import traceback
import time


def _capture_frame_snapshot(frame) -> dict[str, Any]:
    """Collect locals/globals and a short stack trace from a frame."""
    snapshot: dict[str, Any] = {}
    try:
        snapshot["locals"] = {
            k: v for k, v in (frame.f_locals or {}).items() if not k.startswith("__")
        }
    except Exception:
        snapshot["locals"] = {}
    try:
        snapshot["globals"] = {
            k: v for k, v in (frame.f_globals or {}).items() if not k.startswith("__")
        }
    except Exception:
        snapshot["globals"] = {}
    try:
        raw_stack = traceback.format_stack(frame, limit=8)
        snapshot["stack"] = raw_stack
    except Exception:
        snapshot["stack"] = []
    return snapshot


def debug(
    widget: Any,
    *,
    label: str | None = None,
    capture: Iterable[str] = ("locals", "globals", "stack"),
    pause: bool = False,
) -> dict[str, Any]:
    """
    Capture a Python snapshot and append it to the widget debugger event bus.

    Args:
        widget: VibeWidget instance
        label: Optional label for the snapshot
        capture: Which parts of the frame to capture
        pause: Flag for future step/pause behavior (no-op for now)
    """
    if widget is None:
        raise ValueError("widget is required for vw.debug()")

    frame = inspect.currentframe()
    caller = frame.f_back if frame else None
    snapshot = _capture_frame_snapshot(caller) if caller else {}

    filtered: dict[str, Any] = {"label": label or "snapshot", "pause": pause}
    for key in ("locals", "globals", "stack"):
        if key in capture and key in snapshot:
            filtered[key] = snapshot[key]

    try:
        widget.debug_mode = True
    except Exception:
        pass

    try:
        append = getattr(widget, "_append_debug_event", None)
        if append:
            append(source="python", event_type="snapshot", payload=filtered)
    except Exception:
        pass

    return filtered


@contextmanager
def debug_session(widget: Any, label: str | None = None):
    """Context manager to mark a debug session around a block."""
    token = f"session-{int(time.time() * 1000)}"
    try:
        append = getattr(widget, "_append_debug_event", None)
        if append:
            append(
                source="python",
                event_type="session_start",
                payload={"label": label or "session", "session_id": token},
            )
        yield
        if append:
            append(
                source="python",
                event_type="session_end",
                payload={"label": label or "session", "session_id": token},
            )
    except Exception as exc:
        append = getattr(widget, "_append_debug_event", None)
        if append:
            append(
                source="python",
                event_type="session_error",
                payload={"label": label or "session", "session_id": token, "error": str(exc)},
            )
        raise
