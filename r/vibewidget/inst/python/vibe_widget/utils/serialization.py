"""Serialization helpers for widget inputs/outputs."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Any

import numpy as np

from vibe_widget.api import ExportHandle
from vibe_widget.llm.tools.data_tools import DataLoadTool

if TYPE_CHECKING:
    from pathlib import Path

    import pandas as pd

DEFAULT_SAMPLE_MAX_ROWS = 1000


def _is_pandas_object(obj: Any) -> tuple[bool, str | None]:
    """Check if obj is a pandas type without importing pandas at module level."""
    obj_type = type(obj).__module__
    if obj_type.startswith("pandas"):
        return True, type(obj).__name__
    return False, None


def _check_pandas_na(obj: Any) -> bool:
    """Check if obj is a pandas NA/NaT scalar without importing pandas at module level."""
    import pandas as pd

    return bool(pd.isna(obj))


def clean_for_json(obj: Any) -> Any:
    """Recursively clean data structures for JSON serialization."""
    if isinstance(obj, ExportHandle) or getattr(obj, "__vibe_export__", False):
        try:
            return obj()
        except Exception:
            return str(obj)

    if isinstance(obj, np.ndarray):
        return clean_for_json(obj.tolist())
    if isinstance(obj, np.generic):
        if isinstance(obj, (np.datetime64, np.timedelta64)):
            return None if np.isnat(obj) else str(obj)
        return clean_for_json(obj.item())

    is_pandas, pandas_type = _is_pandas_object(obj)
    if is_pandas:
        if pandas_type == "DataFrame":
            return clean_for_json(obj.to_dict(orient="records"))
        if hasattr(obj, "tolist"):
            return clean_for_json(obj.tolist())
        if _check_pandas_na(obj):
            return None
        if hasattr(obj, "isoformat"):
            return obj.isoformat()
        return str(obj)

    if isinstance(obj, dict):
        return {(k if isinstance(k, str) else str(k)): clean_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set, frozenset)):
        return [clean_for_json(item) for item in obj]
    if isinstance(obj, (bytes, bytearray)):
        return bytes(obj).decode("utf-8", "replace")
    if isinstance(obj, Decimal):
        return float(obj) if obj.is_finite() else None

    if obj is None or isinstance(obj, (bool, str)):
        return obj
    if isinstance(obj, int):
        # ponytail: ints above 2**53 lose precision once JSON.parse sees them in the
        # browser; pass them through so Python-side round-trips stay exact, switch to a
        # BigInt-aware envelope if a widget ever needs exact large ints in JS.
        return obj
    if isinstance(obj, float):
        return None if (np.isnan(obj) or np.isinf(obj)) else obj
    if hasattr(obj, "isoformat"):
        try:
            return obj.isoformat()
        except (ValueError, AttributeError):
            return str(obj)
    return str(obj)


def _stride_sample(frame: Any, max_rows: int) -> Any:
    """Return at most max_rows evenly strided rows in order, always including the first row.

    The last row is included whenever max_rows is 2 or more; max_rows below 1 is treated as 1.
    """
    n = len(frame)
    max_rows = max(1, max_rows)
    if n <= max_rows:
        return frame
    positions = np.unique(np.linspace(0, n - 1, num=max_rows).round().astype(int))
    return frame.iloc[positions]


def _check_row_guard(rows: int, label: str) -> None:
    """Raise if an unsampled input exceeds the supported row count."""
    from vibe_widget.config import get_global_config

    if rows <= 100_000 or get_global_config().bypass_row_guard:
        return
    raise ValueError(
        f"[vibe_widget] We can't support datasets over 100,000 rows yet "
        f"({rows} rows received for {label}). You can disable this check with "
        "vw.config(bypass_row_guard=True). Please upvote "
        "https://github.com/dwootton/vibe-widget/issues/25 so we can prioritize "
        "large dataset support."
    )


def prepare_input_for_widget(
    value: Any,
    *,
    max_rows: int | None = None,
    input_name: str | None = None,
    sample: bool = False,
) -> Any:
    """Prepare input values for widget transport, optionally strided down to max_rows."""
    is_pandas, pandas_type = _is_pandas_object(value)
    if is_pandas and pandas_type in ("DataFrame", "Series"):
        if sample:
            limit = DEFAULT_SAMPLE_MAX_ROWS if max_rows is None else max_rows
            value = _stride_sample(value, limit)
        else:
            _check_row_guard(len(value), f"input '{input_name}'" if input_name else "this input")
        if pandas_type == "DataFrame":
            return clean_for_json(value.to_dict(orient="records"))
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


def load_data(data: pd.DataFrame | str | Path | None, max_rows: int | None = None) -> pd.DataFrame:
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

    _check_row_guard(len(df), "data")
    return df
