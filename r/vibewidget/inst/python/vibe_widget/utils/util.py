"""
Utility functions for VibeWidget.
Helper functions for data cleaning, serialization, and trait management.
"""

from __future__ import annotations

import json
from typing import Any

from vibe_widget.utils.serialization import (
    _is_pandas_object,
    clean_for_json,
    initial_import_value,
    load_data,
    prepare_input_for_widget,
)

__all__ = [
    "clean_for_json",
    "initial_import_value",
    "load_data",
    "prepare_input_for_widget",
    "summarize_for_prompt",
]

MAX_REPR_CHARS = 200


def summarize_for_prompt(
    value: Any,
    *,
    privacy: str | None = None,
    sample_rows: int | None = None,
) -> str:
    """Return a compact summary of a value for prompts, honouring the privacy config."""
    if privacy is None or sample_rows is None:
        from vibe_widget.config import get_global_config

        config = get_global_config()
        if privacy is None:
            privacy = getattr(config, "data_privacy", "sample")
        if sample_rows is None:
            sample_rows = getattr(config, "sample_rows", 3)
    # Any unknown privacy value falls back to the disclosure-free summary.
    include_values = privacy == "sample"

    is_pandas, pandas_type = _is_pandas_object(value)
    if is_pandas and pandas_type in ("DataFrame", "Series"):
        return _summarize_frame(value, pandas_type, include_values, int(sample_rows))
    return _summarize_object(value, include_values)


def _summarize_frame(frame: Any, pandas_type: str, include_values: bool, sample_rows: int) -> str:
    """Summarize a DataFrame or Series as shape, per-column schema and optional head rows."""
    df = frame.to_frame() if pandas_type == "Series" else frame
    lines = [f"pandas.{pandas_type}: {len(df)} rows x {len(df.columns)} columns", "Columns:"]
    lines.extend(f"- {name}: {_describe_column(column)}" for name, column in df.items())

    if include_values and sample_rows > 0 and len(df) > 0:
        rows = clean_for_json(df.head(sample_rows).to_dict(orient="records"))
        lines.append(f"First {len(rows)} rows:")
        lines.extend(json.dumps(row, default=str) for row in rows)
    return "\n".join(lines)


def _describe_column(column: Any) -> str:
    """Describe one column as dtype, null count, cardinality and numeric range."""
    import pandas as pd

    parts = [f"dtype {column.dtype}", f"nulls {int(column.isna().sum())}"]
    try:
        parts.append(f"nunique {int(column.nunique())}")
    except TypeError:
        parts.append(f"nunique {int(column.map(repr).nunique())}")
    if pd.api.types.is_numeric_dtype(column) and bool(column.notna().any()):
        parts.append(f"min {_round(column.min())}")
        parts.append(f"max {_round(column.max())}")
        parts.append(f"mean {_round(column.mean())}")
    return ", ".join(parts)


def _round(value: Any) -> Any:
    """Round a numeric summary statistic, leaving anything non-float untouched."""
    try:
        return round(float(value), 4)
    except (TypeError, ValueError):
        return value


def _summarize_object(value: Any, include_values: bool) -> str:
    """Summarize a non-tabular value as type plus shape or length."""
    value_type = type(value)
    name = (
        value_type.__name__
        if value_type.__module__ == "builtins"
        else f"{value_type.__module__}.{value_type.__name__}"
    )
    parts = [name]
    shape = getattr(value, "shape", None)
    if shape is not None:
        parts.append(f"shape {tuple(shape)}")
    else:
        try:
            parts.append(f"len {len(value)}")
        except TypeError:
            pass
    if include_values:
        text = repr(value)
        if len(text) > MAX_REPR_CHARS:
            text = text[:MAX_REPR_CHARS] + "..."
        parts.append(f"value {text}")
    return ", ".join(parts)
