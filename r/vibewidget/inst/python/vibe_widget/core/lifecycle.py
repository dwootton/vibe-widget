"""Lifecycle state handling for Vibe Widgets."""

from __future__ import annotations

from dataclasses import dataclass

from vibe_widget.utils.logging import get_logger

logger = get_logger(__name__)


VALID_STATUSES = {
    "idle",
    "generating",
    "retrying",
    "ready",
    "error",
    "blocked",
}

ALLOWED_TRANSITIONS = {
    "idle": {"generating"},
    "generating": {"ready", "error", "blocked"},
    "ready": {"generating", "retrying", "error", "blocked"},
    "retrying": {"ready", "error", "blocked"},
    "error": {"retrying", "generating", "blocked", "ready"},
    "blocked": {"retrying", "generating", "ready"},
}


@dataclass
class WidgetLifecycle:
    """Lightweight lifecycle guard for widget status transitions."""

    widget: object

    def transition(self, new_status: str, *, force: bool = False) -> None:
        current = getattr(self.widget, "status", "idle")
        if new_status not in VALID_STATUSES:
            logger.warning("Unknown widget status: %s", new_status)
        if not force and current in ALLOWED_TRANSITIONS:
            if new_status not in ALLOWED_TRANSITIONS[current]:
                logger.warning("Unexpected widget status transition: %s -> %s", current, new_status)
        setattr(self.widget, "status", new_status)
