"""Trace hook for research studies.

Core Vibe Widget only *announces* trace events (prompts, code versions, errors)
here. Nothing is recorded or sent anywhere unless a listener is installed, and
the only listener is the separately installed ``vibe-widget-study`` package
(``pip install vibe-widget-study``), started explicitly with
``vibe_widget_study.start()``.
"""

from __future__ import annotations

from typing import Any, Callable

from vibe_widget.utils.logging import get_logger

logger = get_logger(__name__)

TraceListener = Callable[..., None]
"""Called as ``listener(kind, payload=..., lineage_id=..., version_id=..., parent_version_id=...)``."""

_listener: TraceListener | None = None


def set_listener(listener: TraceListener | None) -> None:
    """Install (or with ``None``, remove) the process-wide trace listener."""
    global _listener
    _listener = listener


def get_listener() -> TraceListener | None:
    """The installed listener, if any."""
    return _listener


def is_active() -> bool:
    """Whether any listener is installed (lets callers skip building payloads)."""
    return _listener is not None


def emit(
    kind: str,
    *,
    payload: dict[str, Any] | None = None,
    lineage_id: str | None = None,
    version_id: str | None = None,
    parent_version_id: str | None = None,
) -> None:
    """Announce a trace event. Never raises into widget code."""
    listener = _listener
    if listener is None:
        return
    try:
        listener(
            kind,
            payload=payload or {},
            lineage_id=lineage_id,
            version_id=version_id,
            parent_version_id=parent_version_id,
        )
    except Exception as exc:
        logger.warning("Trace listener failed on %s: %s", kind, exc)
