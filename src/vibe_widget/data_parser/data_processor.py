"""
Unified Data Processor - handles all data loading and parsing.
No LLM calls - purely Python-based processing.
Routes data to appropriate extractors based on type.
Returns DataFrame only - agent system handles data understanding.
"""
from pathlib import Path
from typing import Any
import pandas as pd


class DataProcessor:
    """
    Unified data processor that handles all data formats.
    Routes to appropriate extractors and returns DataFrame.
    """
    
    def process(self, source: Any) -> pd.DataFrame:
        """
        Process data source into DataFrame.
        
        No LLM calls - purely Python-based processing.
        Agent system will analyze and understand the data.
        
        Args:
            source: Data source - can be:
                - pd.DataFrame
                - str/Path to file (csv, json, xml, netcdf, isf, xlsx, pdf, txt)
                - str URL (http://, https://)
                - dict (API response)
        
        Returns:
            DataFrame ready for visualization
        """
        source_type = self._determine_source_type(source)
        
        if source_type == "dataframe":
            return source
        elif source_type == "csv":
            return self._load_csv(source)
        elif source_type == "json":
            return self._load_json(source)
        elif source_type == "netcdf":
            return self._load_netcdf(source)
        elif source_type == "xml":
            return self._load_xml(source)
        elif source_type == "isf":
            return self._load_isf(source)
        elif source_type == "xlsx":
            return self._load_xlsx(source)
        elif source_type == "pdf":
            return self._load_pdf(source)
        elif source_type == "web":
            return self._load_web(source)
        elif source_type == "txt":
            return self._load_txt(source)
        elif source_type == "api_response":
            return self._load_api_response(source)
        else:
            raise ValueError(f"Unsupported source type: {source_type}")
    
    def _determine_source_type(self, source: Any) -> str:
        """Determine the type of data source."""
        if isinstance(source, pd.DataFrame):
            return "dataframe"
        
        if isinstance(source, (str, Path)):
            source_str = str(source).lower()
            
            if source_str.startswith(('http://', 'https://')):
                return "web"
            
            if source_str.endswith('.csv'):
                return "csv"
            if source_str.endswith('.tsv'):
                return "csv"
            if source_str.endswith('.json'):
                return "json"
            if source_str.endswith('.geojson'):
                return "json"
            if source_str.endswith(('.nc', '.nc4', '.netcdf')):
                return "netcdf"
            if source_str.endswith('.xml'):
                return "xml"
            if source_str.endswith('.isf'):
                return "isf"
            if source_str.endswith(('.xlsx', '.xls')):
                return "xlsx"
            if source_str.endswith('.pdf'):
                return "pdf"
            if source_str.endswith('.txt'):
                return "txt"
        
        if isinstance(source, dict):
            if 'features' in source:
                return "json"  # GeoJSON
            if any(key in source for key in ['data', 'results', 'items', 'records']):
                return "api_response"
        
        return "unknown"
    
    def _load_csv(self, source: Any) -> pd.DataFrame:
        """Load CSV/TSV file."""
        source_str = str(source).lower()
        sep = '\t' if source_str.endswith('.tsv') else ','
        return pd.read_csv(source, sep=sep)
    
    def _load_json(self, source: Any) -> pd.DataFrame:
        """Load JSON/GeoJSON file."""
        import json as json_lib
        
        if isinstance(source, (str, Path)):
            with open(source, 'r') as f:
                data = json_lib.load(f)
        else:
            data = source
        
        # GeoJSON format
        if isinstance(data, dict) and 'features' in data:
            features = data.get('features', [])
            records = []
            for feature in features:
                properties = feature.get('properties', {})
                geometry = feature.get('geometry', {})
                record = properties.copy()
                record['geometry_type'] = geometry.get('type')
                if geometry.get('coordinates'):
                    record['coordinates'] = geometry.get('coordinates')
                records.append(record)
            return pd.DataFrame(records)
        
        # Plain JSON array
        if isinstance(data, list):
            return pd.DataFrame(data)
        
        # Single JSON object
        if isinstance(data, dict):
            return pd.DataFrame([data])
        
        return pd.DataFrame()
    
    def _load_netcdf(self, source: Any) -> pd.DataFrame:
        """Load NetCDF file."""
        try:
            import xarray as xr
        except ImportError:
            raise ImportError("xarray required for NetCDF. Install with: pip install xarray netCDF4")
        
        ds = xr.open_dataset(source)
        return ds.to_dataframe().reset_index()
    
    def _load_xml(self, source: Any) -> pd.DataFrame:
        """Load XML file."""
        import xml.etree.ElementTree as ET
        
        source_path = Path(source) if isinstance(source, str) else source
        tree = ET.parse(source_path)
        root = tree.getroot()
        
        # Find repeating elements
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
        
        return pd.DataFrame(records) if records else pd.DataFrame()
    
    def _load_isf(self, source: Any) -> pd.DataFrame:
        """Load ISF (seismic) file."""
        source_path = Path(source) if isinstance(source, str) else source
        
        events = []
        current_event = None
        
        with open(source_path, 'r', encoding='utf-8', errors='ignore') as f:
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
        
        df = pd.DataFrame(events)
        
        if 'date' in df.columns and 'time' in df.columns:
            df['datetime'] = pd.to_datetime(
                df['date'] + ' ' + df['time'],
                errors='coerce',
                format='%Y/%m/%d %H:%M:%S.%f'
            )
            df = df.drop(columns=['date', 'time'], errors='ignore')
        
        return df
    
    def _load_xlsx(self, source: Any) -> pd.DataFrame:
        """Load Excel file."""
        return pd.read_excel(source)
    
    def _load_pdf(self, source: Any) -> pd.DataFrame:
        """Load PDF file (extract tables)."""
        try:
            import camelot
        except ImportError:
            raise ImportError(
                "camelot-py required for PDF extraction. Install with: "
                "pip install 'camelot-py[base]' or 'camelot-py[cv]'"
            )
        
        source_path = str(source) if isinstance(source, Path) else source
        
        # Try lattice first, then stream
        tables = camelot.read_pdf(source_path, pages='all', flavor='lattice')
        if len(tables) == 0:
            tables = camelot.read_pdf(source_path, pages='all', flavor='stream')
        
        if len(tables) == 0:
            return pd.DataFrame()
        
        df = tables[0].df
        
        # Use first row as headers
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
        
        return df
    
    def _load_web(self, source: str) -> pd.DataFrame:
        """Load data from web URL."""
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
        
        # Run the async crawl
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
        
        # Try to extract tables from HTML
        try:
            from io import StringIO
            if html_content:
                tables = pd.read_html(StringIO(html_content))
                if tables:
                    return tables[0]
                
                # Try parsing structured content
                return self._parse_web_content(html_content, source)
        except Exception:
            pass
        
        # Fallback: return content as single row
        markdown_content = ""
        if hasattr(result, 'markdown'):
            if hasattr(result.markdown, 'raw_markdown'):
                markdown_content = result.markdown.raw_markdown
            elif isinstance(result.markdown, str):
                markdown_content = result.markdown
        
        return pd.DataFrame({'content': [markdown_content[:5000]] if markdown_content else ['No content']})
    
    def _parse_web_content(self, html: str, url: str) -> pd.DataFrame:
        """Parse web content into structured DataFrame."""
        try:
            from bs4 import BeautifulSoup
        except ImportError:
            return pd.DataFrame({'content': [html[:1000]]})
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # Hacker News specific
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
        
        # Generic: try to find lists
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
        
        # Fallback
        return pd.DataFrame({'content': [soup.get_text(strip=True)[:5000]]})
    
    def _load_txt(self, source: Any) -> pd.DataFrame:
        """Load plain text file as unstructured data."""
        source_path = Path(source) if isinstance(source, str) else source
        
        with open(source_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Try to detect if it's tabular (lines with consistent separators)
        lines = content.strip().split('\n')
        if len(lines) > 1:
            # Check for common delimiters
            for delimiter in ['\t', '|', ',', ';']:
                first_line_parts = lines[0].split(delimiter)
                if len(first_line_parts) > 1:
                    # Check consistency
                    consistent = all(
                        len(line.split(delimiter)) == len(first_line_parts)
                        for line in lines[:min(10, len(lines))]
                    )
                    if consistent:
                        from io import StringIO
                        return pd.read_csv(StringIO(content), sep=delimiter)
        
        # Return as single column of lines
        return pd.DataFrame({'line': lines})
    
    def _load_api_response(self, source: dict) -> pd.DataFrame:
        """Load from API response dict."""
        for key in ['data', 'results', 'items', 'records', 'response']:
            if key in source and isinstance(source[key], list):
                return pd.DataFrame(source[key])
        return pd.DataFrame([source])


def process_data(source: Any) -> pd.DataFrame:
    """
    Process any data source into DataFrame.
    
    Args:
        source: Data source (DataFrame, file path, URL, dict)
    
    Returns:
        DataFrame ready for visualization
    """
    processor = DataProcessor()
    return processor.process(source)
