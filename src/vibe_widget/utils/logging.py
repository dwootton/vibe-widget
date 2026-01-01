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
    logger = logging.getLogger(name)

    if not _CONFIGURED:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("[%(name)s] %(levelname)s: %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        _CONFIGURED = True

    if level is not None:
        logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    return logger
