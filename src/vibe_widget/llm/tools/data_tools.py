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

    def execute(self, source: Any, sample_size: int = 10000, df: pd.DataFrame | None = None) -> ToolResult:
        """Unified data loader supporting many formats and sources."""
        import os
        from pathlib import Path
        import json as json_lib
        try:
            # Routing logic (from DataProcessor)
            # 1. DataFrame direct
            if isinstance(source, pd.DataFrame) or (isinstance(source, str) and source == "dataframe" and df is not None):
                data = df if df is not None else source
            # 2. Path or string
            elif isinstance(source, (str, Path)):
                source_str = str(source).lower()
                if source_str.startswith(('http://', 'https://')):
                    data = self._load_web(source)
                elif source_str.endswith('.csv') or source_str.endswith('.tsv'):
                    sep = '\t' if source_str.endswith('.tsv') else ','
                    file_size = os.path.getsize(source)
                    if file_size > 50 * 1024 * 1024 and sample_size > 0:
                        data = pd.read_csv(source, sep=sep, nrows=sample_size)
                    else:
                        data = pd.read_csv(source, sep=sep)
                elif source_str.endswith(('.json', '.geojson')):
                    # Use DataProcessor's logic for geojson
                    with open(source, 'r') as f:
                        loaded = json_lib.load(f)
                    if isinstance(loaded, dict) and 'features' in loaded:
                        features = loaded.get('features', [])
                        records = []
                        for feature in features:
                            properties = feature.get('properties', {})
                            geometry = feature.get('geometry', {})
                            record = properties.copy()
                            record['geometry_type'] = geometry.get('type')
                            if geometry.get('coordinates'):
                                record['coordinates'] = geometry.get('coordinates')
                            records.append(record)
                        data = pd.DataFrame(records)
                    elif isinstance(loaded, list):
                        data = pd.DataFrame(loaded)
                    elif isinstance(loaded, dict):
                        data = pd.DataFrame([loaded])
                    else:
                        data = pd.DataFrame()
                elif source_str.endswith('.parquet'):
                    data = pd.read_parquet(source)
                elif source_str.endswith(('.nc', '.nc4', '.netcdf')):
                    try:
                        import xarray as xr
                        ds = xr.open_dataset(source)
                        data = ds.to_dataframe().reset_index()
                    except ImportError:
                        return ToolResult(success=False, output={}, error="xarray required for NetCDF. Install with: pip install xarray netCDF4")
                elif source_str.endswith('.xml'):
                    import xml.etree.ElementTree as ET
                    tree = ET.parse(source)
                    root = tree.getroot()
                    # Try to find repeating elements
                    element_counts = {}
                    for elem in root.iter():
                        tag = elem.tag
                        element_counts[tag] = element_counts.get(tag, 0) + 1
                    element_counts.pop(root.tag, None)
                    records = []
                    if element_counts:
                        row_tag = max(element_counts, key=element_counts.get)
                        for elem in root.iter(row_tag):
                            record = {}
                            for child in elem:
                                tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                                record[tag] = child.text
                            for attr, value in elem.attrib.items():
                                record[f"@{attr}"] = value
                            if record:
                                records.append(record)
                    if not records:
                        record = {}
                        for child in root:
                            tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                            record[tag] = child.text
                        if record:
                            records = [record]
                    data = pd.DataFrame(records) if records else pd.DataFrame()
                elif source_str.endswith('.isf'):
                    # ISF (seismic)
                    events = []
                    current_event = None
                    with open(source, 'r', encoding='utf-8', errors='ignore') as f:
                        for line in f:
                            line = line.strip()
                            if line.startswith('Event '):
                                if current_event:
                                    events.append(current_event)
                                parts = line.split()
                                event_id = parts[1] if len(parts) > 1 else None
                                location = ' '.join(parts[2:]) if len(parts) > 2 else None
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
                                        current_event['depth'] = float(parts[9]) if len(parts) > 9 else None
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
                elif source_str.endswith(('.xlsx', '.xls')):
                    data = pd.read_excel(source)
                elif source_str.endswith('.pdf'):
                    try:
                        import camelot
                    except ImportError:
                        return ToolResult(success=False, output={}, error="camelot-py required for PDF extraction. Install with: pip install 'camelot-py[base]' or 'camelot-py[cv]'")
                    source_path = str(source) if isinstance(source, Path) else source
                    tables = camelot.read_pdf(source_path, pages='all', flavor='lattice')
                    if len(tables) == 0:
                        tables = camelot.read_pdf(source_path, pages='all', flavor='stream')
                    if len(tables) == 0:
                        data = pd.DataFrame()
                    else:
                        df = tables[0].df
                        if len(df) > 0:
                            header_row = df.iloc[0]
                            new_columns = []
                            seen = {}
                            for i, col in enumerate(header_row):
                                col_str = str(col) if pd.notna(col) else f"Column_{i}"
                                if not col_str or col_str.strip() == "":
                                    col_str = f"Column_{i}"
                                if col_str in seen:
                                    seen[col_str] += 1
                                    col_str = f"{col_str}_{seen[col_str]}"
                                else:
                                    seen[col_str] = 0
                                new_columns.append(col_str)
                            df.columns = new_columns
                            df = df[1:].reset_index(drop=True)
                        data = df
                elif source_str.endswith('.txt'):
                    source_path = Path(source) if isinstance(source, str) else source
                    with open(source_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    lines = content.strip().split('\n')
                    if len(lines) > 1:
                        for delimiter in ['\t', '|', ',', ';']:
                            first_line_parts = lines[0].split(delimiter)
                            if len(first_line_parts) > 1:
                                consistent = all(
                                    len(line.split(delimiter)) == len(first_line_parts)
                                    for line in lines[:min(10, len(lines))]
                                )
                                if consistent:
                                    from io import StringIO
                                    data = pd.read_csv(StringIO(content), sep=delimiter)
                                    break
                        else:
                            data = pd.DataFrame({'line': lines})
                    else:
                        data = pd.DataFrame({'line': lines})
                else:
                    return ToolResult(success=False, output={}, error=f"Unsupported file format: {source}. Supported: .csv, .tsv, .json, .geojson, .parquet, .nc, .nc4, .netcdf, .xml, .isf, .xlsx, .xls, .pdf, .txt, web URLs.")
            # 3. Dict (API response)
            elif isinstance(source, dict):
                # GeoJSON
                if 'features' in source:
                    features = source.get('features', [])
                    records = []
                    for feature in features:
                        properties = feature.get('properties', {})
                        geometry = feature.get('geometry', {})
                        record = properties.copy()
                        record['geometry_type'] = geometry.get('type')
                        if geometry.get('coordinates'):
                            record['coordinates'] = geometry.get('coordinates')
                        records.append(record)
                    data = pd.DataFrame(records)
                # API response
                elif any(key in source for key in ['data', 'results', 'items', 'records', 'response']):
                    for key in ['data', 'results', 'items', 'records', 'response']:
                        if key in source and isinstance(source[key], list):
                            data = pd.DataFrame(source[key])
                            break
                    else:
                        data = pd.DataFrame([source])
                else:
                    data = pd.DataFrame([source])
            else:
                return ToolResult(success=False, output={}, error=f"Unsupported data source type: {type(source)}")

            # Apply sampling if needed
            if sample_size > 0 and len(data) > sample_size:
                data = data.sample(n=sample_size, random_state=42)
                sampled = True
            else:
                sampled = False

            # Generate metadata
            metadata = {
                "shape": data.shape,
                "columns": [str(col) for col in data.columns],
                "dtypes": {str(col): str(dtype) for col, dtype in data.dtypes.items()},
                "null_counts": {str(k): v for k, v in data.isnull().sum().to_dict().items()},
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

    # --- Additional loader for web ---
    def _load_web(self, source: str) -> pd.DataFrame:
        try:
            from crawl4ai import AsyncWebCrawler
            import asyncio
        except ImportError:
            raise ImportError(
                "crawl4ai required for web extraction. Install with: pip install crawl4ai"
            )
        async def _crawl_url(url: str):
            async with AsyncWebCrawler() as crawler:
                result = await crawler.arun(url=url)
                return result
        try:
            try:
                loop = asyncio.get_running_loop()
                try:
                    import nest_asyncio
                    nest_asyncio.apply()
                    result = asyncio.run(_crawl_url(source))
                except ImportError:
                    import concurrent.futures
                    def run_in_thread():
                        new_loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(new_loop)
                        try:
                            return new_loop.run_until_complete(_crawl_url(source))
                        finally:
                            new_loop.close()
                    with concurrent.futures.ThreadPoolExecutor() as executor:
                        future = executor.submit(run_in_thread)
                        result = future.result()
            except RuntimeError:
                result = asyncio.run(_crawl_url(source))
        except Exception as e:
            raise ValueError(f"Failed to crawl URL: {source}. Error: {e}")
        if not result.success:
            raise ValueError(f"Failed to crawl URL: {source}")
        html_content = result.html if hasattr(result, 'html') else ""
        try:
            from io import StringIO
            if html_content:
                tables = pd.read_html(StringIO(html_content))
                if tables:
                    return tables[0]
                return self._parse_web_content(html_content, source)
        except Exception:
            pass
        markdown_content = ""
        if hasattr(result, 'markdown'):
            if hasattr(result.markdown, 'raw_markdown'):
                markdown_content = result.markdown.raw_markdown
            elif isinstance(result.markdown, str):
                markdown_content = result.markdown
        return pd.DataFrame({'content': [markdown_content[:5000]] if markdown_content else ['No content']})

    def _parse_web_content(self, html: str, url: str) -> pd.DataFrame:
        try:
            from bs4 import BeautifulSoup
        except ImportError:
            return pd.DataFrame({'content': [html[:1000]]})
        soup = BeautifulSoup(html, 'html.parser')
        if 'news.ycombinator.com' in url or 'hackernews' in url.lower():
            stories = []
            story_rows = soup.find_all('tr', class_='athing')
            for row in story_rows:
                story = {}
                title_elem = row.find('a', class_='titlelink')
                if title_elem:
                    story['title'] = title_elem.get_text(strip=True)
                    story['url'] = title_elem.get('href', '')
                    if story['url'].startswith('item?'):
                        story['url'] = f"https://news.ycombinator.com/{story['url']}"
                next_row = row.find_next_sibling('tr')
                if next_row:
                    score_elem = next_row.find('span', class_='score')
                    if score_elem:
                        score_text = score_elem.get_text(strip=True)
                        try:
                            story['score'] = int(score_text.split()[0])
                        except (ValueError, IndexError):
                            story['score'] = 0
                    else:
                        story['score'] = 0
                    author_elem = next_row.find('a', class_='hnuser')
                    if author_elem:
                        story['author'] = author_elem.get_text(strip=True)
                    time_elem = next_row.find('span', class_='age')
                    if time_elem:
                        story['time'] = time_elem.get('title', time_elem.get_text(strip=True))
                if story.get('title'):
                    stories.append(story)
            if stories:
                return pd.DataFrame(stories)
        lists = soup.find_all(['ul', 'ol'])
        if lists:
            items = []
            for ul in lists[:5]:
                for li in ul.find_all('li', recursive=False):
                    text = li.get_text(strip=True)
                    if text and len(text) > 10:
                        items.append({'item': text})
            if items:
                return pd.DataFrame(items)
        return pd.DataFrame({'content': [soup.get_text(strip=True)[:5000]]})


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

            if not hasattr(self.llm_provider, 'client'):
                return ToolResult(success=False, output={}, error="LLM provider does not support data wrangling.")

            response = self.llm_provider.client.chat.completions.create(
                model=self.llm_provider.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2048,
                temperature=0.3,
            )

            code = self.llm_provider.clean_code(response.choices[0].message.content or "")

            return ToolResult(
                success=True,
                output={"code": code, "language": "python"},
                metadata={"requirements": requirements},
            )

        except Exception as e:
            return ToolResult(success=False, output={}, error=str(e))
