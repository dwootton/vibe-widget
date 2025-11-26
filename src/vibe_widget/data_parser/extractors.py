"""
Data extractors for different formats
Each extractor converts a specific format to the unified DataProfile

Design philosophy:
- Extractors only extract STRUCTURAL information (fields, types, ranges, counts)
- NO semantic interpretation (no keyword matching, no domain inference)
- LLM handles ALL semantic understanding (what fields mean, what's temporal/spatial)
"""
from abc import ABC, abstractmethod
from typing import Any
import pandas as pd
import numpy as np
from pathlib import Path
import json
import re

from vibe_widget.data_parser.data_profile import DataProfile, ColumnProfile


class DataExtractor(ABC):
    """Base class for data extractors - focuses on structural extraction only"""
    
    @abstractmethod
    def can_handle(self, source: Any) -> bool:
        """Check if this extractor can handle the given source"""
        pass
    
    @abstractmethod
    def extract(self, source: Any) -> DataProfile:
        """Extract data profile from source"""
        pass
    
    def _infer_dtype(self, series: pd.Series) -> str:
        """
        Classify dtype based ONLY on actual data type, not semantics.
        Returns: numeric, temporal, categorical, or text
        """
        # Explicit temporal types
        if pd.api.types.is_datetime64_any_dtype(series):
            return "temporal"
        
        # Numeric types
        if pd.api.types.is_numeric_dtype(series):
            return "numeric"
        
        # For object types, check if they can be parsed as datetime
        if pd.api.types.is_object_dtype(series):
            try:
                sample = series.dropna().head(100)
                if len(sample) > 0:
                    parsed = pd.to_datetime(sample, errors='coerce')
                    # If >80% parseable as datetime, consider temporal
                    if parsed.notna().sum() / len(sample) > 0.8:
                        return "temporal"
            except:
                pass
            
            # Distinguish categorical vs text by cardinality
            unique_ratio = series.nunique() / len(series) if len(series) > 0 else 0
            if unique_ratio < 0.5:  # Less than 50% unique = categorical
                return "categorical"
            else:
                return "text"
        
        # Default to categorical
        return "categorical"
    
    def _analyze_column(self, series: pd.Series, name: str) -> ColumnProfile:
        """Create column profile from pandas Series"""
        dtype = self._infer_dtype(series)
        
        # Safe conversion to int, handling NaN and edge cases
        def safe_int(value):
            try:
                if pd.isna(value):
                    return 0
                return int(float(value))
            except (ValueError, TypeError):
                return 0
        
        count_val = series.count()
        missing_val = series.isna().sum()
        unique_val = series.nunique()
        
        profile = ColumnProfile(
            name=name,
            dtype=dtype,
            count=safe_int(count_val),
            missing_count=safe_int(missing_val),
            unique_count=safe_int(unique_val)
        )
        
        # Numeric analysis
        if dtype == "numeric":
            profile.min = float(series.min()) if not series.isna().all() else None
            profile.max = float(series.max()) if not series.isna().all() else None
            profile.mean = float(series.mean()) if not series.isna().all() else None
            profile.median = float(series.median()) if not series.isna().all() else None
            profile.std = float(series.std()) if not series.isna().all() else None
            profile.quartiles = series.quantile([0.25, 0.5, 0.75]).tolist() if not series.isna().all() else None
        
        # Categorical analysis
        elif dtype == "categorical":
            value_counts = series.value_counts().head(10)
            profile.top_values = list(zip(value_counts.index.tolist(), value_counts.values.tolist()))
            
            unique_count = series.nunique()
            if unique_count < 10:
                profile.cardinality = "low"
            elif unique_count < 100:
                profile.cardinality = "medium"
            else:
                profile.cardinality = "high"
        
        # Temporal analysis
        elif dtype == "temporal":
            min_date = series.min()
            max_date = series.max()
            if pd.notna(min_date) and pd.notna(max_date):
                profile.temporal_range = (
                    min_date.isoformat() if hasattr(min_date, 'isoformat') else str(min_date),
                    max_date.isoformat() if hasattr(max_date, 'isoformat') else str(max_date)
                )
        
        # Text analysis
        elif dtype == "text":
            profile.avg_length = series.str.len().mean() if series.dtype == object else None
            profile.sample_values = series.dropna().head(3).tolist()
        
        return profile


class DataFrameExtractor(DataExtractor):
    """Extract profile from pandas DataFrame - structural analysis only"""
    
    def can_handle(self, source: Any) -> bool:
        return isinstance(source, pd.DataFrame)
    
    def extract(self, source: pd.DataFrame) -> DataProfile:
        """Extract structural profile without semantic interpretation"""
        profile = DataProfile(
            source_type="dataframe",
            shape=(len(source), len(source.columns)),
            completeness=1 - (source.isna().sum().sum() / (source.shape[0] * source.shape[1])) if source.shape[0] * source.shape[1] > 0 else 1.0
        )
        
        # Analyze each column - ONLY structural properties
        for col in source.columns:
            # Get the column as a Series - handle duplicate column names
            col_data = source[col]
            # If we get a DataFrame (due to duplicate names), take the first column
            if isinstance(col_data, pd.DataFrame):
                col_data = col_data.iloc[:, 0]
            # Ensure we have a Series
            if not isinstance(col_data, pd.Series):
                continue
            col_profile = self._analyze_column(col_data, str(col))
            profile.columns.append(col_profile)
        
        # Sample data for LLM to analyze
        profile.sample_records = source.head(5).to_dict(orient="records")
        
        # NO semantic interpretation here - LLM will determine:
        # - is_timeseries and temporal_column
        # - is_geospatial and coordinate_columns
        # - domain, purpose, etc.
        
        return profile


class NetCDFExtractor(DataExtractor):
    """Extract profile from NetCDF files - structural analysis only"""
    
    def can_handle(self, source: Any) -> bool:
        if isinstance(source, (str, Path)):
            return str(source).endswith(('.nc', '.nc4', '.netcdf'))
        try:
            import xarray as xr
            return isinstance(source, xr.Dataset)
        except ImportError:
            return False
    
    def extract(self, source: Any) -> DataProfile:
        """Extract structural profile from NetCDF without semantic interpretation"""
        try:
            import xarray as xr
        except ImportError:
            raise ImportError("xarray required for NetCDF. Install with: pip install xarray netCDF4")
        
        # Load dataset
        if isinstance(source, (str, Path)):
            ds = xr.open_dataset(source)
            source_uri = str(source)
        else:
            ds = source
            source_uri = None
        
        # Extract dimensions and shape
        shape = tuple(ds.sizes.values())
        
        profile = DataProfile(
            source_type="netcdf",
            shape=shape,
            source_uri=source_uri,
            hierarchical=True,
            dimensions={dim: size for dim, size in ds.sizes.items()},
        )
        
        # Analyze each variable - ONLY structural properties
        for var_name, var in ds.data_vars.items():
            col_profile = ColumnProfile(
                name=var_name,
                dtype=self._infer_xarray_dtype(var),
            )
            
            # Add dimension info (structural)
            col_profile.potential_uses = [f"Dimensions: {', '.join(var.dims)}"]
            
            # Statistical info for numeric variables
            if np.issubdtype(var.dtype, np.number):
                try:
                    col_profile.min = float(var.min().values)
                    col_profile.max = float(var.max().values)
                    col_profile.mean = float(var.mean().values)
                except:
                    pass
            
            # Extract metadata from attributes (structural, not semantic)
            if var.attrs:
                # Store long_name/description if present
                long_name = var.attrs.get('long_name') or var.attrs.get('description')
                if long_name:
                    col_profile.inferred_meaning = long_name
            
            profile.columns.append(col_profile)
        
        # Also add dimensions as potential columns
        for dim_name, dim_var in ds.coords.items():
            if dim_name not in [col.name for col in profile.columns]:
                dim_profile = ColumnProfile(
                    name=dim_name,
                    dtype=self._infer_xarray_dtype(dim_var),
                )
                
                # Add range info for dimension coordinates
                if np.issubdtype(dim_var.dtype, np.number):
                    try:
                        dim_profile.min = float(dim_var.min().values)
                        dim_profile.max = float(dim_var.max().values)
                    except:
                        pass
                
                profile.columns.append(dim_profile)
        
        # Sample data - convert to records for LLM analysis
        try:
            sample_df = ds.isel({list(ds.sizes.keys())[0]: slice(0, 3)}).to_dataframe().reset_index()
            profile.sample_records = sample_df.head(3).to_dict(orient="records")
        except:
            profile.sample_records = None
        
        # NO semantic interpretation - LLM will determine:
        # - is_timeseries, temporal_column, temporal_frequency
        # - is_geospatial, coordinate_columns, crs
        
        return profile
    
    def _infer_xarray_dtype(self, var) -> str:
        """Infer standardized dtype from xarray variable"""
        if np.issubdtype(var.dtype, np.floating) or np.issubdtype(var.dtype, np.integer):
            return "numeric"
        elif np.issubdtype(var.dtype, np.datetime64):
            return "temporal"
        else:
            return "categorical"


class GeoJSONExtractor(DataExtractor):
    """Extract profile from GeoJSON or general JSON data - structural analysis only"""
    
    def can_handle(self, source: Any) -> bool:
        if isinstance(source, (str, Path)):
            path_str = str(source).lower()
            return path_str.endswith(('.geojson', '.json'))
        if isinstance(source, dict):
            return source.get('type') == 'FeatureCollection'
        return False
    
    def extract(self, source: Any) -> DataProfile:
        """Extract structural profile from GeoJSON or general JSON"""
        # Load JSON
        if isinstance(source, (str, Path)):
            with open(source, 'r') as f:
                data = json.load(f)
            source_uri = str(source)
        else:
            data = source
            source_uri = None
        
        # Handle different JSON structures
        if isinstance(data, dict) and 'features' in data:
            # GeoJSON FeatureCollection format
            features = data.get('features', [])
            records = []
            for feature in features:
                properties = feature.get('properties', {})
                geometry = feature.get('geometry', {})
                
                record = properties.copy()
                record['geometry_type'] = geometry.get('type')
                records.append(record)
            df = pd.DataFrame(records)
            is_geojson = True
        elif isinstance(data, list):
            # Plain JSON array of objects
            df = pd.DataFrame(data)
            is_geojson = False
        elif isinstance(data, dict):
            # Single JSON object - convert to single-row DataFrame
            df = pd.DataFrame([data])
            is_geojson = False
        else:
            raise ValueError(f"Unsupported JSON structure: {type(data)}")
        
        # Use DataFrame extractor as base
        df_extractor = DataFrameExtractor()
        profile = df_extractor.extract(df)
        
        # Override with appropriate source type
        profile.source_type = "geojson" if is_geojson else "json"
        profile.source_uri = source_uri
        
        # Add geometry column info (structural) - only for GeoJSON
        if is_geojson and 'geometry_type' in df.columns:
            geom_col = ColumnProfile(
                name="geometry",
                dtype="geospatial",
            )
            
            geom_types = df['geometry_type'].value_counts()
            geom_col.top_values = list(zip(geom_types.index.tolist(), geom_types.values.tolist()))
            
            profile.columns.insert(0, geom_col)
        
        # NO semantic interpretation - LLM will determine geospatial properties
        
        return profile


class CSVExtractor(DataExtractor):
    """Extract profile from CSV files"""
    
    def can_handle(self, source: Any) -> bool:
        if isinstance(source, (str, Path)):
            path_str = str(source).lower()
            return path_str.endswith(('.csv', '.tsv', '.txt'))
        return False
    
    def extract(self, source: Any) -> DataProfile:
        """Extract structural profile from CSV"""
        # Try to infer delimiter
        if str(source).lower().endswith('.tsv'):
            df = pd.read_csv(source, sep='\t', nrows=10000)  # Sample for large files
        else:
            df = pd.read_csv(source, nrows=10000)
        
        # Use DataFrame extractor
        df_extractor = DataFrameExtractor()
        profile = df_extractor.extract(df)
        
        profile.source_type = "csv"
        profile.source_uri = str(source)
        
        return profile


class APIExtractor(DataExtractor):
    """Extract profile from API responses (JSON)"""
    
    def can_handle(self, source: Any) -> bool:
        if isinstance(source, dict):
            # Check if it looks like an API response
            return any(key in source for key in ['data', 'results', 'items', 'records'])
        return False
    
    def extract(self, source: dict) -> DataProfile:
        """Extract structural profile from API response"""
        # Try to find the data array
        data_key = None
        for key in ['data', 'results', 'items', 'records', 'response']:
            if key in source and isinstance(source[key], list):
                data_key = key
                break
        
        if not data_key:
            raise ValueError("Could not find data array in API response")
        
        # Convert to DataFrame
        df = pd.DataFrame(source[data_key])
        
        # Use DataFrame extractor
        df_extractor = DataFrameExtractor()
        profile = df_extractor.extract(df)
        
        profile.source_type = "api_response"
        
        return profile


class ISFExtractor(DataExtractor):
    """Extract profile from ISF (International Seismological Format) files"""
    
    def can_handle(self, source: Any) -> bool:
        if isinstance(source, (str, Path)):
            return str(source).lower().endswith('.isf')
        return False
    
    def extract(self, source: Any) -> DataProfile:
        """Parse ISF format - structural extraction only"""
        source_path = Path(source) if isinstance(source, str) else source
        
        events = []
        current_event = None
        
        # Parse ISF format
        with open(source_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                
                # Event header
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
                
                # Hypocenter line (Date/Time/Lat/Lon/Depth)
                elif line and current_event and len(line.split()) >= 8:
                    parts = line.split()
                    try:
                        # Format: Date Time Err RMS Latitude Longitude Smaj Smin Az Depth
                        if '/' in parts[0] and ':' in parts[1]:  # Date and time
                            current_event['date'] = parts[0]
                            current_event['time'] = parts[1]
                            current_event['latitude'] = float(parts[4]) if len(parts) > 4 else None
                            current_event['longitude'] = float(parts[5]) if len(parts) > 5 else None
                            current_event['depth'] = float(parts[9]) if len(parts) > 9 else None
                    except (ValueError, IndexError):
                        pass
                
                # Magnitude line
                elif line.startswith('mb') or line.startswith('Ms') or line.startswith('Mw'):
                    if current_event:
                        parts = line.split()
                        try:
                            current_event['magnitude'] = float(parts[1]) if len(parts) > 1 else None
                            current_event['magnitude_type'] = parts[0]
                        except (ValueError, IndexError):
                            pass
            
            # Don't forget the last event
            if current_event:
                events.append(current_event)
        
        # Convert to DataFrame
        df = pd.DataFrame(events)
        
        # Parse datetime
        if 'date' in df.columns and 'time' in df.columns:
            df['datetime'] = pd.to_datetime(
                df['date'] + ' ' + df['time'], 
                errors='coerce',
                format='%Y/%m/%d %H:%M:%S.%f'
            )
            df = df.drop(columns=['date', 'time'], errors='ignore')
        
        # Use DataFrame extractor
        df_extractor = DataFrameExtractor()
        profile = df_extractor.extract(df)
        
        profile.source_type = "isf"
        profile.source_uri = str(source_path)
        
        # NO semantic interpretation - LLM will determine:
        # - is_geospatial, coordinate_columns, crs
        # - is_timeseries, temporal_column, temporal_frequency
        # - domain (seismology), purpose, etc.
        
        return profile


class XMLExtractor(DataExtractor):
    """Extract profile from XML files"""
    
    def can_handle(self, source: Any) -> bool:
        if isinstance(source, (str, Path)):
            return str(source).lower().endswith('.xml')
        return False
    
    def extract(self, source: Any) -> DataProfile:
        """Extract structural profile from XML"""
        import xml.etree.ElementTree as ET
        
        source_path = Path(source) if isinstance(source, str) else source
        tree = ET.parse(source_path)
        root = tree.getroot()
        
        # Try to flatten XML to tabular format
        records = []
        
        # Find repeating elements (candidates for rows)
        element_counts = {}
        for elem in root.iter():
            tag = elem.tag
            element_counts[tag] = element_counts.get(tag, 0) + 1
        
        # Find the most common element (likely row-level)
        if element_counts:
            # Exclude root
            element_counts.pop(root.tag, None)
            if element_counts:
                row_tag = max(element_counts, key=element_counts.get)
                
                # Extract records
                for elem in root.iter(row_tag):
                    record = {}
                    # Get all child elements
                    for child in elem:
                        # Remove namespace if present
                        tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                        record[tag] = child.text
                    
                    # Also get attributes
                    for attr, value in elem.attrib.items():
                        record[f"@{attr}"] = value
                    
                    if record:  # Only add non-empty records
                        records.append(record)
        
        # If no records found, extract root attributes and direct children
        if not records:
            record = {}
            for child in root:
                tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                record[tag] = child.text
            if record:
                records = [record]
        
        # Convert to DataFrame
        if records:
            df = pd.DataFrame(records)
        else:
            # Empty XML or cannot parse
            df = pd.DataFrame()
        
        # Use DataFrame extractor
        df_extractor = DataFrameExtractor()
        profile = df_extractor.extract(df)
        
        profile.source_type = "xml"
        profile.source_uri = str(source_path)
        
        return profile


class XLSXExtractor(DataExtractor):
    """Extract profile from Excel files"""
    
    def can_handle(self, source: Any) -> bool:
        if isinstance(source, (str, Path)):
            path_str = str(source).lower()
            return path_str.endswith(('.xlsx', '.xls'))
        return False
    
    def extract(self, source: Any) -> DataProfile:
        """Extract structural profile from Excel"""
        # Read first sheet (or can be extended to handle multiple sheets)
        df = pd.read_excel(source, nrows=10000)
        
        # Use DataFrame extractor
        df_extractor = DataFrameExtractor()
        profile = df_extractor.extract(df)
        
        profile.source_type = "xlsx"
        profile.source_uri = str(source)
        
        return profile


class PDFExtractor(DataExtractor):
    """Extract profile from PDF files (tables) using Camelot"""
    
    def can_handle(self, source: Any) -> bool:
        if isinstance(source, (str, Path)):
            return str(source).lower().endswith('.pdf')
        return False
    
    def extract(self, source: Any) -> DataProfile:
        """Extract structural profile from PDF tables"""
        try:
            import camelot
        except ImportError:
            raise ImportError(
                "camelot-py required for PDF extraction. Install with: "
                "pip install 'camelot-py[base]' or 'camelot-py[cv]'"
            )
        
        source_path = Path(source) if isinstance(source, str) else source
        
        # Extract tables from PDF
        tables = camelot.read_pdf(str(source_path), pages='all', flavor='lattice')
        
        # If no tables found, try stream flavor
        if len(tables) == 0:
            tables = camelot.read_pdf(str(source_path), pages='all', flavor='stream')
        
        if len(tables) == 0:
            raise ValueError(f"No tables found in PDF: {source_path}")
        
        # Use the first table (can be extended to handle multiple tables)
        df = tables[0].df
        
        # First row is often headers
        if len(df) > 0:
            # Get header row and clean it up
            header_row = df.iloc[0]
            # Convert to strings and handle empty/duplicate names
            new_columns = []
            seen = {}
            for i, col in enumerate(header_row):
                # Convert to string, handle NaN/None
                col_str = str(col) if pd.notna(col) else f"Column_{i}"
                # Handle empty strings
                if not col_str or col_str.strip() == "":
                    col_str = f"Column_{i}"
                # Handle duplicates by appending suffix
                if col_str in seen:
                    seen[col_str] += 1
                    col_str = f"{col_str}_{seen[col_str]}"
                else:
                    seen[col_str] = 0
                new_columns.append(col_str)
            
            df.columns = new_columns
            df = df[1:]
            df = df.reset_index(drop=True)
        
        # Use DataFrame extractor
        df_extractor = DataFrameExtractor()
        profile = df_extractor.extract(df)
        
        profile.source_type = "pdf"
        profile.source_uri = str(source_path)
        
        return profile


class WebExtractor(DataExtractor):
    """Extract profile from web URLs using crawl4ai"""
    
    def can_handle(self, source: Any) -> bool:
        if isinstance(source, str):
            # Check if it's a URL
            return source.startswith(('http://', 'https://'))
        return False
    
    def extract(self, source: str) -> DataProfile:
        """Extract structural profile from web content"""
        try:
            from crawl4ai import AsyncWebCrawler
            import asyncio
        except ImportError:
            raise ImportError(
                "crawl4ai required for web extraction. Install with: pip install crawl4ai"
            )
        
        # Helper function to run async crawl
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
                    # If nest_asyncio not available, create a new event loop in a thread
                    import concurrent.futures
                    import threading
                    
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
                # No running event loop, safe to use asyncio.run()
                result = asyncio.run(_crawl_url(source))
        except Exception as e:
            raise ValueError(f"Failed to crawl URL: {source}. Error: {e}")
        
        # Extract structured data if available
        if not result.success:
            raise ValueError(f"Failed to crawl URL: {source}")
        
        # Get HTML content from result
        html_content = result.html if hasattr(result, 'html') else ""
        # Get markdown content - it might be an object with raw_markdown attribute
        if hasattr(result, 'markdown'):
            if hasattr(result.markdown, 'raw_markdown'):
                markdown_content = result.markdown.raw_markdown
            elif isinstance(result.markdown, str):
                markdown_content = result.markdown
            else:
                markdown_content = str(result.markdown)
        else:
            markdown_content = ""
        
        # Try to extract tables from HTML first
        try:
            from io import StringIO
            if html_content:
                tables = pd.read_html(StringIO(html_content))
                if tables:
                    df = tables[0]  # Use first table
                else:
                    # No tables, try to parse structured content (e.g., Hacker News)
                    df = self._parse_web_content(html_content, source)
            else:
                # No HTML, try markdown or create text-based profile
                df = pd.DataFrame({'content': [markdown_content[:5000]] if markdown_content else ['No content extracted']})
        except Exception:
            # Fallback: try to parse structured content
            try:
                if html_content:
                    df = self._parse_web_content(html_content, source)
                else:
                    df = pd.DataFrame({'content': [markdown_content[:5000]] if markdown_content else ['No content extracted']})
            except Exception:
                # Last resort: create a text-based profile
                df = pd.DataFrame({'content': [markdown_content[:5000]] if markdown_content else ['No content extracted']})
        
        # Use DataFrame extractor
        df_extractor = DataFrameExtractor()
        profile = df_extractor.extract(df)
        
        profile.source_type = "web"
        profile.source_uri = source
        
        return profile
    
    def _parse_web_content(self, html: str, url: str) -> pd.DataFrame:
        """
        Parse web content into structured DataFrame.
        Handles common sites like Hacker News, Reddit, etc.
        """
        try:
            from bs4 import BeautifulSoup
        except ImportError:
            # Fallback: return empty DataFrame with content
            return pd.DataFrame({'content': [html[:1000]]})
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Hacker News specific parsing
        if 'news.ycombinator.com' in url or 'hackernews' in url.lower():
            stories = []
            
            # Find all story rows (they have class 'athing')
            story_rows = soup.find_all('tr', class_='athing')
            
            for row in story_rows:
                story = {}
                
                # Find title link
                title_elem = row.find('a', class_='titlelink')
                if title_elem:
                    story['title'] = title_elem.get_text(strip=True)
                    story['url'] = title_elem.get('href', '')
                    if story['url'].startswith('item?'):
                        story['url'] = f"https://news.ycombinator.com/{story['url']}"
                
                # Find score and metadata in next row
                next_row = row.find_next_sibling('tr')
                if next_row:
                    # Score
                    score_elem = next_row.find('span', class_='score')
                    if score_elem:
                        score_text = score_elem.get_text(strip=True)
                        try:
                            story['score'] = int(score_text.split()[0])
                        except (ValueError, IndexError):
                            story['score'] = 0
                    else:
                        story['score'] = 0
                    
                    # Author
                    author_elem = next_row.find('a', class_='hnuser')
                    if author_elem:
                        story['author'] = author_elem.get_text(strip=True)
                    
                    # Time
                    time_elem = next_row.find('span', class_='age')
                    if time_elem:
                        story['time'] = time_elem.get('title', time_elem.get_text(strip=True))
                    
                    # Comments
                    comment_links = next_row.find_all('a', href=lambda x: x and 'item?id=' in x)
                    for link in comment_links:
                        link_text = link.get_text(strip=True)
                        if 'comment' in link_text.lower() or 'discuss' in link_text.lower():
                            try:
                                # Extract number from text like "42 comments"
                                import re
                                nums = re.findall(r'\d+', link_text)
                                if nums:
                                    story['comments'] = int(nums[0])
                                else:
                                    story['comments'] = 0
                            except (ValueError, IndexError):
                                story['comments'] = 0
                            break
                    else:
                        story['comments'] = 0
                
                if story.get('title'):
                    stories.append(story)
            
            if stories:
                return pd.DataFrame(stories)
        
        # Generic parsing: try to find lists or structured content
        # Look for common list patterns
        lists = soup.find_all(['ul', 'ol'])
        if lists:
            items = []
            for ul in lists[:5]:  # Limit to first 5 lists
                for li in ul.find_all('li', recursive=False):
                    text = li.get_text(strip=True)
                    if text and len(text) > 10:  # Filter out very short items
                        items.append({'item': text})
            if items:
                return pd.DataFrame(items)
        
        # Fallback: return content as single row
        return pd.DataFrame({'content': [soup.get_text(strip=True)[:5000]]})


# Registry of extractors (ORDER MATTERS - more specific first)
EXTRACTORS = [
    NetCDFExtractor(),       # .nc, .nc4 files
    ISFExtractor(),          # .isf files
    PDFExtractor(),          # .pdf files
    XLSXExtractor(),         # .xlsx, .xls files
    XMLExtractor(),          # .xml files
    GeoJSONExtractor(),      # .geojson, .json (both GeoJSON and plain JSON formats)
    CSVExtractor(),          # .csv, .tsv files
    WebExtractor(),          # http://, https:// URLs
    APIExtractor(),          # dict with data/results/items keys
    DataFrameExtractor(),    # pandas DataFrame (catch-all)
]


def get_extractor(source: Any) -> DataExtractor:
    """Find appropriate extractor for source"""
    for extractor in EXTRACTORS:
        if extractor.can_handle(source):
            return extractor
    
    raise ValueError(f"No extractor found for source type: {type(source)}")