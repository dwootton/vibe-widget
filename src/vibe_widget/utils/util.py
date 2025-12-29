"""
Utility functions for VibeWidget.
Helper functions for data cleaning, serialization, and trait management.
"""
from pathlib import Path
from typing import Any
import pandas as pd
import numpy as np
from vibe_widget.llm.tools.data_tools import DataLoadTool
from vibe_widget.api import ExportHandle
from vibe_widget.config import Config, get_global_config


def clean_for_json(obj: Any) -> Any:
    """
    Recursively clean data structures for JSON serialization.
    Converts NaT, NaN, and other non-JSON-serializable values to None.
    
    Args:
        obj: Any Python object to clean
        
    Returns:
        JSON-serializable version of the object
    """
    if isinstance(obj, ExportHandle) or getattr(obj, "__vibe_export__", False):
        try:
            return obj()
        except Exception:
            return str(obj)
    if isinstance(obj, pd.DataFrame):
        return clean_for_json(obj.to_dict(orient="records"))
    if isinstance(obj, pd.Series):
        return clean_for_json(obj.tolist())
    if isinstance(obj, np.ndarray):
        return clean_for_json(obj.tolist())
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_for_json(item) for item in obj]
    elif isinstance(obj, pd.Timestamp):
        if pd.isna(obj):
            return None
        return obj.isoformat()
    elif pd.isna(obj):
        return None
    elif isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return None
    elif hasattr(obj, 'isoformat'):
        try:
            return obj.isoformat()
        except (ValueError, AttributeError):
            return str(obj)
    else:
        # Fallback: best-effort string conversion to keep serialization robust
        return obj if isinstance(obj, (str, int, float, bool, type(None))) else str(obj)


def _truncate_text(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


def _safe_repr(obj: Any, max_len: int) -> str:
    try:
        return _truncate_text(repr(obj), max_len)
    except Exception:
        return _truncate_text(str(obj), max_len)


def summarize_for_prompt(
    value: Any,
    *,
    max_depth: int = 2,
    max_items: int = 5,
    max_str: int = 200,
    _seen: set[int] | None = None,
) -> str:
    """Return a compact, type-aware summary of a Python value for prompts."""
    if _seen is None:
        _seen = set()
    track = not isinstance(value, (str, bytes, int, float, bool, type(None)))
    if track:
        obj_id = id(value)
        if obj_id in _seen:
            return "recursive"
        _seen.add(obj_id)

    if isinstance(value, ExportHandle) or getattr(value, "__vibe_export__", False):
        try:
            value = value()
        except Exception:
            return "ExportHandle(unresolved)"

    if value is None:
        return "None"

    if isinstance(value, pd.DataFrame):
        cols = [str(c) for c in value.columns[:max_items]]
        col_suffix = "..." if len(value.columns) > max_items else ""
        return f"DataFrame(shape={value.shape}, columns={cols}{col_suffix})"

    if isinstance(value, pd.Series):
        return f"Series(len={len(value)}, dtype={value.dtype}, name={value.name})"

    if isinstance(value, np.ndarray):
        return f"ndarray(shape={value.shape}, dtype={value.dtype})"

    if isinstance(value, dict):
        keys = list(value.keys())
        key_samples = [_safe_repr(k, 60) for k in keys[:max_items]]
        key_suffix = "..." if len(keys) > max_items else ""
        if max_depth <= 0:
            return f"dict(len={len(keys)}, keys={key_samples}{key_suffix})"
        sample_items = []
        for k in keys[:max_items]:
            sample_items.append(
                f"{_safe_repr(k, 60)}: "
                f"{summarize_for_prompt(value[k], max_depth=max_depth-1, max_items=max_items, max_str=max_str, _seen=_seen)}"
            )
        sample_suffix = "..." if len(keys) > max_items else ""
        sample_text = ", ".join(sample_items) + (", " + sample_suffix if sample_suffix else "")
        return f"dict(len={len(keys)}, sample={{ {sample_text} }})"

    if isinstance(value, (list, tuple)):
        kind = "list" if isinstance(value, list) else "tuple"
        if max_depth <= 0:
            return f"{kind}(len={len(value)})"
        sample_values = [
            summarize_for_prompt(v, max_depth=max_depth-1, max_items=max_items, max_str=max_str, _seen=_seen)
            for v in value[:max_items]
        ]
        suffix = "..." if len(value) > max_items else ""
        return f"{kind}(len={len(value)}, sample=[{', '.join(sample_values)}{suffix}])"

    if isinstance(value, set):
        sample = list(value)[:max_items]
        sample_values = [
            summarize_for_prompt(v, max_depth=max_depth-1, max_items=max_items, max_str=max_str, _seen=_seen)
            for v in sample
        ]
        suffix = "..." if len(value) > max_items else ""
        return f"set(len={len(value)}, sample=[{', '.join(sample_values)}{suffix}])"

    if isinstance(value, str):
        return f"str(len={len(value)}, value={_safe_repr(value, max_str)})"

    if isinstance(value, bytes):
        return f"bytes(len={len(value)})"

    if isinstance(value, (int, float, bool)):
        return f"{type(value).__name__}({_safe_repr(value, max_str)})"

    if hasattr(value, "shape") and hasattr(value, "dtype"):
        try:
            return f"{type(value).__name__}(shape={value.shape}, dtype={value.dtype})"
        except Exception:
            pass

    return f"{type(value).__name__}({_safe_repr(value, max_str)})"


def initial_import_value(import_name: str, import_source: Any) -> Any:
    """
    Extract the initial value from an import source (widget trait or direct value).
    
    Args:
        import_name: Name of the import trait
        import_source: Source widget/trait or direct value
        
    Returns:
        The actual value to use for the import
    """
    if isinstance(import_source, ExportHandle):
        return import_source()
    if hasattr(import_source, 'value'):
        return import_source.value
    elif hasattr(import_source, import_name):
        trait_value = getattr(import_source, import_name)
        return trait_value.value if hasattr(trait_value, 'value') else trait_value
    else:
        return import_source




def load_data(data: pd.DataFrame | str | Path | None, max_rows: int = 5000) -> pd.DataFrame:
    """Load and prepare data from various sources."""
    debug_inputs = False
    try:
        import os

        debug_inputs = os.getenv("VIBE_WIDGET_DEBUG_INPUTS") == "1"
    except Exception:
        debug_inputs = False
    if data is None:
        if debug_inputs:
            print("[vibe_widget][debug] load_data: data is None")
        return pd.DataFrame()
    
    if isinstance(data, pd.DataFrame):
        df = data
        if debug_inputs:
            print("[vibe_widget][debug] load_data: dataframe", {"shape": df.shape})
    else:
        if debug_inputs:
            print("[vibe_widget][debug] load_data: non-dataframe", {"type": type(data).__name__})
        result = DataLoadTool().execute(data)
        if not result.success:
            raise ValueError(f"Failed to load data: {result.error}")
        df = result.output.get("dataframe", pd.DataFrame())
    
    if len(df) > max_rows:
        df = df.sample(max_rows)
    
    return df
