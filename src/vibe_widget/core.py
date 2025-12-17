"""
Core VibeWidget implementation.
Clean, robust widget generation without legacy profile logic.
"""
from pathlib import Path
from typing import Any

import anywidget
import pandas as pd
import traitlets

from vibe_widget.utils.code_parser import CodeStreamParser, RevisionStreamParser
from vibe_widget.llm import get_provider
from vibe_widget.llm.agentic import AgenticOrchestrator
from vibe_widget.llm.providers.base import LLMProvider
from vibe_widget.llm.tools.data_tools import DataLoadTool
from vibe_widget.config import get_global_config, Config
from vibe_widget.utils.widget_store import WidgetStore
from vibe_widget.utils.util import clean_for_json, initial_import_value, serialize_imports_for_prompt


class VibeWidget(anywidget.AnyWidget):
    data = traitlets.List([]).tag(sync=True)
    description = traitlets.Unicode("").tag(sync=True)
    status = traitlets.Unicode("idle").tag(sync=True)
    logs = traitlets.List([]).tag(sync=True)
    code = traitlets.Unicode("").tag(sync=True)
    error_message = traitlets.Unicode("").tag(sync=True)
    retry_count = traitlets.Int(0).tag(sync=True)
    grab_edit_request = traitlets.Dict({}).tag(sync=True)
    edit_in_progress = traitlets.Bool(False).tag(sync=True)

    @classmethod
    def _create_with_dynamic_traits(
        cls,
        description: str,
        df: pd.DataFrame,
        model: str = "openrouter",
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
            init_values[import_name] = initial_import_value(import_name, import_source)

        return widget_class(
            description=description,
            df=df,
            model=model,
            show_progress=show_progress,
            exports=exports,
            imports=imports,
            data_var_name=data_var_name,
            **init_values,
            **kwargs,
        )

    def __init__(
        self, 
        description: str, 
        df: pd.DataFrame, 
        model: str = "openrouter",
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
            model: OpenRouter model to use (or alias resolved via config)
            show_progress: Whether to show progress widget (deprecated - now uses internal state)
            exports: Dict of trait_name -> description for state this widget exposes
            imports: Dict of trait_name -> source widget/value for state this widget consumes
            data_var_name: Variable name of the data parameter for cache key
            **kwargs: Additional widget parameters
        """
        parser = CodeStreamParser()
        self._exports = exports or {}
        self._imports = imports or {}
        self._widget_metadata = None
        
        app_wrapper_path = Path(__file__).parent / "app_wrapper.js"
        self._esm = app_wrapper_path.read_text()
        
        data_json = df.to_dict(orient="records")
        data_json = clean_for_json(data_json)
        
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
        self.observe(self._on_grab_edit, names='grab_edit_request')
        
        if show_progress:
            try:
                from IPython.display import display
                display(self)
            except ImportError:
                pass
        
        try:
            self.logs = [f"Analyzing data: {df.shape[0]} rows × {df.shape[1]} columns"]
            
            config = get_global_config()
            provider = get_provider(model, config.api_key, config.mode)
            
            # Serialize imports for cache lookup
            # For cache purposes, we only care about the trait names, not the widget instances
            imports_serialized = {}
            if self._imports:
                for import_name in self._imports.keys():
                    # Just use the trait name as a placeholder - the actual widget instance
                    # shouldn't affect caching since we only care about the interface
                    imports_serialized[import_name] = f"<imported_trait:{import_name}>"
            
            # Check cache first
            store = WidgetStore()
            cached_widget = store.lookup(
                description=description,
                data_var_name=data_var_name,
                data_shape=df.shape,
                exports=self._exports,
                imports_serialized=imports_serialized,
            )
            
            # Create agentic orchestrator with the provider (needed for edits even if cached)
            self.orchestrator = AgenticOrchestrator(provider=provider)
            
            if cached_widget:
                # Use cached widget
                self.logs = self.logs + ["✓ Found cached widget"]
                self.logs = self.logs + [f"  {cached_widget['slug']} v{cached_widget['version']}"]
                self.logs = self.logs + [f"  Created: {cached_widget['created_at'][:10]}"]
                widget_code = store.load_widget_code(cached_widget)
                self.code = widget_code
                self.status = "ready"
                self.description = description
                self._widget_metadata = cached_widget
                
                # Store data_info for error recovery
                self.data_info = LLMProvider.build_data_info(df, self._exports, imports_serialized)
                return
            
            self.logs = self.logs + ["Generating widget code"]
            
            chunk_buffer = []
            update_counter = 0
            last_pattern_count = 0
            
            def stream_callback(event_type: str, message: str):
                """Handle progress events from orchestrator."""
                nonlocal update_counter, last_pattern_count
                
                event_messages = {
                    "step": f"{message}",
                    "thinking": f"{message[:150]}",
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
                            current_logs.append(f"Generating code ({update_counter} chunks)")
                            self.logs = current_logs
                        last_pattern_count = current_pattern_count
                else:
                    current_logs = list(self.logs)
                    current_logs.append(display_msg)
                    self.logs = current_logs
            
            # Generate code using the agentic orchestrator
            widget_code, processed_df = self.orchestrator.generate(
                description=description,
                df=df,
                exports=self._exports,
                imports=imports_serialized,
                progress_callback=stream_callback if show_progress else None,
            )
            
            current_logs = list(self.logs)
            current_logs.append(f"Code generated: {len(widget_code)} characters")
            self.logs = current_logs
            
            # Save to widget store (reuse store instance from cache lookup)
            notebook_path = store.get_notebook_path()
            widget_entry = store.save(
                widget_code=widget_code,
                description=description,
                data_var_name=data_var_name,
                data_shape=df.shape,
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
            
            # Store data_info for error recovery  (build from LLMProvider method)
            self.data_info = LLMProvider.build_data_info(df, self._exports, imports_serialized)
            
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
        self.logs = self.logs + ["Asking LLM to fix the error"]
        
        try:
            clean_data_info = clean_for_json(self.data_info)
            
            fixed_code = self.orchestrator.fix_runtime_error(
                code=self.code,
                error_message=error_msg,
                data_info=clean_data_info,
            )
            
            self.logs = self.logs + ["Code fixed, retrying"]
            self.code = fixed_code
            self.status = 'ready'
            self.error_message = ""
        except Exception as e:
            self.status = "error"
            self.logs = self.logs + [f"Fix attempt failed: {str(e)}"]
            self.error_message = ""

    def _on_grab_edit(self, change):
        """Handle element edit requests from frontend (React Grab)."""
        request = change['new']
        if not request:
            return
        
        element_desc = request.get('element', {})
        user_prompt = request.get('prompt', '')
        
        if not user_prompt:
            return
        
        old_code = self.code
        self._pending_old_code = old_code
        self.edit_in_progress = True
        self.status = 'generating'
        self.logs = [f"Editing: {user_prompt[:50]}{'...' if len(user_prompt) > 50 else ''}"]
        
        old_position = 0
        showed_analyzing = False
        showed_applying = False
        
        parser = RevisionStreamParser()
        
        WINDOW_SIZE = 200
        
        def progress_callback(event_type: str, message: str):
            """Stream progress updates to frontend."""
            nonlocal old_position, showed_analyzing, showed_applying
            
            if event_type == "chunk":
                chunk = message
                
                if not showed_analyzing:
                    self.logs = self.logs + ["Analyzing code"]
                    showed_analyzing = True
                
                window_start = max(0, old_position - WINDOW_SIZE)
                window_end = min(len(old_code), old_position + WINDOW_SIZE + len(chunk))
                window = old_code[window_start:window_end]
                
                found_at = window.find(chunk)
                
                if found_at != -1:
                    old_position = window_start + found_at + len(chunk)
                else:
                    if not showed_applying:
                        self.logs = self.logs + ["Applying changes"]
                        showed_applying = True
                    
                    updates = parser.parse_chunk(chunk)
                    if parser.has_new_pattern():
                        for update in updates:
                            if update["type"] == "micro_bubble":
                                self.logs = self.logs + [update["message"]]
                return
            
            if event_type == "complete":
                self.logs = self.logs + [f"✓ {message}"]
            elif event_type == "error":
                self.logs = self.logs + [f"✘ {message}"]
        
        try:
            revision_request = self._build_grab_revision_request(element_desc, user_prompt)
            
            clean_data_info = clean_for_json(self.data_info)
            
            revised_code = self.orchestrator.revise_code(
                code=self.code,
                revision_request=revision_request,
                data_info=clean_data_info,
                progress_callback=progress_callback,
            )
            
            self.code = revised_code
            self.status = 'ready'
            self.logs = self.logs + ['✓ Edit applied']
            
            store = WidgetStore()
            imports_serialized = {}
            if self._imports:
                for import_name in self._imports.keys():
                    imports_serialized[import_name] = f"<imported_trait:{import_name}>"
            
            widget_entry = store.save(
                widget_code=revised_code,
                description=self.description,
                data_var_name=self._widget_metadata.get('data_var_name') if self._widget_metadata else None,
                data_shape=tuple(self._widget_metadata.get('data_shape', [0, 0])) if self._widget_metadata else (0, 0),
                model=self._widget_metadata.get('model', 'unknown') if self._widget_metadata else 'unknown',
                exports=self._exports,
                imports_serialized=imports_serialized,
                notebook_path=store.get_notebook_path(),
            )
            self._widget_metadata = widget_entry
            self.logs = self.logs + [f"Saved: {widget_entry['slug']} v{widget_entry['version']}"]
            
        except Exception as e:
            if "cancelled" in str(e).lower():
                self.code = old_code
                self.status = 'ready'
                self.logs = self.logs + ['✗ Edit cancelled']
            else:
                self.status = 'error'
                self.logs = self.logs + [f'✘ Edit failed: {str(e)}']
        
        self.edit_in_progress = False
        self.grab_edit_request = {}
        self._pending_old_code = None

    def _build_grab_revision_request(self, element_desc: dict, user_prompt: str) -> str:
        """Build a revision request that identifies the element for the LLM."""
        sibling_hint = ""
        sibling_count = element_desc.get('siblingCount', 1)
        is_data_bound = element_desc.get('isDataBound', False)
        
        if is_data_bound:
            sibling_hint = f"""

IMPORTANT: This element is likely DATA-BOUND (one of {sibling_count} sibling <{element_desc.get('tag')}> elements).
This typically means it was created by D3's .selectAll().data().join() pattern or similar.
To modify this element, find and modify the D3 selection code that creates these elements,
not a single static element in the template."""
        
        style_info = ""
        style_hints = element_desc.get('styleHints', {})
        if style_hints:
            style_parts = [f"{k}: {v}" for k, v in style_hints.items() if v and v != 'none']
            if style_parts:
                style_info = f"\n- Current styles: {', '.join(style_parts)}"
        
        return f"""USER REQUEST: {user_prompt}

TARGET ELEMENT:
- Tag: {element_desc.get('tag')}
- Classes: {element_desc.get('classes', 'none')}
- Text content: {element_desc.get('text', 'none')}
- SVG/HTML attributes: {element_desc.get('attributes', 'none')}
- Location in DOM: {element_desc.get('ancestors', '')} > {element_desc.get('tag')}
- Sibling count: {sibling_count} (same tag in parent){style_info}
- HTML representation: {element_desc.get('description', '')}
{sibling_hint}

Find this element in the code and apply the requested change. The element should be identifiable by its tag, classes, text content, or SVG attributes. Modify ONLY this element or closely related code."""


def create(
    description: str,
    data: pd.DataFrame | str | Path | None = None,
    model: str | None = None,
    show_progress: bool = True,
    exports: dict[str, str] | None = None,
    imports: dict[str, Any] | None = None,
    config: Config | None = None,
) -> VibeWidget:
    """
    Create a VibeWidget visualization with automatic data processing.
    
    Args:
        description: Natural language description of the visualization
        data: DataFrame to visualize OR path to data file (CSV, NetCDF, GeoJSON, etc.) OR URL OR None when using imports only
        model: Model to use (any OpenRouter-supported model ID or shortcut). See vw.models() for available options
        show_progress: Whether to show progress widget
        exports: Dict of {trait_name: description} for traits this widget exposes
        imports: Dict of {trait_name: source} where source is another widget's trait
        config: Optional Config object with model settings (overrides model parameter)
    
    Returns:
        VibeWidget instance
    
    Examples:
        >>> widget = create("show temperature trends", df)
        >>> widget = create("visualize sales data", "sales.csv")
        >>> widget = create("extract and visualize tables", "report.pdf")
        >>> widget = create("visualize top stories", "https://news.ycombinator.com")
    """
    if config:
        if not model:
            model = config.model
    elif not model:
        global_config = get_global_config()
        if not model:
            model = global_config.model
    

    if data is None:
        df = pd.DataFrame()
    elif isinstance(data, pd.DataFrame):
        df = data
    else:
        # Use DataLoadTool to load any supported data source
        result = DataLoadTool().execute(data)
        print("Loading data...", result)
        if result.success:
            df = result.output.get("dataframe", pd.DataFrame())
        else:
            raise ValueError(f"Failed to load data: {result.error}")
    
    # TODO: better data wrangling and preprocessing
    if len(df) > 5000:
        df = df.sample(5000)
        print("Note: Data truncated to 5000 rows for visualization.")

    widget = VibeWidget._create_with_dynamic_traits(
        description=description,
        df=df,
        model=model,
        show_progress=show_progress,
        exports=exports,
        imports=imports,
        data_var_name=None,  # Set to None as it's not a parameter of create()
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
