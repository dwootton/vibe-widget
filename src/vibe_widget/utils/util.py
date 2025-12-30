"""
Utility functions for VibeWidget.
Helper functions for data cleaning, serialization, and trait management.
"""
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import pretty_little_summary as pls
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


def summarize_for_prompt(value: Any) -> str:
    """Return a compact summary for prompts using pretty-little-summary."""
    return pls.describe(value)


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
