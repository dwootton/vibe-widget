"""Centralized logging helpers for Vibe Widgets."""

from __future__ import annotations

import logging

_CONFIGURED = False


def get_logger(name: str = "vibe_widget", level: str | None = None) -> logging.Logger:
    """Return a configured logger with a consistent formatter.

    Args:
        name: Logger name; defaults to the shared vibe_widget namespace.
        level: Optional log level override (e.g., "INFO").
    """
    global _CONFIGURED
    base_logger = logging.getLogger("vibe_widget")

    if not _CONFIGURED:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("[%(name)s] %(levelname)s: %(message)s"))
        if not base_logger.handlers:
            base_logger.addHandler(handler)
        base_logger.setLevel(logging.INFO)
        base_logger.propagate = False
        _CONFIGURED = True

    logger = logging.getLogger(name)
    logger.propagate = True
    if level is not None:
        logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    return logger
