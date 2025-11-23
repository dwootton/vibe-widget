"""Data-related tools for loading, profiling, and wrangling data."""

import json
import pandas as pd
from typing import Any

from vibe_widget.llm.tools.base import Tool, ToolResult


class DataLoadTool(Tool):
    """Tool for loading data from various sources."""

    def __init__(self):
        super().__init__(
            name="data_load",
            description=(
                "Load data from files (CSV, JSON, Parquet, NetCDF (.nc), XML, ISF seismic data) or pandas DataFrame. "
                "Returns basic metadata about loaded data including shape, columns, dtypes. "
                "For large datasets (>10k rows or >50MB files), automatically samples to prevent memory issues."
            ),
        )

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "source": {
                "type": "string",
                "description": "File path to load data from, or 'dataframe' if data is already provided",
                "required": True,
            },
            "sample_size": {
                "type": "integer",
                "description": "Maximum rows to load. Default 10000 for large files. Use -1 for all data.",
                "required": False,
            },
        }

    def execute(self, source: str, sample_size: int = 10000, df: pd.DataFrame | None = None) -> ToolResult:
        """Load data and return metadata."""
        try:
            if source == "dataframe" and df is not None:
                data = df
            elif source.endswith(".csv"):
                # Check file size first
                import os
                file_size = os.path.getsize(source)
                if file_size > 50 * 1024 * 1024 and sample_size > 0:  # 50MB
                    data = pd.read_csv(source, nrows=sample_size)
                else:
                    data = pd.read_csv(source)
            elif source.endswith(".json"):
                data = pd.read_json(source)
            elif source.endswith(".parquet"):
                data = pd.read_parquet(source)
            elif source.endswith(".nc") or source.endswith(".nc4"):
                # NetCDF files
                try:
                    import xarray as xr
                    ds = xr.open_dataset(source)
                    data = ds.to_dataframe().reset_index()
                except ImportError:
                    return ToolResult(
                        success=False,
                        error="xarray required for NetCDF. Install with: pip install xarray netCDF4",
                    )
            elif source.endswith(".xml"):
                # XML files
                import xml.etree.ElementTree as ET
                tree = ET.parse(source)
                root = tree.getroot()
                # Try to convert to records
                records = []
                for child in root:
                    record = {}
                    for elem in child:
                        record[elem.tag] = elem.text
                    records.append(record)
                data = pd.DataFrame(records)
            elif source.endswith(".isf"):
                # ISF (seismic data) files
                events = []
                current_event = None
                
                with open(source, 'r', encoding='utf-8', errors='ignore') as f:
                    for line in f:
                        line = line.strip()
                        
                        if line.startswith('Event '):
                            if current_event:
                                events.append(current_event)
                            event_id = line.split()[1] if len(line.split()) > 1 else None
                            location = ' '.join(line.split()[2:]) if len(line.split()) > 2 else None
                            current_event = {
                                'event_id': event_id,
                                'location': location,
                                'date': None,
                                'time': None,
                                'latitude': None,
                                'longitude': None,
                                'depth': None,
                                'magnitude': None,
                                'magnitude_type': None,
                            }
                        elif line and current_event and len(line.split()) >= 8:
                            parts = line.split()
                            try:
                                if '/' in parts[0] and ':' in parts[1]:
                                    current_event['date'] = parts[0]
                                    current_event['time'] = parts[1]
                                    current_event['latitude'] = float(parts[4]) if len(parts) > 4 else None
                                    current_event['longitude'] = float(parts[5]) if len(parts) > 5 else None
                                    current_event['depth'] = float(parts[8]) if len(parts) > 8 else None
                            except (ValueError, IndexError):
                                pass
                        elif line.startswith(('mb', 'Ms', 'Mw')):
                            if current_event:
                                parts = line.split()
                                try:
                                    current_event['magnitude'] = float(parts[1]) if len(parts) > 1 else None
                                    current_event['magnitude_type'] = parts[0]
                                except (ValueError, IndexError):
                                    pass
                
                if current_event:
                    events.append(current_event)
                
                data = pd.DataFrame(events)
                if 'date' in data.columns and 'time' in data.columns:
                    data['datetime'] = pd.to_datetime(
                        data['date'] + ' ' + data['time'], 
                        errors='coerce',
                        format='%Y/%m/%d %H:%M:%S.%f'
                    )
                    data = data.drop(columns=['date', 'time'], errors='ignore')
            else:
                return ToolResult(
                    success=False,
                    error=f"Unsupported file format: {source}. Supported: .csv, .json, .parquet, .nc, .xml, .isf",
                )

            # Apply sampling if needed
            if sample_size > 0 and len(data) > sample_size:
                data = data.sample(n=sample_size, random_state=42)
                sampled = True
            else:
                sampled = False

            # Generate metadata
            metadata = {
                "shape": data.shape,
                "columns": list(data.columns),
                "dtypes": {col: str(dtype) for col, dtype in data.dtypes.items()},
                "null_counts": data.isnull().sum().to_dict(),
                "sampled": sampled,
                "original_rows": len(df) if df is not None else None,
            }

            # Add sample data (first 5 rows)
            sample_data = data.head(5).to_dict(orient="records")

            output = {
                "metadata": metadata,
                "sample": sample_data,
                "dataframe": data,  # Keep reference for downstream tools
            }

            return ToolResult(success=True, output=output, metadata=metadata)

        except Exception as e:
            return ToolResult(success=False, output={}, error=str(e))


class DataProfileTool(Tool):
    """Tool for generating comprehensive data profile."""

    def __init__(self):
        super().__init__(
            name="data_profile",
            description=(
                "Generate comprehensive profile of dataset including statistical summaries, "
                "data types, missing values, unique values, and data quality insights. "
                "Useful for understanding data before visualization or transformation."
            ),
        )

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "data": {
                "type": "object",
                "description": "Data output from data_load tool",
                "required": True,
            }
        }

    def execute(self, data: dict[str, Any], df: pd.DataFrame | None = None) -> ToolResult:
        """Generate data profile."""
        try:
            # If df is provided directly (from orchestrator), use it
            if df is not None:
                dataframe = df
            else:
                # Otherwise extract from data dict (from previous tool result)
                dataframe = data.get("dataframe")
            
            if dataframe is None:
                return ToolResult(success=False, output={}, error="No dataframe in data")

            profile = {
                "shape": {"rows": len(dataframe), "columns": len(dataframe.columns)},
                "columns": {},
            }

            for col in dataframe.columns:
                col_profile = {
                    "dtype": str(dataframe[col].dtype),
                    "null_count": int(dataframe[col].isnull().sum()),
                    "null_percentage": float(dataframe[col].isnull().sum() / len(dataframe) * 100),
                    "unique_count": int(dataframe[col].nunique()),
                }

                # Add statistics for numeric columns
                if pd.api.types.is_numeric_dtype(dataframe[col]):
                    col_profile["stats"] = {
                        "min": float(dataframe[col].min()) if not dataframe[col].isnull().all() else None,
                        "max": float(dataframe[col].max()) if not dataframe[col].isnull().all() else None,
                        "mean": float(dataframe[col].mean()) if not dataframe[col].isnull().all() else None,
                        "median": float(dataframe[col].median()) if not dataframe[col].isnull().all() else None,
                    }

                # Add sample values
                col_profile["sample_values"] = dataframe[col].dropna().head(3).tolist()

                profile["columns"][col] = col_profile

            return ToolResult(success=True, output=profile, metadata={"dataframe": dataframe})

        except Exception as e:
            return ToolResult(success=False, output={}, error=str(e))


class DataWrangleTool(Tool):
    """Tool for generating Python code to transform/prepare data."""

    def __init__(self, llm_provider):
        super().__init__(
            name="data_wrangle",
            description=(
                "Generate Python pandas code to transform, clean, or prepare data based on requirements. "
                "Returns executable Python code that can be applied to the dataframe. "
                "Use this when data needs filtering, aggregation, reshaping, or feature engineering."
            ),
        )
        self.llm_provider = llm_provider

    @property
    def parameters_schema(self) -> dict[str, Any]:
        return {
            "profile": {
                "type": "object",
                "description": "Data profile from data_profile tool",
                "required": True,
            },
            "requirements": {
                "type": "string",
                "description": "Description of data transformation needed",
                "required": True,
            },
        }

    def execute(self, profile: dict[str, Any], requirements: str) -> ToolResult:
        """Generate data wrangling code."""
        try:
            prompt = f"""Generate Python pandas code to transform data based on requirements.

Data Profile:
{json.dumps(profile, indent=2)}

Requirements:
{requirements}

Generate ONLY executable Python code that:
1. Assumes input dataframe is named 'df'
2. Returns transformed dataframe as 'df'
3. Includes comments explaining each transformation
4. Handles missing values appropriately
5. Preserves data types where possible

Output format:
```python
# Your transformation code here
df = df.copy()
# ... transformations ...
```

Return ONLY the Python code block, no explanations before or after.
"""

            # Use LLM to generate code
            from anthropic import Anthropic

            client = Anthropic(api_key=self.llm_provider.api_key)
            message = client.messages.create(
                model=self.llm_provider.model,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )

            code = message.content[0].text
            # Clean code
            code = code.replace("```python", "").replace("```", "").strip()

            return ToolResult(
                success=True,
                output={"code": code, "language": "python"},
                metadata={"requirements": requirements},
            )

        except Exception as e:
            return ToolResult(success=False, output={}, error=str(e))
