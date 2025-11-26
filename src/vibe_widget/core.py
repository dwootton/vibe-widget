"""
Core VibeWidget implementation.
Clean, robust widget generation without legacy profile logic.
"""
from pathlib import Path
from typing import Any

import anywidget
import numpy as np
import pandas as pd
import traitlets

from vibe_widget.code_parser import CodeStreamParser
from vibe_widget.widget_store import WidgetStore


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
            return None
    else:
        return obj


class VibeWidget(anywidget.AnyWidget):
    """AnyWidget-based visualization widget with LLM code generation."""
    
    data = traitlets.List([]).tag(sync=True)
    description = traitlets.Unicode("").tag(sync=True)
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
        show_progress: bool = True,
        exports: dict[str, str] | None = None,
        imports: dict[str, Any] | None = None,
        data_var_name: str | None = None,
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
            show_progress=show_progress,
            exports=exports,
            imports=imports,
            data_var_name=data_var_name,
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
                serialized[name] = f"Trait '{name}' from widget {source.__class__.__name__}"
            else:
                serialized[name] = repr(source)
        return serialized

    def __init__(
        self, 
        description: str, 
        df: pd.DataFrame,
        api_key: str | None = None, 
        model: str = "claude-haiku-4-5-20251001",
        show_progress: bool = True,
        exports: dict[str, str] | None = None,
        imports: dict[str, Any] | None = None,
        data_var_name: str | None = None,
        **kwargs
    ):
        """
        Create a VibeWidget with automatic code generation.
        
        Args:
            description: Natural language description of desired visualization
            df: DataFrame to visualize
            api_key: Anthropic API key
            model: Claude model to use
            show_progress: Whether to show progress widget
            exports: Dict of trait_name -> description for state this widget exposes
            imports: Dict of trait_name -> source widget/value for state this widget consumes
            data_var_name: Variable name of the data parameter for cache key
            **kwargs: Additional widget parameters
        """
        parser = CodeStreamParser()
        self._exports = exports or {}
        self._imports = imports or {}
        self._pipeline_artifacts = {}
        self._widget_metadata = None
        
        app_wrapper_path = Path(__file__).parent / "app_wrapper.js"
        self._esm = app_wrapper_path.read_text()
        
        data_json = df.to_dict(orient="records")
        data_json = _clean_for_json(data_json)
        
        super().__init__(
            data=data_json,
            description=description,
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
            store = WidgetStore()
            imports_serialized = self._serialize_imports_for_prompt()
            
            # Check cache
            cached_widget = store.lookup(
                description=description,
                data_var_name=data_var_name,
                model=model,
                exports=self._exports,
                imports_serialized=imports_serialized,
            )
            
            if cached_widget:
                self.logs = [f"✓ Loaded cached widget: {cached_widget['slug']} v{cached_widget['version']}"]
                self.logs = self.logs + [f"Cache key: {cached_widget['id']}"]
                
                widget_code = store.load_widget_code(cached_widget)
                self.code = widget_code
                self.status = "ready"
                self.description = description
                self._widget_metadata = cached_widget
                
                # Store data_info for error recovery
                self.data_info = self._extract_data_info(df)
                self.data_info["exports"] = self._exports
                self.data_info["imports"] = imports_serialized
                
                from vibe_widget.llm.agentic import AgenticOrchestrator
                self.orchestrator = AgenticOrchestrator(api_key=api_key, model=model)
                
                return
            
            # Cache miss - generate with agentic orchestrator
            self.logs = [f"Analyzing data: {df.shape[0]} rows × {df.shape[1]} columns"]
            
            from vibe_widget.llm.agentic import AgenticOrchestrator
            self.orchestrator = AgenticOrchestrator(api_key=api_key, model=model)
            
            cols_preview = ', '.join(str(c) for c in df.columns.tolist()[:3])
            if len(df.columns) > 3:
                cols_preview += '...'
            self.logs = self.logs + [f"Columns: {cols_preview}"]
            self.logs = self.logs + ["Generating widget code..."]
            
            chunk_buffer = []
            update_counter = 0
            last_pattern_count = 0
            
            def stream_callback(event_type: str, message: str):
                """Handle progress events from orchestrator."""
                nonlocal update_counter, last_pattern_count
                
                event_messages = {
                    "step": f"➤ {message}",
                    "thinking": f"💭 {message[:150]}...",
                    "complete": f"✓ {message}",
                    "error": f"✘ {message}",
                    "chunk": message,
                }
                
                display_msg = event_messages.get(event_type, message)
                
                if event_type == "chunk":
                    chunk_buffer.append(message)
                    update_counter += 1
                    
                    updates = parser.parse_chunk(message)
                    
                    should_update = (
                        update_counter % 30 == 0 or 
                        parser.has_new_pattern() or
                        len(''.join(chunk_buffer)) > 500
                    )
                    
                    if should_update:
                        if chunk_buffer:
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
                else:
                    current_logs = list(self.logs)
                    current_logs.append(display_msg)
                    self.logs = current_logs
            
            # Generate code
            widget_code, processed_df = self.orchestrator.generate(
                description=description,
                df=df,
                exports=self._exports,
                imports=imports_serialized,
                progress_callback=stream_callback,
            )
            
            self._pipeline_artifacts = self.orchestrator.get_pipeline_artifacts()
            current_logs = list(self.logs)
            current_logs.append(f"Code generated: {len(widget_code)} characters")
            self.logs = current_logs
            
            # Save to widget store
            notebook_path = store.get_notebook_path()
            widget_entry = store.save(
                widget_code=widget_code,
                description=description,
                data_var_name=data_var_name,
                model=model,
                exports=self._exports,
                imports_serialized=imports_serialized,
                notebook_path=notebook_path,
            )
            
            self.logs = self.logs + [f"Widget saved: {widget_entry['slug']} v{widget_entry['version']}"]
            self.logs = self.logs + [f"Location: .vibewidget/widgets/{widget_entry['file_name']}"]
            self.code = widget_code
            self.status = "ready"
            self.description = description
            self._widget_metadata = widget_entry
            
            # Store data_info for error recovery
            self.data_info = self._extract_data_info(df)
            self.data_info["exports"] = self._exports
            self.data_info["imports"] = imports_serialized
            
        except Exception as e:
            self.status = "error"
            self.logs = self.logs + [f"Error: {str(e)}"]
            raise
    
    def _on_error(self, change):
        """Called when frontend reports a runtime error."""
        error_msg = change['new']
        
        if not error_msg or self.retry_count >= 2:
            return
        
        self.retry_count += 1
        self.status = 'generating'
        
        error_preview = error_msg.split('\n')[0][:100]
        self.logs = self.logs + [f"Error detected (attempt {self.retry_count}): {error_preview}"]
        self.logs = self.logs + ["Asking LLM to fix the error..."]
        
        try:
            clean_data_info = _clean_for_json(self.data_info)
            
            fixed_code = self.orchestrator.fix_runtime_error(
                code=self.code,
                error_message=error_msg,
                data_info=clean_data_info,
            )
            
            self.logs = self.logs + ["Code fixed, retrying..."]
            self.code = fixed_code
            self.status = 'ready'
            self.error_message = ""
        except Exception as e:
            self.status = "error"
            self.logs = self.logs + [f"Fix attempt failed: {str(e)}"]
            self.error_message = ""
    
    def _extract_data_info(self, df: pd.DataFrame) -> dict[str, Any]:
        """Extract basic data info for LLM context."""
        return {
            "columns": df.columns.tolist(),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "shape": df.shape,
            "sample": df.head(3).to_dict(orient="records"),
        }

    def get_pipeline_artifacts(self) -> dict[str, Any]:
        """Get pipeline artifacts from agentic generation."""
        return self._pipeline_artifacts

    def get_data_wrangle_code(self) -> str | None:
        """Get the Python data wrangling code generated (if any)."""
        return self._pipeline_artifacts.get("wrangle_code")

    def get_implementation_plan(self) -> dict[str, Any] | None:
        """Get the implementation plan from agentic generation."""
        return self._pipeline_artifacts.get("plan")


def create(
    description: str,
    data: pd.DataFrame | str | Path | None = None,
    api_key: str | None = None,
    model: str = "claude-haiku-4-5-20251001",
    show_progress: bool = True,
    exports: dict[str, str] | None = None,
    imports: dict[str, Any] | None = None,
) -> VibeWidget:
    """
    Create a VibeWidget visualization with automatic data processing.
    
    Args:
        description: Natural language description of the visualization
        data: Data source - can be:
            - pd.DataFrame: Direct DataFrame
            - str/Path: File path (CSV, JSON, NetCDF, PDF, etc.)
            - URL: Web page to scrape
            - None: Widget driven by imports only
        api_key: Anthropic API key (or set ANTHROPIC_API_KEY env var)
        model: Claude model to use (default: claude-haiku-4-5-20251001)
        show_progress: Whether to show progress in notebook (default: True)
        exports: Dict of {trait_name: description} for traits this widget exposes
        imports: Dict of {trait_name: source} where source is another widget's trait
    
    Returns:
        VibeWidget instance
    
    Examples:
        >>> widget = create("show temperature trends", df)
        >>> widget = create("visualize sales data", "sales.csv")
        >>> widget = create("extract and visualize tables", "report.pdf")
        >>> widget = create("visualize top stories", "https://news.ycombinator.com")
    """
    from vibe_widget.data_parser.data_processor import DataProcessor
    
    processor = DataProcessor()
    
    if data is None:
        df = pd.DataFrame()
    else:
        df = processor.process(data)
        
        
    # clean and sample data
    if df.shape[0] > 100000 or df.shape[1] > 1000:
        df = df.sample(n=100000, random_state=42) if df.shape[0] > 100000 else df
        df = df.iloc[:, :1000] if df.shape[1] > 1000 else df
        print(f"Data too large, sampled to shape: {df.shape}")
    
    # Try to extract the variable name from caller's frame
    data_var_name = None
    try:
        import inspect
        frame = inspect.currentframe()
        if frame and frame.f_back:
            caller_frame = frame.f_back
            caller_locals = caller_frame.f_locals
            
            if not df.empty:
                for var_name, var_value in caller_locals.items():
                    if var_name.startswith('_') or var_name in ['pd', 'vw', 'os']:
                        continue
                    try:
                        if isinstance(var_value, pd.DataFrame) and var_value is df:
                            data_var_name = var_name
                            break
                    except Exception:
                        continue
    except Exception:
        pass
    
    widget = VibeWidget._create_with_dynamic_traits(
        description=description,
        df=df,
        api_key=api_key,
        model=model,
        show_progress=show_progress,
        exports=exports,
        imports=imports,
        data_var_name=data_var_name,
    )

    # Link imported traits
    if imports:
        for import_name, import_source in imports.items():
            if hasattr(import_source, "trait_names") and hasattr(import_source, import_name):
                try:
                    traitlets.link((import_source, import_name), (widget, import_name))
                except Exception as exc:
                    print(f"Failed to link {import_name}: {exc}")
            elif hasattr(import_source, "__self__"):
                source_widget = import_source.__self__
                if hasattr(source_widget, import_name):
                    try:
                        traitlets.link((source_widget, import_name), (widget, import_name))
                    except Exception as exc:
                        print(f"Failed to link {import_name}: {exc}")
    
    # Display widget
    try:
        from IPython.display import display
        display(widget)
    except ImportError:
        pass
    
    return widget
