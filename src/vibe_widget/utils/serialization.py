"""Serialization helpers for widget inputs/outputs."""

from __future__ import annotations

from pathlib import Path
from typing import Any, TYPE_CHECKING

import numpy as np

from vibe_widget.api import ExportHandle
from vibe_widget.llm.tools.data_tools import DataLoadTool

if TYPE_CHECKING:
    import pandas as pd


def _is_pandas_object(obj: Any) -> tuple[bool, str | None]:
    """Check if obj is a pandas type without importing pandas at module level."""
    obj_type = type(obj).__module__
    if obj_type.startswith("pandas"):
        return True, type(obj).__name__
    return False, None


def _check_pandas_na(obj: Any) -> bool:
    """Check if obj is pandas NA/NaT without importing pandas at module level."""
    import pandas as pd
    return pd.isna(obj)


def clean_for_json(obj: Any) -> Any:
    """Recursively clean data structures for JSON serialization."""
    if isinstance(obj, ExportHandle) or getattr(obj, "__vibe_export__", False):
        try:
            return obj()
        except Exception:
            return str(obj)

    # Check for pandas types without top-level import
    is_pandas, pandas_type = _is_pandas_object(obj)
    if is_pandas:
        if pandas_type == "DataFrame":
            return clean_for_json(obj.to_dict(orient="records"))
        if pandas_type == "Series":
            return clean_for_json(obj.tolist())
        if pandas_type == "Timestamp":
            if _check_pandas_na(obj):
                return None
            return obj.isoformat()

    if isinstance(obj, np.ndarray):
        return clean_for_json(obj.tolist())
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_for_json(item) for item in obj]

    # Check for pandas NA values (NaN, NaT, etc.)
    if is_pandas or (hasattr(obj, "__module__") and "pandas" in str(getattr(obj, "__module__", ""))):
        if _check_pandas_na(obj):
            return None

    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    if hasattr(obj, "isoformat"):
        try:
            return obj.isoformat()
        except (ValueError, AttributeError):
            return str(obj)
    return obj if isinstance(obj, (str, int, float, bool, type(None))) else str(obj)


def prepare_input_for_widget(
    value: Any,
    *,
    max_rows: int | None = None,
    input_name: str | None = None,
    sample: bool = False,
) -> Any:
    """Prepare input values for widget transport."""
    is_pandas, pandas_type = _is_pandas_object(value)
    if is_pandas and pandas_type == "DataFrame":
        return clean_for_json(value.to_dict(orient="records"))
    if isinstance(value, (str, Path)):
        return clean_for_json(value)
    return clean_for_json(value)


def initial_import_value(import_name: str, import_source: Any) -> Any:
    """Extract the initial value from an import source (widget trait or direct value)."""
    if isinstance(import_source, ExportHandle):
        return import_source()
    if hasattr(import_source, "value"):
        return import_source.value
    if hasattr(import_source, import_name):
        trait_value = getattr(import_source, import_name)
        return trait_value.value if hasattr(trait_value, "value") else trait_value
    return import_source


def load_data(data: "pd.DataFrame | str | Path | None", max_rows: int | None = None) -> "pd.DataFrame":
    """Load and prepare data from various sources."""
    import pandas as pd

    if data is None:
        return pd.DataFrame()

    is_pandas, pandas_type = _is_pandas_object(data)
    if is_pandas and pandas_type == "DataFrame":
        df = data
    else:
        result = DataLoadTool().execute(data)
        if not result.success:
            raise ValueError(f"Failed to load data: {result.error}")
        df = result.output.get("dataframe", pd.DataFrame())

    from vibe_widget.config import get_global_config

    if len(df) > 100_000 and not get_global_config().bypass_row_guard:
        raise ValueError(
            "[vibe_widget] We can't support datasets over 100,000 rows yet "
            f"({len(df)} rows received). You can disable this check with "
            "vw.config(bypass_row_guard=True). Please upvote "
            "https://github.com/dwootton/vibe-widget/issues/25 so we can prioritize "
            "large dataset support."
        )

    return df
