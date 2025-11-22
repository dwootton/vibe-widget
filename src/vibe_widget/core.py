"""
Updated VibeWidget core with integrated preprocessor
"""
import hashlib
from pathlib import Path
from typing import Any

import anywidget
import numpy as np
import pandas as pd
import traitlets
from IPython.display import display

from vibe_widget.code_parser import CodeStreamParser
from vibe_widget.llm.claude import ClaudeProvider
from vibe_widget.data_parser.data_profile import DataProfile


def _clean_for_json(obj: Any) -> Any:
    """
    Recursively clean data structures for JSON serialization.
    Converts NaT, NaN, and other non-JSON-serializable values to None.
    """
    if isinstance(obj, dict):
        return {k: _clean_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_clean_for_json(item) for item in obj]
    elif isinstance(obj, pd.Timestamp):
        # Handle pandas Timestamp (including NaT)
        if pd.isna(obj):
            return None
        return obj.isoformat()
    elif pd.isna(obj):
        # Handle other pandas NA types (NaN, NaT, etc.)
        return None
    elif isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        # Handle numpy NaN and Inf
        return None
    elif hasattr(obj, 'isoformat'):  # datetime objects
        try:
            return obj.isoformat()
        except (ValueError, AttributeError):
            return None
    else:
        return obj


class VibeWidget(anywidget.AnyWidget):
    data = traitlets.List([]).tag(sync=True)
    description = traitlets.Unicode("").tag(sync=True)
    data_profile_md = traitlets.Unicode("").tag(sync=True)
    
    status = traitlets.Unicode("idle").tag(sync=True)
    logs = traitlets.List([]).tag(sync=True)
    code = traitlets.Unicode("").tag(sync=True)
    
    error_message = traitlets.Unicode("").tag(sync=True)
    retry_count = traitlets.Int(0).tag(sync=True)

    @classmethod
    def _create_with_dynamic_traits(
        cls,
        description: str,
        df: pd.DataFrame,
        api_key: str | None = None,
        model: str = "claude-haiku-4-5-20251001",
        use_preprocessor: bool = True,
        context: dict | None = None,
        show_progress: bool = True,
        exports: dict[str, str] | None = None,
        imports: dict[str, Any] | None = None,
        **kwargs,
    ) -> "VibeWidget":
        """Return a widget instance that includes traitlets for declared exports/imports."""
        exports = exports or {}
        imports = imports or {}

        dynamic_traits: dict[str, traitlets.TraitType] = {}
        for export_name in exports.keys():
            dynamic_traits[export_name] = traitlets.Any(default_value=None).tag(sync=True)
        for import_name in imports.keys():
            if import_name not in dynamic_traits:
                dynamic_traits[import_name] = traitlets.Any(default_value=None).tag(sync=True)

        widget_class = (
            type("DynamicVibeWidget", (cls,), dynamic_traits) if dynamic_traits else cls
        )

        init_values: dict[str, Any] = {}
        for export_name in exports.keys():
            init_values[export_name] = None
        for import_name, import_source in imports.items():
            init_values[import_name] = cls._initial_import_value(import_name, import_source)

        return widget_class(
            description=description,
            df=df,
            api_key=api_key,
            model=model,
            use_preprocessor=use_preprocessor,
            context=context,
            show_progress=show_progress,
            exports=exports,
            imports=imports,
            **init_values,
            **kwargs,
        )

    @staticmethod
    def _initial_import_value(import_name: str, import_source: Any) -> Any:
        """Figure out an initial default value for an imported trait."""
        if hasattr(import_source, "trait_names") and hasattr(import_source, import_name):
            return getattr(import_source, import_name)
        if hasattr(import_source, "__self__") and hasattr(import_source.__self__, import_name):
            return getattr(import_source.__self__, import_name)
        return import_source

    def _serialize_imports_for_prompt(self) -> dict[str, str]:
        """Convert import sources to human-readable descriptions for the LLM prompt."""
        serialized: dict[str, str] = {}
        for name, source in (self._imports or {}).items():
            if isinstance(source, str):
                serialized[name] = source
            elif hasattr(source, "__class__"):
                serialized[name] = (
                    f"Trait '{name}' from widget {source.__class__.__name__}"
                )
            else:
                serialized[name] = repr(source)
        return serialized

    def __init__(
        self, 
        description: str, 
        df: pd.DataFrame, 
        api_key: str | None = None, 
        model: str = "claude-haiku-4-5-20251001",
        use_preprocessor: bool = True,
        context: dict | None = None,
        show_progress: bool = True,
        exports: dict[str, str] | None = None,
        imports: dict[str, Any] | None = None,
        **kwargs
    ):
        """
        Create a VibeWidget with optional intelligent preprocessing
        
        Args:
            description: Natural language description of desired visualization
            df: DataFrame to visualize
            api_key: Anthropic API key
            model: Claude model to use
            use_preprocessor: Whether to use the intelligent preprocessor (recommended)
            context: Additional context about the data (domain, purpose, etc.)
            show_progress: Whether to show progress widget (deprecated - now uses internal state)
            exports: Dict of trait_name -> description for state this widget exposes
            imports: Dict of trait_name -> source widget/value for state this widget consumes
            **kwargs: Additional widget parameters
        """
        parser = CodeStreamParser()
        self._exports = exports or {}
        self._imports = imports or {}
        
        app_wrapper_path = Path(__file__).parent / "app_wrapper.js"
        self._esm = app_wrapper_path.read_text()
        
        data_json = df.to_dict(orient="records")
        data_json = _clean_for_json(data_json)
        
        super().__init__(
            data=data_json,
            description=description,
            data_profile_md="",
            status="generating",
            logs=[],
            code="",
            error_message="",
            retry_count=0,
            **kwargs
        )
        
        self.observe(self._on_error, names='error_message')
        
        if show_progress:
            try:
                from IPython.display import display
                display(self)
            except ImportError:
                pass
        
        try:
            self.logs = [f"Analyzing data: {df.shape[0]} rows × {df.shape[1]} columns"]
            
            self.llm_provider = ClaudeProvider(api_key=api_key, model=model)
            self.data_info = self._extract_data_info(df)
            llm_provider = self.llm_provider
            
            data_profile = context 
            if isinstance(context, DataProfile):
                enhanced_description = f"{description}\n\nData Profile: {data_profile.to_markdown()}"
            else:
                data_info = self._extract_data_info(df)
                enhanced_description = f"{description}\n\n======================\n\n CONTEXT::DATA_INFO:\n\n {data_info}"
                data_profile = None
            
            self.logs = self.logs + [f"Columns: {', '.join(df.columns.tolist()[:3])}{'...' if len(df.columns) > 3 else ''}"]
            
            self.logs = self.logs + ["Generating widget code..."]
            
            data_info = self._extract_data_info(df)
            data_info["exports"] = self._exports
            data_info["imports"] = self._serialize_imports_for_prompt()
            self.data_info = data_info
            
            chunk_buffer = []
            update_counter = 0
            last_pattern_count = 0
            
            def stream_callback(chunk: str):
                nonlocal update_counter, last_pattern_count
                
                chunk_buffer.append(chunk)
                update_counter += 1
                
                updates = parser.parse_chunk(chunk)
                
                should_update = (
                    update_counter % 30 == 0 or 
                    parser.has_new_pattern() or
                    len(''.join(chunk_buffer)) > 500
                )
                
                if should_update:
                    if chunk_buffer:
                        snippet = ''.join(chunk_buffer)[:100]
                        chunk_buffer.clear()
                    
                    for update in updates:
                        if update["type"] == "micro_bubble":
                            current_logs = list(self.logs)
                            current_logs.append(update["message"])
                            self.logs = current_logs
                    
                    current_pattern_count = len(parser.detected)
                    if current_pattern_count == last_pattern_count and update_counter % 100 == 0:
                        current_logs = list(self.logs)
                        current_logs.append(f"Generating code... ({update_counter} chunks)")
                        self.logs = current_logs
                    last_pattern_count = current_pattern_count
            
            widget_code = llm_provider.generate_widget_code(
                enhanced_description, 
                data_info,
                progress_callback=stream_callback
            )
            
            self.logs = self.logs + [f"Code generated: {len(widget_code)} characters"]
            
            widget_hash = hashlib.md5(f"{description}{df.shape}".encode()).hexdigest()[:8]
            widget_dir = Path(__file__).parent / "widgets"
            widget_dir.mkdir(exist_ok=True)
            widget_file = widget_dir / f"widget_{widget_hash}.js"
            
            widget_file.write_text(widget_code)
            
            self.logs = self.logs + [f"Widget saved: widget_{widget_hash}.js"]
            self.code = widget_code
            self.status = "ready"
            self.description = enhanced_description
            self.data_profile_md = data_profile.to_markdown() if data_profile else ""
            
        except Exception as e:
            self.status = "error"
            self.logs = self.logs + [f"Error: {str(e)}"]
            raise
    
    def _on_error(self, change):
        """Called when frontend reports a runtime error"""
        error_msg = change['new']
        
        if not error_msg or self.retry_count >= 2:
            return
        
        self.retry_count += 1
        self.status = 'generating'
        
        error_preview = error_msg.split('\n')[0][:100]
        self.logs = self.logs + [f"Error detected (attempt {self.retry_count}): {error_preview}"]
        self.logs = self.logs + ["Asking LLM to fix the error..."]
        
        try:
            fixed_code = self.llm_provider.fix_code_error(
                self.code,
                error_msg,
                self.data_info
            )
            
            self.logs = self.logs + ["Code fixed, retrying..."]
            self.code = fixed_code
            self.status = 'ready'
            self.error_message = ""
        except Exception as e:
            self.status = "error"
            self.logs = self.logs + [f"Fix attempt failed: {str(e)}"]
            self.error_message = ""
    
    def _profile_to_info(self, profile) -> dict[str, Any]:
        """Convert DataProfile to info dict for LLM"""
        return {
            "columns": [col.name for col in profile.columns],
            "dtypes": {col.name: col.dtype for col in profile.columns},
            "shape": profile.shape,
            "sample": profile.sample_records,
            
            # Rich metadata from preprocessor
            "domain": profile.inferred_domain,
            "purpose": profile.dataset_purpose,
            "is_timeseries": profile.is_timeseries,
            "temporal_column": profile.temporal_column,
            "temporal_frequency": profile.temporal_frequency,
            "is_geospatial": profile.is_geospatial,
            "coordinate_columns": profile.coordinate_columns,
            
            # Column insights
            "column_meanings": {
                col.name: {
                    "meaning": col.inferred_meaning,
                    "uses": col.potential_uses,
                    "dtype_info": {
                        "min": col.min,
                        "max": col.max,
                        "cardinality": col.cardinality,
                    }
                }
                for col in profile.columns
            },
            
            # Visualization guidance
            "suggested_visualizations": profile.suggested_visualizations,
            "key_insights": profile.key_insights,
        }
    
    def _enhance_description(self, user_description: str, profile) -> str:
        """Enhance user description with profile insights"""
        enhancements = []
        
        # Add domain context
        if profile.inferred_domain:
            enhancements.append(f"Domain: {profile.inferred_domain}")
        
        # Add data characteristics
        characteristics = []
        if profile.is_timeseries:
            characteristics.append(f"time series ({profile.temporal_frequency})")
        if profile.is_geospatial:
            characteristics.append("geospatial")
        
        if characteristics:
            enhancements.append(f"Data type: {', '.join(characteristics)}")
        
        # Add key insights
        if profile.key_insights:
            insights_text = "\n".join(f"- {insight}" for insight in profile.key_insights[:3])
            enhancements.append(f"Key patterns:\n{insights_text}")
        
        # Add suggested visualizations if user description is vague
        if len(user_description.split()) < 10 and profile.suggested_visualizations:
            viz_text = "\n".join(f"- {viz}" for viz in profile.suggested_visualizations[:2])
            enhancements.append(f"Suggested approaches:\n{viz_text}")
        
        # Combine
        if enhancements:
            context_block = "\n\n".join(enhancements)
            return f"{user_description}\n\nContext:\n{context_block}"
        else:
            return user_description
    
    def _extract_data_info(self, df: pd.DataFrame) -> dict[str, Any]:
        """Fallback: basic data extraction without preprocessor"""
        return {
            "columns": df.columns.tolist(),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "shape": df.shape,
            "sample": df.head(3).to_dict(orient="records"),
        }
    
    def _merge_profiles(self, provided_profile: DataProfile, extracted_profile: DataProfile) -> DataProfile:
        """Merge a provided profile with an extracted profile, preserving provided metadata"""
        # Use provided profile as base
        merged = provided_profile
        
        # Update with extracted profile's structural info (shape, columns) if different
        if extracted_profile.shape != provided_profile.shape:
            # If shapes differ, use extracted (more accurate for current data)
            merged.shape = extracted_profile.shape
        
        # Merge column information - use provided if available, otherwise extracted
        # Match columns by name (case-insensitive)
        extracted_cols_by_name = {col.name.lower(): col for col in extracted_profile.columns}
        provided_cols_by_name = {col.name.lower(): col for col in provided_profile.columns}
        
        merged_columns = []
        for extracted_col in extracted_profile.columns:
            col_key = extracted_col.name.lower()
            if col_key in provided_cols_by_name:
                # Use provided column but update with extracted stats
                provided_col = provided_cols_by_name[col_key]
                # Update statistical properties from extracted if missing in provided
                if provided_col.count is None and extracted_col.count is not None:
                    provided_col.count = extracted_col.count
                if provided_col.min is None and extracted_col.min is not None:
                    provided_col.min = extracted_col.min
                if provided_col.max is None and extracted_col.max is not None:
                    provided_col.max = extracted_col.max
                merged_columns.append(provided_col)
            else:
                # New column from extracted
                merged_columns.append(extracted_col)
        
        merged.columns = merged_columns
        
        # Infer missing domain/description/purpose if not in provided profile
        if not merged.inferred_domain and extracted_profile.inferred_domain:
            merged.inferred_domain = extracted_profile.inferred_domain
        
        if not merged.dataset_purpose and extracted_profile.dataset_purpose:
            merged.dataset_purpose = extracted_profile.dataset_purpose
        
        # Merge key insights
        if extracted_profile.key_insights:
            merged.key_insights.extend(extracted_profile.key_insights)
        
        # Update sample records from extracted if not in provided
        if not merged.sample_records and extracted_profile.sample_records:
            merged.sample_records = extracted_profile.sample_records
        
        return merged


def create(
    description: str,
    df: pd.DataFrame | str | Path | None = None,
    api_key: str | None = None,
    model: str = "claude-haiku-4-5-20251001",
    context: dict | DataProfile | None = None,
    use_preprocessor: bool = True,
    show_progress: bool = True,
    exports: dict[str, str] | None = None,
    imports: dict[str, Any] | None = None,
) -> VibeWidget:
    """
    Create a VibeWidget visualization with intelligent preprocessing.
    
    Args:
        description: Natural language description of the visualization
        df: DataFrame to visualize OR path to data file (CSV, NetCDF, GeoJSON, etc.) OR None when using imports only
        api_key: Anthropic API key (or set ANTHROPIC_API_KEY env var)
        model: Claude model to use
        context: Additional context (dict with domain/purpose/etc.) OR DataProfile object
        use_preprocessor: Whether to use intelligent preprocessing (recommended)
        exports: Dict of {trait_name: description} for traits this widget exposes
        imports: Dict of {trait_name: source} where source is another widget's trait or literal value
    
    Returns:
        VibeWidget instance
    
    Examples:
        >>> # Simple DataFrame
        >>> widget = create("show temperature trends", df)
        
        >>> # With context dict for better results
        >>> widget = create(
        ...     "create an interactive dashboard",
        ...     df,
        ...     context={
        ...         "domain": "epidemiology",
        ...         "purpose": "track disease outbreaks"
        ...     }
        ... )
        
        >>> # With pre-computed profile
        >>> profile = preprocess_data(df, api_key=api_key)
        >>> widget = create("visualize patterns", df, context=profile)
        
        >>> # From file (auto-detects format)
        >>> widget = create(
        ...     "visualize ice velocity patterns",
        ...     "ice_data.nc",
        ...     context={"domain": "glaciology"}
        ... )
    """
    # Handle file paths
    if isinstance(df, (str, Path)):
        from vibe_widget.data_parser.preprocessor import preprocess_data
        
        # If context is a DataProfile, use it directly and skip preprocessing
        if isinstance(context, DataProfile):
            profile = context
        else:
            profile = preprocess_data(df, api_key=api_key, context=context)
        
        # For now, we need to convert to DataFrame for the widget
        # This is a limitation we might want to address
        if profile.source_type == "netcdf":
            try:
                import xarray as xr
                ds = xr.open_dataset(df)
                # Convert to DataFrame (flatten)
                df_converted = ds.to_dataframe().reset_index()
            except Exception as e:
                raise ValueError(f"Could not convert NetCDF to DataFrame: {e}")
        elif profile.source_type == "csv":
            df_converted = pd.read_csv(df)
        elif profile.source_type == "geojson":
            import json
            with open(df, 'r') as f:
                geojson = json.load(f)
            records = [feat['properties'] for feat in geojson.get('features', [])]
            df_converted = pd.DataFrame(records)
        elif profile.source_type == "isf":
            # ISF files need to be parsed - use the extractor logic
            from vibe_widget.data_parser.extractors import ISFExtractor
            extractor = ISFExtractor()
            # Re-extract to get the DataFrame (extractor creates it internally)
            # We'll parse it again to get the DataFrame
            source_path = Path(df) if isinstance(df, str) else df
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
                    elif line.startswith('mb') or line.startswith('Ms') or line.startswith('Mw'):
                        if current_event:
                            parts = line.split()
                            try:
                                current_event['magnitude'] = float(parts[1]) if len(parts) > 1 else None
                                current_event['magnitude_type'] = parts[0]
                            except (ValueError, IndexError):
                                pass
            
            if current_event:
                events.append(current_event)
            
            df_converted = pd.DataFrame(events)
            if 'date' in df_converted.columns and 'time' in df_converted.columns:
                df_converted['datetime'] = pd.to_datetime(
                    df_converted['date'] + ' ' + df_converted['time'], 
                    errors='coerce',
                    format='%Y/%m/%d %H:%M:%S.%f'
                )
                df_converted = df_converted.drop(columns=['date', 'time'], errors='ignore')
        elif profile.source_type == "pdf":
            # PDF files need to be parsed - use the extractor logic
            from vibe_widget.data_parser.extractors import PDFExtractor
            try:
                import camelot
            except ImportError:
                raise ImportError(
                    "camelot-py required for PDF extraction. Install with: "
                    "pip install 'camelot-py[base]' or 'camelot-py[cv]'"
                )
            
            source_path = Path(df) if isinstance(df, str) else df
            
            # Extract tables from PDF
            tables = camelot.read_pdf(str(source_path), pages='all', flavor='lattice')
            
            # If no tables found, try stream flavor
            if len(tables) == 0:
                tables = camelot.read_pdf(str(source_path), pages='all', flavor='stream')
            
            if len(tables) == 0:
                raise ValueError(f"No tables found in PDF: {source_path}")
            
            # Use the first table (can be extended to handle multiple tables)
            df_converted = tables[0].df
            
            # First row is often headers
            if len(df_converted) > 0:
                # Get header row and clean it up
                header_row = df_converted.iloc[0]
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
                
                df_converted.columns = new_columns
                df_converted = df_converted[1:]
                df_converted = df_converted.reset_index(drop=True)
        elif profile.source_type == "web":
            # Web URLs need to be scraped - use the extractor logic
            from vibe_widget.data_parser.extractors import WebExtractor
            extractor = WebExtractor()
            # Re-extract to get the DataFrame (extractor creates it internally)
            # We'll scrape it again to get the DataFrame
            source_url = str(df) if isinstance(df, str) else str(df)
            
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
            
            # Run the async crawl - handle both cases: with and without running event loop
            try:
                try:
                    # Check if there's already a running event loop (e.g., in Jupyter)
                    loop = asyncio.get_running_loop()
                    # If we're in a running loop, use nest_asyncio to allow nested event loops
                    try:
                        import nest_asyncio
                        nest_asyncio.apply()
                        result = asyncio.run(_crawl_url(source_url))
                    except ImportError:
                        # If nest_asyncio not available, create a new event loop in a thread
                        import concurrent.futures
                        import threading
                        
                        def run_in_thread():
                            new_loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(new_loop)
                            try:
                                return new_loop.run_until_complete(_crawl_url(source_url))
                            finally:
                                new_loop.close()
                        
                        with concurrent.futures.ThreadPoolExecutor() as executor:
                            future = executor.submit(run_in_thread)
                            result = future.result()
                except RuntimeError:
                    # No running event loop, safe to use asyncio.run()
                    result = asyncio.run(_crawl_url(source_url))
            except Exception as e:
                raise ValueError(f"Failed to crawl URL: {source_url}. Error: {e}")
            
            if not result.success:
                raise ValueError(f"Failed to crawl URL: {source_url}")
            
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
                        df_converted = tables[0]  # Use first table
                    else:
                        # No tables, try to parse structured content (e.g., Hacker News)
                        df_converted = extractor._parse_web_content(html_content, source_url)
                else:
                    # No HTML, try markdown or create text-based profile
                    df_converted = pd.DataFrame({'content': [markdown_content[:5000]] if markdown_content else ['No content extracted']})
            except Exception as e:
                # Fallback: try to parse structured content
                try:
                    if html_content:
                        df_converted = extractor._parse_web_content(html_content, source_url)
                    else:
                        df_converted = pd.DataFrame({'content': [markdown_content[:5000]] if markdown_content else ['No content extracted']})
                except Exception as e2:
                    # Last resort: create a text-based profile
                    df_converted = pd.DataFrame({'content': [markdown_content[:5000]] if markdown_content else ['No content extracted']})
        else:
            raise ValueError(f"Unsupported source type: {profile.source_type}")
        
        df = df_converted
        # Sample if DataFrame is large enough
        if len(df) > 1000:
            df = df.sample(1000)
    
    # Handle None data scenario (widget driven solely by imports)
    if df is None:
        df = pd.DataFrame()

    widget = VibeWidget._create_with_dynamic_traits(
        description=description,
        df=df,
        api_key=api_key,
        model=model,
        use_preprocessor=use_preprocessor,
        context=context,
        show_progress=show_progress,
        exports=exports,
        imports=imports,
    )

    # Link imported traits so they stay synchronized automatically
    if imports:
        for import_name, import_source in imports.items():
            if hasattr(import_source, "trait_names") and hasattr(import_source, import_name):
                try:
                    traitlets.link((import_source, import_name), (widget, import_name))
                    print(
                        f"✓ Linked {import_name}: {import_source.__class__.__name__} -> {widget.__class__.__name__}"
                    )
                except Exception as exc:  # pragma: no cover - debug aid
                    print(f"✗ Failed to link {import_name}: {exc}")
            elif hasattr(import_source, "__self__"):
                source_widget = import_source.__self__
                if hasattr(source_widget, import_name):
                    try:
                        traitlets.link((source_widget, import_name), (widget, import_name))
                        print(
                            f"✓ Linked {import_name}: {source_widget.__class__.__name__} -> {widget.__class__.__name__}"
                        )
                    except Exception as exc:  # pragma: no cover - debug aid
                        print(f"✗ Failed to link {import_name}: {exc}")
    
    # Explicitly display the widget to ensure it renders
    try:
        from IPython.display import display
        display(widget)
    except ImportError:
        pass
    
    return widget


# Additional API methods for working with profiles
def analyze_data(
    source: Any,
    api_key: str | None = None,
    context: dict | None = None,
    save_to: str | Path | None = None
):
    """
    Analyze data without creating a widget (just get the profile)
    
    Returns:
        DataProfile with insights
    """
    from vibe_widget.data_parser.preprocessor import preprocess_data
    
    profile = preprocess_data(
        source,
        api_key=api_key,
        context=context,
        save_to=save_to
    )
    
    # print(profile.to_markdown())
    return profile


def suggest_visualizations(
    source: Any,
    api_key: str | None = None,
    context: dict | None = None
) -> list[str]:
    """
    Get visualization suggestions for a dataset without creating a widget
    
    Returns:
        List of visualization suggestions
    """
    profile = analyze_data(source, api_key=api_key, context=context)
    return profile.suggested_visualizations
