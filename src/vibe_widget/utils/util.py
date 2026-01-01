"""
Utility functions for VibeWidget.
Helper functions for data cleaning, serialization, and trait management.
"""
from typing import Any

import pretty_little_summary as pls

from vibe_widget.utils.serialization import (
    clean_for_json,
    initial_import_value,
    load_data,
    prepare_input_for_widget,
)


def summarize_for_prompt(value: Any) -> str:
    """Return a compact summary for prompts using pretty-little-summary."""
    return pls.describe(value)
