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
    reserved = {
        "description",
        "df",
        "model",
        "exports",
        "imports",
        "theme",
        "var_name",
        "input_sampling",
        "base_code",
        "base_components",
        "base_widget_id",
        "existing_code",
        "existing_metadata",
        "display_widget",
        "cache",
        "execution_mode",
        "execution_approved",
        "execution_approved_hash",
    }
    if sanitized in reserved:
        return fallback
    return sanitized
