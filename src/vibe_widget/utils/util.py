"""
Utility functions for VibeWidget.
Helper functions for data cleaning, serialization, and trait management.
"""
from pathlib import Path
from typing import Any
import pandas as pd
import numpy as np
from vibe_widget.llm.tools.data_tools import DataLoadTool
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
        return obj


def initial_import_value(import_name: str, import_source: Any) -> Any:
    """
    Extract the initial value from an import source (widget trait or direct value).
    
    Args:
        import_name: Name of the import trait
        import_source: Source widget/trait or direct value
        
    Returns:
        The actual value to use for the import
    """
    if hasattr(import_source, 'value'):
        return import_source.value
    elif hasattr(import_source, import_name):
        trait_value = getattr(import_source, import_name)
        return trait_value.value if hasattr(trait_value, 'value') else trait_value
    else:
        return import_source




def load_data(data: pd.DataFrame | str | Path | None, max_rows: int = 5000) -> pd.DataFrame:
    """Load and prepare data from various sources."""
    if data is None:
        return pd.DataFrame()
    
    if isinstance(data, pd.DataFrame):
        df = data
    else:
        result = DataLoadTool().execute(data)
        if not result.success:
            raise ValueError(f"Failed to load data: {result.error}")
        df = result.output.get("dataframe", pd.DataFrame())
    
    if len(df) > max_rows:
        df = df.sample(max_rows)
    
    return df