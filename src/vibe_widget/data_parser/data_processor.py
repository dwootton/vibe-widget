"""
Unified Data Processor - handles all data loading, parsing, and profiling.
No LLM calls - purely Python-based processing.
Routes data to appropriate extractors based on type.
"""
from pathlib import Path
from typing import Any, Tuple
import pandas as pd

from vibe_widget.data_parser.data_profile import DataProfile
from vibe_widget.data_parser.extractors import (
    get_extractor,
    DataFrameExtractor,
    CSVExtractor,
    NetCDFExtractor,
    GeoJSONExtractor,
    XMLExtractor,
    ISFExtractor,
    PDFExtractor,
    WebExtractor,
    XLSXExtractor,
)


# Data types that can be processed directly (no LLM needed)
PROCESSABLE_TYPES = {
    "dataframe",
    "csv",
    "json",
    "geojson",
    "netcdf",
    "xml",
    "isf",
    "xlsx",
}

# Data types that need agentic processing (require LLM tools)
AGENTIC_TYPES = {
    "pdf",
    "web",
    "unknown",
}


class DataProcessor:
    """
    Unified data processor that handles all data formats.
    Routes to appropriate extractors and determines if agentic processing is needed.
    """
    
    def __init__(self):
        self._df_extractor = DataFrameExtractor()
    
    def process(
        self,
        source: Any,
    ) -> Tuple[pd.DataFrame, DataProfile]:
        """
        Process data source into DataFrame and DataProfile.
        
        No LLM calls - purely Python-based processing.
        For complex sources (PDF, web), returns basic profile and lets agentic system handle.
        
        Args:
            source: Data source - can be:
                - pd.DataFrame
                - str/Path to file (csv, json, xml, netcdf, isf, xlsx, pdf)
                - str URL (http://, https://)
        
        Returns:
            Tuple of (DataFrame, DataProfile)
            Profile will indicate if agentic processing is needed via source_type
        """
        # Determine source type
        source_type = self._determine_source_type(source)
        
        # Process based on type - agentic types get minimal profile
        if source_type in AGENTIC_TYPES:
            df, profile = self._process_agentic_source(source, source_type)
        else:
            df, profile = self._process_direct_source(source, source_type)
        
        return df, profile
    
    def _determine_source_type(self, source: Any) -> str:
        """Determine the type of data source."""
        # DataFrame
        if isinstance(source, pd.DataFrame):
            return "dataframe"
        
        # File paths
        if isinstance(source, (str, Path)):
            source_str = str(source).lower()
            
            # URL
            if source_str.startswith(('http://', 'https://')):
                return "web"
            
            # File extensions
            if source_str.endswith('.csv'):
                return "csv"
            if source_str.endswith(('.json', '.geojson')):
                return "json"  # Will be further classified
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
        
        # API response dict
        if isinstance(source, dict):
            if 'features' in source:
                return "geojson"
            if any(key in source for key in ['data', 'results', 'items', 'records']):
                return "api_response"
        
        return "unknown"
    
    def _process_direct_source(
        self,
        source: Any,
        source_type: str,
    ) -> Tuple[pd.DataFrame, DataProfile]:
        """Process sources that can be handled directly without LLM."""
        
        # Get appropriate extractor
        extractor = get_extractor(source)
        profile = extractor.extract(source)
        
        # Convert to DataFrame based on source type
        df = self._source_to_dataframe(source, source_type, profile)
        
        return df, profile
    
    def _process_agentic_source(
        self,
        source: Any,
        source_type: str,
    ) -> Tuple[pd.DataFrame, DataProfile]:
        """
        Process sources that need agentic handling.
        Returns minimal DataFrame and profile - agentic system will enhance.
        """
        if source_type == "pdf":
            # Try to extract with PDFExtractor
            try:
                extractor = PDFExtractor()
                if extractor.can_handle(source):
                    profile = extractor.extract(source)
                    df = self._extract_pdf_dataframe(source)
                    return df, profile
            except Exception:
                pass
            
            # Fallback: return empty with metadata
            profile = DataProfile(
                source_type="pdf",
                shape=(0, 0),
                source_uri=str(source),
            )
            return pd.DataFrame(), profile
        
        elif source_type == "web":
            # Try to extract with WebExtractor
            try:
                extractor = WebExtractor()
                if extractor.can_handle(source):
                    profile = extractor.extract(source)
                    df = self._extract_web_dataframe(source, profile)
                    return df, profile
            except Exception:
                pass
            
            # Fallback: return empty with metadata
            profile = DataProfile(
                source_type="web",
                shape=(0, 0),
                source_uri=str(source),
            )
            return pd.DataFrame(), profile
        
        # Unknown type
        profile = DataProfile(
            source_type="unknown",
            shape=(0, 0),
            source_uri=str(source) if isinstance(source, (str, Path)) else None,
        )
        return pd.DataFrame(), profile
    
    def _source_to_dataframe(
        self,
        source: Any,
        source_type: str,
        profile: DataProfile,
    ) -> pd.DataFrame:
        """Convert source to DataFrame based on type."""
        
        if source_type == "dataframe":
            return source
        
        elif source_type == "csv":
            return pd.read_csv(source)
        
        elif source_type == "json":
            # Check if it's GeoJSON
            if profile.source_type == "geojson":
                import json
                with open(source, 'r') as f:
                    data = json.load(f)
                records = [feat.get('properties', {}) for feat in data.get('features', [])]
                return pd.DataFrame(records)
            else:
                return pd.read_json(source)
        
        elif source_type == "netcdf":
            try:
                import xarray as xr
                ds = xr.open_dataset(source)
                return ds.to_dataframe().reset_index()
            except ImportError:
                raise ImportError("xarray required for NetCDF. Install with: pip install xarray netCDF4")
        
        elif source_type == "xml":
            return self._parse_xml_to_dataframe(source)
        
        elif source_type == "isf":
            return self._parse_isf_to_dataframe(source)
        
        elif source_type == "xlsx":
            return pd.read_excel(source)
        
        elif source_type == "api_response":
            # Find the data array
            for key in ['data', 'results', 'items', 'records', 'response']:
                if key in source and isinstance(source[key], list):
                    return pd.DataFrame(source[key])
            return pd.DataFrame([source])
        
        # Fallback
        return pd.DataFrame()
    
    def _parse_xml_to_dataframe(self, source: Any) -> pd.DataFrame:
        """Parse XML file to DataFrame."""
        import xml.etree.ElementTree as ET
        
        source_path = Path(source) if isinstance(source, str) else source
        tree = ET.parse(source_path)
        root = tree.getroot()
        
        # Find repeating elements
        element_counts = {}
        for elem in root.iter():
            tag = elem.tag
            element_counts[tag] = element_counts.get(tag, 0) + 1
        
        # Exclude root
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
    
    def _parse_isf_to_dataframe(self, source: Any) -> pd.DataFrame:
        """Parse ISF (seismic) file to DataFrame."""
        source_path = Path(source) if isinstance(source, str) else source
        
        events = []
        current_event = None
        
        with open(source_path, 'r', encoding='utf-8', errors='ignore') as f:
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
        
        df = pd.DataFrame(events)
        
        if 'date' in df.columns and 'time' in df.columns:
            df['datetime'] = pd.to_datetime(
                df['date'] + ' ' + df['time'],
                errors='coerce',
                format='%Y/%m/%d %H:%M:%S.%f'
            )
            df = df.drop(columns=['date', 'time'], errors='ignore')
        
        return df
    
    def _extract_pdf_dataframe(self, source: Any) -> pd.DataFrame:
        """Extract DataFrame from PDF."""
        try:
            import camelot
        except ImportError:
            raise ImportError(
                "camelot-py required for PDF extraction. Install with: "
                "pip install 'camelot-py[base]' or 'camelot-py[cv]'"
            )
        
        source_path = Path(source) if isinstance(source, str) else source
        
        # Try lattice first, then stream
        tables = camelot.read_pdf(str(source_path), pages='all', flavor='lattice')
        if len(tables) == 0:
            tables = camelot.read_pdf(str(source_path), pages='all', flavor='stream')
        
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
    
    def _extract_web_dataframe(self, source: str, profile: DataProfile) -> pd.DataFrame:
        """Extract DataFrame from web content."""
        # Profile should have sample_records from extraction
        if profile.sample_records:
            return pd.DataFrame(profile.sample_records)
        return pd.DataFrame()


# Convenience function
def process_data(source: Any) -> Tuple[pd.DataFrame, DataProfile]:
    """
    Process any data source into DataFrame and profile.
    
    Args:
        source: Data source (DataFrame, file path, URL, etc.)
    
    Returns:
        Tuple of (DataFrame, DataProfile)
        Check profile.source_type for AGENTIC_TYPES to determine if LLM needed
    """
    processor = DataProcessor()
    return processor.process(source)
