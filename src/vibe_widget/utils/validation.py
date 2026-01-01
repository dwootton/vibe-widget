"""Validation helpers for API inputs."""

from __future__ import annotations

import re


def sanitize_input_name(name: str | None, fallback: str) -> str:
    """Return a stable, identifier-safe name for input bundles."""
    if not name:
        return fallback
    sanitized = re.sub(r"\W+", "_", name).strip("_")
    if not sanitized:
        return fallback
    if sanitized[0].isdigit():
        sanitized = f"input_{sanitized}"
    return sanitized
