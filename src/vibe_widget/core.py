"""
Core VibeWidget implementation.
Clean, robust widget generation without legacy profile logic.
"""
from pathlib import Path
from typing import Any, Union
import json
import warnings
import inspect
import sys

import anywidget
import pandas as pd
import traitlets

from vibe_widget.api import (
    ExportHandle,
    OutputBundle,
    InputsBundle,
    _build_inputs_bundle,
)
from vibe_widget.utils.code_parser import CodeStreamParser, RevisionStreamParser
from vibe_widget.llm.agentic import AgenticOrchestrator
from vibe_widget.llm.providers.base import LLMProvider
from vibe_widget.config import (
    DEFAULT_MODEL,
    Config,
    PREMIUM_MODELS,
    STANDARD_MODELS,
    get_global_config,
    set_global_config,
)
from vibe_widget.llm.providers.openrouter_provider import OpenRouterProvider

from vibe_widget.utils.widget_store import WidgetStore
from vibe_widget.utils.audit_store import (
    AuditStore,
    compute_code_hash,
    compute_line_hashes,
    render_numbered_code,
    format_audit_yaml,
    strip_internal_fields,
    normalize_location,
)
from vibe_widget.utils.util import clean_for_json, initial_import_value, load_data
from vibe_widget.themes import Theme, resolve_theme_for_request, clear_theme_cache


def _export_to_json_value(value: Any, widget: Any) -> Any:
    """Trait serialization helper to unwrap export handles."""
    if isinstance(value, ExportHandle) or getattr(value, "__vibe_export__", False):
        try:
            return value()
        except Exception:
            return None
    return value


def _import_to_json_value(value: Any, widget: Any) -> Any:
    """Trait serialization helper for imports."""
    if isinstance(value, ExportHandle) or getattr(value, "__vibe_export__", False):
        try:
            return value()
        except Exception:
            return None
    return value


class ComponentReference:
    """
    Reference to a component within a widget for composition.
    
    ComponentReferences can be:
    - Displayed as standalone widgets using display() or _ipython_display_
    - Used as source in vw.edit() to modify specific components
    - Composed into new widgets
    
    Examples:
        >>> scatter = vw.create("scatter plot", df)
        >>> scatter.component.color_legend.display()  # Show component in separate cell
        >>> new_widget = vw.edit("make legend horizontal", scatter.component.color_legend)
    """
    
    def __init__(self, widget: "VibeWidget", component_name: str):
        self.widget = widget
        self.component_name = component_name
        self._standalone_widget: "VibeWidget | None" = None
    
    def __repr__(self) -> str:
        slug = self.widget._widget_metadata.get('slug', 'unknown') if self.widget._widget_metadata else 'unknown'
        return f"<ComponentReference: {self.component_name} from widget '{slug}'>"
    
    @property
    def code(self) -> str:
        """Get the full code of the source widget."""
        return self.widget.code
    
    @property
    def component_code(self) -> str | None:
        """Get the code for this specific component."""
        store = WidgetStore()
        return store.extract_component_code(self.widget.code, self.component_name)
    
    @property
    def metadata(self) -> dict[str, Any]:
        """Get the widget metadata."""
        return self.widget._widget_metadata or {}
    
    @property
    def standalone_code(self) -> str:
        """
        Generate standalone widget code that renders only this component.
        
        Keeps the full original code (all imports, helpers, components) but
        replaces the default export to render only this component.
        """
        from vibe_widget.utils.code_parser import generate_standalone_wrapper
        return generate_standalone_wrapper(self.widget.code, self.component_name)
    
    def display(self) -> "VibeWidget":
        """
        Display this component as a standalone widget in a new cell.
        
        Returns:
            VibeWidget instance rendering only this component
        """
        if self._standalone_widget is None:
            self._standalone_widget = self._create_standalone_widget()
        
        _display_widget(self._standalone_widget)
        return self._standalone_widget
    
    def _create_standalone_widget(self) -> "VibeWidget":
        """Create a VibeWidget that renders only this component."""
        # Get the data from the parent widget
        data = self.widget.data
        df = pd.DataFrame(data) if data else pd.DataFrame()
        
        # Create widget with the standalone code
        widget = VibeWidget._create_with_dynamic_traits(
            description=f"{self.component_name} (from {self.metadata.get('slug', 'widget')})",
            df=df,
            model=self.metadata.get("model", "claude-haiku-4-5-20251001"),
            exports=None,
            imports=None,
            theme=self.widget._theme,
            existing_code=self.standalone_code,
            existing_metadata={
                **self.metadata,
                "is_component_view": True,
                "source_component": self.component_name,
            },
            display_widget=False,
            cache=False,
        )
        return widget
    
    def _ipython_display_(self) -> None:
        """IPython display hook - shows the component as a standalone widget."""
        self.display()
    
    def _repr_mimebundle_(self, **kwargs) -> tuple[dict[str, Any], dict[str, Any]] | None:
        """Support rich display in IPython/Jupyter."""
        widget = self.display()
        if hasattr(widget, '_repr_mimebundle_'):
            return widget._repr_mimebundle_(**kwargs)
        return None


class _ComponentNamespace:
    """
    Namespace for accessing components on a widget.
    
    Provides attribute-style access to widget components and lists available components.
    
    Examples:
        >>> widget.component.scatter_chart  # Get ComponentReference
        >>> widget.component.list()  # Print available components
        >>> list(widget.component)  # Get list of component names
    """

    def __init__(self, widget: "VibeWidget"):
        self._widget = widget

    def __getattr__(self, name: str) -> ComponentReference:
        reference = self._widget._resolve_component_reference(name)
        if reference is None:
            available = self._widget._component_attr_names()
            hint = f" Available: {', '.join(available)}" if available else ""
            raise AttributeError(
                f"'{type(self._widget).__name__}.component' has no attribute '{name}'.{hint}"
            )
        return reference

    def __dir__(self) -> list[str]:
        return self._widget._component_attr_names() + ["list", "names"]
    
    def __iter__(self):
        """Iterate over component names."""
        return iter(self._widget._component_attr_names())
    
    def __len__(self) -> int:
        """Return number of components."""
        return len(self._widget._component_attr_names())
    
    @property
    def names(self) -> list[str]:
        """Get list of component names (snake_case for Python access)."""
        return self._widget._component_attr_names()
    
    def list(self) -> None:
        """Print available components."""
        components = []
        if hasattr(self._widget, "_widget_metadata") and self._widget._widget_metadata:
            components = self._widget._widget_metadata.get("components", [])
        
        if not components:
            print("No components found.")
            return
        
        print(f"Available components ({len(components)}):")
        for comp in components:
            py_name = self._widget._to_python_attr(comp)
            print(f"  • widget.component.{py_name}")


class _OutputsNamespace:
    """Namespace for accessing outputs on a widget."""

    def __init__(self, widget: "VibeWidget"):
        object.__setattr__(self, "_widget", widget)

    def __getattr__(self, name: str) -> ExportHandle:
        exports = getattr(self._widget, "_exports", {}) or {}
        if name in exports:
            accessors = getattr(self._widget, "_export_accessors", {})
            if name not in accessors:
                accessors[name] = ExportHandle(self._widget, name)
            return accessors[name]
        raise AttributeError(f"'{type(self._widget).__name__}.outputs' has no attribute '{name}'")

    def __dir__(self) -> list[str]:
        exports = getattr(self._widget, "_exports", {}) or {}
        return list(exports.keys())

    def __setattr__(self, name: str, value: Any) -> None:
        if name.startswith("_"):
            object.__setattr__(self, name, value)
            return
        exports = getattr(self._widget, "_exports", {}) or {}
        if name in exports:
            setattr(self._widget, name, value)
            return
        raise AttributeError(f"'{type(self._widget).__name__}.outputs' has no attribute '{name}'")


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
    audit_request = traitlets.Dict({}).tag(sync=True)
    audit_response = traitlets.Dict({}).tag(sync=True)
    audit_status = traitlets.Unicode("idle").tag(sync=True)
    audit_error = traitlets.Unicode("").tag(sync=True)
    audit_apply_request = traitlets.Dict({}).tag(sync=True)
    audit_apply_response = traitlets.Dict({}).tag(sync=True)
    audit_apply_status = traitlets.Unicode("idle").tag(sync=True)
    audit_apply_error = traitlets.Unicode("").tag(sync=True)
    execution_mode = traitlets.Unicode("auto").tag(sync=True)
    execution_approved = traitlets.Bool(True).tag(sync=True)
    execution_approved_hash = traitlets.Unicode("").tag(sync=True)

    def _ipython_display_(self) -> None:
        """Ensure rich display works in environments that skip mimebundle reprs."""
        try:
            from IPython.display import display

            bundle = self._repr_mimebundle_()
            if bundle is None:
                display(repr(self))
                return
            data, metadata = bundle
            display(data, metadata=metadata, raw=True)
        except Exception:
            pass

    def _repr_mimebundle_(self, **kwargs) -> tuple[dict[str, Any], dict[str, Any]] | None:
        """Return a widget mimebundle compatible with Jupyter display hooks."""
        try:
            from anywidget.widget import repr_mimebundle, _PLAIN_TEXT_MAX_LEN
        except Exception:
            return None

        plaintext = repr(self)
        if len(plaintext) > _PLAIN_TEXT_MAX_LEN:
            plaintext = plaintext[:_PLAIN_TEXT_MAX_LEN] + "..."
        return repr_mimebundle(model_id=self.model_id, repr_text=plaintext)

    @staticmethod
    def _trait_to_json(x, self):
        """Ensure export handles serialize to their underlying value."""
        if isinstance(x, ExportHandle) or getattr(x, "__vibe_export__", False):
            try:
                return x()
            except Exception:
                return None
        return x

    @classmethod
    def _create_with_dynamic_traits(
        cls,
        description: str,
        df: pd.DataFrame,
        model: str = DEFAULT_MODEL,
        exports: dict[str, str] | None = None,
        imports: dict[str, Any] | None = None,
        theme: Theme | None = None,
        data_var_name: str | None = None,
        base_code: str | None = None,
        base_components: list[str] | None = None,
        base_widget_id: str | None = None,
        existing_code: str | None = None,
        existing_metadata: dict[str, Any] | None = None,
        display_widget: bool = False,
        cache: bool = True,
        execution_mode: str | None = None,
        execution_approved: bool | None = None,
        execution_approved_hash: str | None = None,
        **kwargs,
    ) -> "VibeWidget":
        """Return a widget instance that includes traitlets for declared exports/imports."""
        exports = exports or {}
        imports = imports or {}

        dynamic_traits: dict[str, traitlets.TraitType] = {}
        for export_name in exports.keys():
            dynamic_traits[export_name] = traitlets.Any(default_value=None).tag(sync=True, to_json=_export_to_json_value)
        for import_name in imports.keys():
            if import_name not in dynamic_traits:
                dynamic_traits[import_name] = traitlets.Any(default_value=None).tag(sync=True, to_json=_import_to_json_value)

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
            exports=exports,
            imports=imports,
            theme=theme,
            data_var_name=data_var_name,
            base_code=base_code,
            base_components=base_components,
            base_widget_id=base_widget_id,
            existing_code=existing_code,
            existing_metadata=existing_metadata,
            display_widget=display_widget,
            cache=cache,
            execution_mode=execution_mode,
            execution_approved=execution_approved,
            execution_approved_hash=execution_approved_hash,
            **init_values,
            **kwargs,
        )

    def __init__(
        self, 
        description: str, 
        df: pd.DataFrame, 
        model: str = DEFAULT_MODEL,
        exports: dict[str, str] | None = None,
        imports: dict[str, Any] | None = None,
        theme: Theme | None = None,
        data_var_name: str | None = None,
        base_code: str | None = None,
        base_components: list[str] | None = None,
        base_widget_id: str | None = None,
        existing_code: str | None = None,
        existing_metadata: dict[str, Any] | None = None,
        display_widget: bool = False,
        cache: bool = True,
        execution_mode: str | None = None,
        execution_approved: bool | None = None,
        execution_approved_hash: str | None = None,
        **kwargs
    ):
        """
        Create a VibeWidget with automatic code generation.
        
        Args:
            description: Natural language description of desired visualization
            df: DataFrame to visualize
            model: OpenRouter model to use (or alias resolved via config)
            exports: Dict of trait_name -> description for state this widget exposes
            imports: Dict of trait_name -> source widget/value for state this widget consumes
            data_var_name: Variable name of the data parameter for cache key
            base_code: Optional base widget code for revision/composition
            base_components: Optional list of component names from base widget
            base_widget_id: Optional ID of base widget for provenance tracking
            cache: If False, bypass widget cache and regenerate
            **kwargs: Additional widget parameters
        """
        parser = CodeStreamParser()
        self._exports = exports or {}
        self._imports = imports or {}
        self._export_accessors: dict[str, ExportHandle] = {}
        self._outputs_namespace: _OutputsNamespace | None = None
        self._component_namespace: _ComponentNamespace | None = None
        self._widget_metadata = None
        self._theme = theme
        self._base_code = base_code
        self._base_components = base_components or []
        self._base_widget_id = base_widget_id
        
        app_wrapper_dir = Path(__file__).parent
        app_wrapper_path = app_wrapper_dir / "AppWrapper.bundle.js"
        if not app_wrapper_path.exists():
            # Fallback for older builds
            app_wrapper_path = app_wrapper_dir / "app_wrapper.js"
        self._esm = app_wrapper_path.read_text()
        
        data_json = df.to_dict(orient="records")
        data_json = clean_for_json(data_json)
        
        if execution_mode is None:
            execution_mode = "auto"
        if execution_approved is None:
            execution_approved = execution_mode != "approve"
        if execution_approved_hash is None:
            execution_approved_hash = ""

        super().__init__(
            data=data_json,
            description=description,
            status="generating",
            logs=[],
            code="",
            error_message="",
            retry_count=0,
            audit_request={},
            audit_response={},
            audit_status="idle",
            audit_error="",
            audit_apply_request={},
            audit_apply_response={},
            audit_apply_status="idle",
            audit_apply_error="",
            execution_mode=execution_mode,
            execution_approved=execution_approved,
            execution_approved_hash=execution_approved_hash,
            **kwargs
        )

        if display_widget:
            _display_widget(self)
        
        self.observe(self._on_error, names='error_message')
        self.observe(self._on_grab_edit, names='grab_edit_request')
        self.observe(self._on_audit_request, names='audit_request')
        self.observe(self._on_audit_apply_request, names='audit_apply_request')
        self.observe(self._on_code_change, names='code')
        self.observe(self._on_execution_approved, names='execution_approved')
        
        try:
            self.logs = [f"Analyzing data: {df.shape[0]} rows × {df.shape[1]} columns"]
            
            resolved_model, config = _resolve_model(model)
            provider = OpenRouterProvider(resolved_model, config.api_key)
            
            if existing_code is not None:
                self.logs = self.logs + ["Reusing existing widget code"]
                self.code = existing_code
                self.status = "ready"
                self.description = description
                self._widget_metadata = existing_metadata or {}
                if self._theme and "theme_description" not in self._widget_metadata:
                    self._widget_metadata["theme_description"] = self._theme.description
                    self._widget_metadata["theme_name"] = self._theme.name
                imports_serialized = {}
                if self._imports:
                    for import_name in self._imports.keys():
                        imports_serialized[import_name] = f"<imported_trait:{import_name}>"
                self.data_info = LLMProvider.build_data_info(
                    df,
                    self._exports,
                    imports_serialized,
                    theme_description=self._theme.description if self._theme else None,
                )
                return
            
            # Serialize imports for cache lookup
            imports_serialized = {}
            if self._imports:
                for import_name in self._imports.keys():
                    imports_serialized[import_name] = f"<imported_trait:{import_name}>"
            
            store = WidgetStore()
            cached_widget = None
            if cache:
                cached_widget = store.lookup(
                    description=description,
                    data_var_name=data_var_name,
                    data_shape=df.shape,
                    exports=self._exports,
                    imports_serialized=imports_serialized,
                    theme_description=self._theme.description if self._theme else None,
                )
            else:
                self.logs = self.logs + ["Skipping cache (cache=False)"]
            
            self.orchestrator = AgenticOrchestrator(provider=provider)
            
            if cached_widget:
                self.logs = self.logs + ["✓ Found cached widget"]
                self.logs = self.logs + [f"  {cached_widget['slug']} v{cached_widget['version']}"]
                self.logs = self.logs + [f"  Created: {cached_widget['created_at'][:10]}"]
                widget_code = store.load_widget_code(cached_widget)
                self.code = widget_code
                self.status = "ready"
                self.description = description
                self._widget_metadata = cached_widget
                if self._theme is None and cached_widget.get("theme_description"):
                    self._theme = Theme(
                        description=cached_widget.get("theme_description"),
                        name=cached_widget.get("theme_name"),
                    )
                
                # Store data_info for error recovery
                self.data_info = LLMProvider.build_data_info(
                    df,
                    self._exports,
                    imports_serialized,
                    theme_description=self._theme.description if self._theme else None,
                )
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
                base_code=self._base_code,
                base_components=self._base_components,
                theme_description=self._theme.description if self._theme else None,
                progress_callback=stream_callback,
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
                model=resolved_model,
                exports=self._exports,
                imports_serialized=imports_serialized,
                theme_name=self._theme.name if self._theme else None,
                theme_description=self._theme.description if self._theme else None,
                notebook_path=notebook_path,
            )
            
            # Update widget_entry with base_widget_id if this is a revision
            if self._base_widget_id:
                widget_entry["base_widget_id"] = self._base_widget_id
                # Update in index
                for entry in store.index["widgets"]:
                    if entry["id"] == widget_entry["id"]:
                        entry["base_widget_id"] = self._base_widget_id
                        break
                store._save_index()
            
            self.logs = self.logs + [f"Widget saved: {widget_entry['slug']} v{widget_entry['version']}"]
            self.logs = self.logs + [f"Location: .vibewidget/widgets/{widget_entry['file_name']}"]
            self.code = widget_code
            self.status = "ready"
            self.description = description
            self._widget_metadata = widget_entry
            
            # Store data_info for error recovery  (build from LLMProvider method)
            self.data_info = LLMProvider.build_data_info(
                df,
                self._exports,
                imports_serialized,
                theme_description=self._theme.description if self._theme else None,
            )
            
        except Exception as e:
            self.status = "error"
            self.logs = self.logs + [f"Error: {str(e)}"]
            raise

    def __getattribute__(self, name: str):
        """Return callable handles for exports to support import chaining."""
        if not name.startswith("_") and name not in {"outputs", "component"}:
            try:
                exports = object.__getattribute__(self, "_exports")
                if name in exports:
                    # Avoid wrapping when traitlets is serializing state
                    for frame in inspect.stack()[1:4]:
                        if frame.function in {"get_state", "_trait_to_json", "_should_send_property"} or "traitlets" in frame.filename:
                            return super().__getattribute__(name)
                    accessors = object.__getattribute__(self, "_export_accessors")
                    if name not in accessors:
                        accessors[name] = ExportHandle(self, name)
                    return accessors[name]
            except Exception:
                # Fall back to default lookup for early init or missing attrs
                pass
        return super().__getattribute__(name)

    # --- Convenience rerun API ---
    def _set_recipe(
        self,
        *,
        description: str,
        data_source: Any,
        data_type: type | None,
        data_columns: list[str] | None,
        exports: dict[str, str] | None,
        imports: dict[str, Any] | None,
        model: str,
        theme: Theme | None,
        base_code: str | None = None,
        base_components: list[str] | None = None,
        base_widget_id: str | None = None,
    ) -> None:
        self._recipe_description = description
        self._recipe_data_source = data_source
        self._recipe_data_type = data_type
        self._recipe_data_columns = data_columns
        self._recipe_exports = exports
        self._recipe_imports = imports
        self._recipe_model = model
        self._recipe_model_resolved = model
        self._recipe_theme = theme
        self._recipe_base_code = base_code
        self._recipe_base_components = base_components
        self._recipe_base_widget_id = base_widget_id

    def __call__(self, *args, **kwargs):
        """Create a new widget instance, swapping data/inputs heuristically."""
        if not args and not kwargs:
            return self._rerun_with()
        if not args and set(kwargs.keys()) == {"display"}:
            return self._rerun_with(**kwargs)
        return self._rerun_with(*args, **kwargs)

    def save(self, path: str | Path, include_inputs: bool = False) -> Path:
        """Save this widget to a portable .vw bundle."""
        target = Path(path)
        if target.suffix != ".vw":
            target = target.with_suffix(".vw")

        metadata = getattr(self, "_widget_metadata", {}) or {}
        theme_payload = None
        if self._theme:
            theme_payload = {
                "name": getattr(self._theme, "name", None),
                "description": getattr(self._theme, "description", None),
            }
        elif metadata.get("theme_name") or metadata.get("theme_description"):
            theme_payload = {
                "name": metadata.get("theme_name"),
                "description": metadata.get("theme_description"),
            }

        inputs_signature = {name: "<input>" for name in (self._imports or {}).keys()}
        if self.data:
            inputs_signature.setdefault("data", "<input>")
        save_inputs = {"embedded": False, "values": {}}
        if include_inputs:
            save_inputs = _serialize_inputs(self)

        payload = {
            "version": "1.0",
            "created_at": metadata.get("created_at"),
            "description": self.description,
            "code": self.code or "",
            "outputs": dict(self._exports or {}),
            "inputs_signature": inputs_signature,
            "theme": theme_payload,
            "components": metadata.get("components", []),
            "model": metadata.get("model"),
            "audit": metadata.get("audit"),
            "save_inputs": save_inputs,
        }

        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=True)
        return target

    def _rerun_with(self, *args, **kwargs) -> "VibeWidget":
        if not hasattr(self, "_recipe_description"):
            raise ValueError("This widget was created before rerun support was added.")

        display = kwargs.pop("display", True)
        candidate_data = kwargs.pop("data", None)
        candidate_inputs = kwargs.pop("inputs", None)
        if "imports" in kwargs:
            raise TypeError("Use 'inputs' instead of 'imports'.")
        candidate_imports = candidate_inputs
        if isinstance(candidate_imports, InputsBundle):
            if candidate_data is None:
                candidate_data = candidate_imports.data
            candidate_imports = candidate_imports.inputs

        if len(args) > 1:
            raise TypeError("Pass at most one positional argument to override data/inputs.")

        if len(args) == 1 and candidate_data is None and candidate_imports is None:
            arg = args[0]
            if isinstance(arg, InputsBundle):
                bundle_data = arg.data if arg.data is not None else candidate_data
                bundle_inputs = arg.inputs
                candidate_data = bundle_data
                merged = dict(self._recipe_imports or {})
                merged.update(bundle_inputs or {})
                candidate_imports = merged
            else:
                matched = False
                if self._recipe_data_type and isinstance(arg, self._recipe_data_type):
                    candidate_data = arg
                    matched = True
                if not matched:
                    # Try to swap an import with the same type
                    for name, source in (self._recipe_imports or {}).items():
                        if source is not None and isinstance(arg, type(source)):
                            merged = dict(self._recipe_imports or {})
                            merged[name] = arg
                            candidate_imports = merged
                            matched = True
                            break
                if not matched:
                    # Fallback: treat as data (covers DataFrame, str path, etc.)
                    candidate_data = arg

        data = candidate_data if candidate_data is not None else self._recipe_data_source
        imports = candidate_imports if candidate_imports is not None else self._recipe_imports
        df = load_data(data)
        existing_code = getattr(self, "code", None)
        existing_metadata = getattr(self, "_widget_metadata", None)

        if self._recipe_data_columns and isinstance(df, pd.DataFrame):
            missing = set(self._recipe_data_columns) - set(df.columns)
            if missing:
                raise ValueError(
                    "The new dataset is missing required columns for this widget: "
                    f"{sorted(missing)}. Provide data with these columns or regenerate the widget."
                )

        widget = VibeWidget._create_with_dynamic_traits(
            description=self._recipe_description,
            df=df,
            model=self._recipe_model_resolved,
            exports=self._recipe_exports,
            imports=imports,
            theme=self._recipe_theme,
            data_var_name=None,
            base_code=getattr(self, '_recipe_base_code', None),
            base_components=getattr(self, '_recipe_base_components', None),
            base_widget_id=getattr(self, '_recipe_base_widget_id', None),
            existing_code=existing_code,
            existing_metadata=existing_metadata,
            display_widget=display,
            execution_mode=self.execution_mode,
            execution_approved=None,
            execution_approved_hash=self.execution_approved_hash,
        )
        return widget

    def edit(
        self,
        description: str,
        data: pd.DataFrame | str | Path | None = None,
        outputs: dict[str, str] | OutputBundle | None = None,
        inputs: dict[str, Any] | InputsBundle | None = None,
        theme: Theme | str | None = None,
        config: Config | None = None,
        cache: bool = True,
    ) -> "VibeWidget":
        """
        Instance helper that mirrors vw.edit but defaults the source to self.
        Supports the same inputs/outputs/data wrappers as vw.edit.
        """
        data, outputs, inputs, _ = _normalize_api_inputs(
            data=data,
            outputs=outputs,
            inputs=inputs,
        )
        return edit(
            description=description,
            source=self,
            data=data,
            outputs=outputs,
            inputs=inputs,
            theme=theme,
            config=config,
            cache=cache,
        )

    def audit(
        self,
        level: str = "fast",
        *,
        reuse: bool = True,
        display: bool = True,
        cache: bool = True,
    ) -> dict[str, Any]:
        """Run an audit on the current widget code."""
        try:
            if not cache:
                reuse = False
            return self._run_audit(level=level, reuse=reuse, display=display)
        except Exception as exc:
            self.audit_status = "error"
            self.audit_error = str(exc)
            raise

    def _parse_audit_json(self, raw_text: str) -> dict[str, Any]:
        """Parse JSON from LLM output with a best-effort fallback."""
        try:
            return json.loads(raw_text)
        except json.JSONDecodeError:
            start = raw_text.find("{")
            end = raw_text.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(raw_text[start:end + 1])
            raise

    def _normalize_audit_report(
        self,
        report: dict[str, Any],
        level: str,
        widget_description: str,
    ) -> dict[str, Any]:
        root_key = "fast_audit" if level == "fast" else "full_audit"
        alt_key = "full_audit" if root_key == "fast_audit" else "fast_audit"
        if root_key in report:
            payload = report.get(root_key)
        elif alt_key in report:
            payload = report.get(alt_key)
        else:
            payload = report
        if not isinstance(payload, dict):
            payload = {}
        payload.setdefault("version", "1.0")
        payload.setdefault("widget_description", widget_description)

        raw_concerns = payload.get("concerns", [])
        if not isinstance(raw_concerns, list):
            raw_concerns = []

        normalized_concerns: list[dict[str, Any]] = []
        for concern in raw_concerns:
            if not isinstance(concern, dict):
                continue
            location = normalize_location(concern.get("location", "global"))
            impact = str(concern.get("impact", "low")).lower()
            if level == "full" and impact not in {"high", "medium", "low"}:
                impact = "medium"
            if level == "fast" and impact not in {"high", "medium", "low"}:
                impact = "low"

            alternatives = concern.get("alternatives", [])
            if not isinstance(alternatives, list):
                alternatives = []
            if level == "full":
                normalized_alts = []
                for item in alternatives:
                    if isinstance(item, dict):
                        normalized_alts.append({
                            "option": str(item.get("option", "")).strip(),
                            "when_better": str(item.get("when_better", "")).strip(),
                            "when_worse": str(item.get("when_worse", "")).strip(),
                        })
                    else:
                        normalized_alts.append({
                            "option": str(item).strip(),
                            "when_better": "",
                            "when_worse": "",
                        })
                alternatives = normalized_alts

            normalized = {
                "id": str(concern.get("id", "")).strip() or "concern.unknown",
                "location": location,
                "summary": str(concern.get("summary", "")).strip(),
                "details": str(concern.get("details", "")).strip(),
                "technical_summary": str(concern.get("technical_summary", "")).strip(),
                "impact": impact,
                "default": bool(concern.get("default", False)),
                "alternatives": alternatives,
            }
            if level == "full":
                lenses = concern.get("lenses", {})
                if not isinstance(lenses, dict):
                    lenses = {}
                normalized["rationale"] = str(concern.get("rationale", "")).strip()
                normalized["lenses"] = {
                    "impact": str(lenses.get("impact", "medium")).lower(),
                    "uncertainty": str(lenses.get("uncertainty", "")).strip(),
                    "reproducibility": str(lenses.get("reproducibility", "")).strip(),
                    "edge_behavior": str(lenses.get("edge_behavior", "")).strip(),
                    "default_vs_explicit": str(lenses.get("default_vs_explicit", "")).strip(),
                    "appropriateness": str(lenses.get("appropriateness", "")).strip(),
                    "safety": str(lenses.get("safety", "")).strip(),
                }
            normalized_concerns.append(normalized)

        payload["concerns"] = normalized_concerns
        open_questions = payload.get("open_questions", [])
        if not isinstance(open_questions, list):
            open_questions = []
        payload["open_questions"] = [str(q).strip() for q in open_questions if str(q).strip()]
        safety = payload.get("safety", {})
        if not isinstance(safety, dict):
            safety = {}
        checks = safety.get("checks", {})
        if not isinstance(checks, dict):
            checks = {}
        def _normalize_check(key: str) -> dict[str, str]:
            raw = checks.get(key, {})
            if not isinstance(raw, dict):
                raw = {}
            status = str(raw.get("status", "unknown")).lower()
            if status not in {"yes", "no", "unknown"}:
                status = "unknown"
            return {
                "status": status,
                "evidence": str(raw.get("evidence", "")).strip(),
                "notes": str(raw.get("notes", "")).strip(),
            }
        normalized_checks = {
            "external_network_usage": _normalize_check("external_network_usage"),
            "dynamic_code_execution": _normalize_check("dynamic_code_execution"),
            "storage_writes": _normalize_check("storage_writes"),
            "cross_origin_fetch": _normalize_check("cross_origin_fetch"),
            "iframe_script_injection": _normalize_check("iframe_script_injection"),
        }
        risk_level = str(safety.get("risk_level", "unknown")).lower()
        if risk_level not in {"low", "medium", "high", "unknown"}:
            risk_level = "unknown"
        caveats = safety.get("caveats", [])
        if not isinstance(caveats, list):
            caveats = []
        payload["safety"] = {
            "checks": normalized_checks,
            "risk_level": risk_level,
            "caveats": [str(c).strip() for c in caveats if str(c).strip()],
        }
        return {root_key: payload}

    def _run_audit(
        self,
        *,
        level: str,
        reuse: bool,
        display: bool,
    ) -> dict[str, Any]:
        if not self.code:
            raise ValueError("No widget code available to audit.")
        level = level.lower()
        if level not in {"fast", "full"}:
            raise ValueError("Audit level must be 'fast' or 'full'.")

        self.audit_status = "running"
        self.audit_error = ""

        code = self.code
        widget_metadata = self._widget_metadata or {}
        widget_description = self.description or widget_metadata.get("description", "Widget")
        store = AuditStore()
        current_code_hash = compute_code_hash(code)
        current_line_hashes = compute_line_hashes(code)

        previous_audit = None
        if reuse and widget_metadata.get("id"):
            previous_audit = store.load_latest_audit(widget_metadata["id"], level)
        if not previous_audit and reuse and widget_metadata.get("base_widget_id"):
            previous_audit = store.load_latest_audit(widget_metadata["base_widget_id"], level)

        reused_concerns: list[dict[str, Any]] = []
        stale_concerns: list[dict[str, Any]] = []
        previous_questions: list[str] = []
        changed_lines: list[int] | None = None

        if reuse and previous_audit:
            prev_report = previous_audit.get("report", {})
            root_key = "fast_audit" if level == "fast" else "full_audit"
            prev_payload = prev_report.get(root_key, {})
            prev_concerns = prev_payload.get("concerns", []) if isinstance(prev_payload, dict) else []
            prev_line_hashes = previous_audit.get("line_hashes", {})
            prev_code_hash = previous_audit.get("code_hash")
            previous_questions = prev_payload.get("open_questions", []) if isinstance(prev_payload, dict) else []
            if not isinstance(previous_questions, list):
                previous_questions = []

            for concern in prev_concerns:
                if not isinstance(concern, dict):
                    continue
                location = normalize_location(concern.get("location", "global"))
                if location == "global":
                    if prev_code_hash == current_code_hash:
                        reused_concerns.append(concern)
                    else:
                        stale_concerns.append(concern)
                    continue
                line_hashes = concern.get("line_hashes", [])
                if not isinstance(line_hashes, list) or not line_hashes or len(line_hashes) != len(location):
                    stale_concerns.append(concern)
                    continue
                current_matches = []
                for line_num, expected_hash in zip(location, line_hashes):
                    current_matches.append(current_line_hashes.get(int(line_num)) == expected_hash)
                if all(current_matches):
                    reused_concerns.append(concern)
                else:
                    stale_concerns.append(concern)

            if not stale_concerns and prev_code_hash == current_code_hash:
                report_public = strip_internal_fields(prev_report)
                self.audit_status = "idle"
                result = {
                    "level": level,
                    "report": report_public,
                    "report_yaml": previous_audit.get("report_yaml", ""),
                    "saved_path": str((store.audits_dir / previous_audit["entry"]["yaml_file_name"]).resolve()),
                    "audit_id": previous_audit["entry"]["audit_id"],
                    "reused_count": len(reused_concerns),
                    "updated_count": 0,
                }
                self.audit_response = result
                if display:
                    try:
                        from IPython.display import display, Markdown
                        display(Markdown(f"```yaml\n{result['report_yaml']}\n```"))
                    except Exception:
                        print(result["report_yaml"])
                return result

            prev_line_hashes_int = {int(k): v for k, v in prev_line_hashes.items()} if isinstance(prev_line_hashes, dict) else {}
            max_line = max(max(prev_line_hashes_int.keys(), default=0), max(current_line_hashes.keys(), default=0))
            changed = []
            for line_num in range(1, max_line + 1):
                if prev_line_hashes_int.get(line_num) != current_line_hashes.get(line_num):
                    changed.append(line_num)
            changed_lines = changed or None

        clean_data_info = clean_for_json(self.data_info)
        numbered_code = render_numbered_code(code)

        provider = getattr(self, "orchestrator", None).provider if getattr(self, "orchestrator", None) else None
        if provider is None:
            resolved_model, config = _resolve_model(widget_metadata.get("model"))
            provider = OpenRouterProvider(resolved_model, config.api_key)

        raw_report = provider.generate_audit_report(
            code=numbered_code,
            description=widget_description,
            data_info=clean_data_info,
            level=level,
            changed_lines=changed_lines,
        )
        parsed = self._parse_audit_json(raw_report)
        normalized_report = self._normalize_audit_report(parsed, level, widget_description)

        root_key = "fast_audit" if level == "fast" else "full_audit"
        payload = normalized_report[root_key]
        new_concerns = payload.get("concerns", [])
        filtered_concerns: list[dict[str, Any]] = []
        for concern in new_concerns:
            location = normalize_location(concern.get("location", "global"))
            concern["location"] = location
            if changed_lines and location != "global":
                if not any(line in changed_lines for line in location):
                    continue
            if location != "global":
                concern["line_hashes"] = [current_line_hashes.get(int(line)) for line in location]
            filtered_concerns.append(concern)

        merged_concerns = reused_concerns[:]
        existing_ids = {c.get("id") for c in merged_concerns if isinstance(c, dict)}
        for concern in filtered_concerns:
            if concern.get("id") in existing_ids:
                continue
            merged_concerns.append(concern)

        new_questions = payload.get("open_questions", [])
        if not isinstance(new_questions, list):
            new_questions = []
        merged_questions = list(dict.fromkeys([*previous_questions, *new_questions]))
        payload["concerns"] = merged_concerns
        payload["open_questions"] = merged_questions
        normalized_report[root_key] = payload

        report_public = strip_internal_fields(normalized_report)
        report_yaml = format_audit_yaml(report_public)

        saved = store.save_audit(
            level=level,
            widget_metadata=widget_metadata,
            report=normalized_report,
            report_yaml=report_yaml,
            code_hash=current_code_hash,
            line_hashes=current_line_hashes,
            reused_concerns=[c.get("id") for c in reused_concerns if isinstance(c, dict)],
            updated_concerns=[c.get("id") for c in filtered_concerns if isinstance(c, dict)],
            source_widget_id=widget_metadata.get("base_widget_id"),
        )

        result = {
            "level": level,
            "report": report_public,
            "report_yaml": report_yaml,
            "saved_path": str((store.audits_dir / saved["entry"]["yaml_file_name"]).resolve()),
            "audit_id": saved["entry"]["audit_id"],
            "reused_count": len(reused_concerns),
            "updated_count": len(filtered_concerns),
        }

        self.audit_status = "idle"
        self.audit_response = result
        if display:
            try:
                from IPython.display import display, Markdown
                display(Markdown(f"```yaml\n{report_yaml}\n```"))
            except Exception:
                print(report_yaml)
        return result

    def _on_audit_request(self, change):
        """Handle audit requests from the frontend."""
        request = change.get("new") or {}
        if not request:
            return
        if self.audit_status == "running":
            return
        level = str(request.get("level", "fast")).lower()
        reuse = bool(request.get("reuse", True))
        try:
            result = self._run_audit(level=level, reuse=reuse, display=False)
            self.audit_response = result
        except Exception as exc:
            self.audit_status = "error"
            self.audit_error = str(exc)
            self.audit_response = {"error": str(exc), "level": level}
        finally:
            self.audit_request = {}

    def _on_audit_apply_request(self, change):
        """Apply audit-driven changes via the LLM."""
        request = change.get("new") or {}
        if not request:
            return
        if self.audit_apply_status == "running":
            return

        changes = request.get("changes", [])
        base_code = request.get("base_code") or self.code
        if not base_code:
            self.audit_apply_error = "No source code available to apply changes."
            self.audit_apply_status = "error"
            self.audit_apply_request = {}
            return

        self.audit_apply_status = "running"
        self.audit_apply_error = ""
        self.status = "generating"

        change_lines = []
        for item in changes:
            if not isinstance(item, dict):
                continue
            summary = str(item.get("summary") or item.get("label") or "").strip()
            details = str(item.get("details") or "").strip()
            technical = str(item.get("technical_summary") or "").strip()
            user_note = str(item.get("user_note") or "").strip()
            alternative = str(item.get("alternative") or "").strip()
            location = item.get("location")
            if isinstance(location, list) and location:
                location_str = f"lines {', '.join(str(x) for x in location)}"
            else:
                location_str = "global"
            parts = [f"- {summary or 'Change'} ({location_str})"]
            if alternative:
                parts.append(f"  alternative: {alternative}")
            if user_note:
                parts.append(f"  user_note: {user_note}")
            if details:
                parts.append(f"  details: {details}")
            if technical:
                parts.append(f"  technical: {technical}")
            change_lines.append("\n".join(parts))

        revision_request = "Apply these audit changes:\n" + "\n".join(change_lines)

        try:
            clean_data_info = clean_for_json(self.data_info)
            revised_code = self.orchestrator.revise_code(
                code=base_code,
                revision_request=revision_request,
                data_info=clean_data_info,
            )
            self.code = revised_code
            self.status = "ready"
            self.audit_apply_status = "idle"
            self.audit_apply_response = {"success": True, "applied": len(changes)}
        except Exception as exc:
            self.audit_apply_status = "error"
            self.audit_apply_error = str(exc)
            self.audit_apply_response = {"success": False, "error": str(exc)}
            self.status = "ready"
        finally:
            self.audit_apply_request = {}
    
    def _on_error(self, change):
        """Called when frontend reports a runtime error."""
        error_msg = change['new']

        if error_msg:
            print(f"[vibe_widget] Frontend runtime error:\n{error_msg}", file=sys.stderr)

        if not error_msg or self.retry_count >= 2:
            return
        
        self.retry_count += 1
        self.status = 'generating'
        
        error_preview = error_msg.split('\n')[0][:100]
        self.logs = self.logs + [f"Error detected: {error_preview}"]
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
            self.retry_count = 0
        except Exception as e:
            self.status = "error"
            self.logs = self.logs + [f"Fix attempt failed: {str(e)}"]
            self.error_message = ""
    
    @property
    def outputs(self) -> _OutputsNamespace:
        """Namespace accessor for widget outputs."""
        if self._outputs_namespace is None:
            self._outputs_namespace = _OutputsNamespace(self)
        return self._outputs_namespace

    @property
    def component(self) -> _ComponentNamespace:
        """Namespace accessor for widget components."""
        if self._component_namespace is None:
            self._component_namespace = _ComponentNamespace(self)
        return self._component_namespace
    
    @property
    def components(self) -> list[str]:
        """
        List of available component names in this widget.
        
        Returns:
            List of component names (snake_case for Python access)
        
        Examples:
            >>> widget.components
            ['scatter_chart', 'color_legend', 'slider']
            >>> widget.component.scatter_chart.display()  # Display one component
        """
        return self._component_attr_names()
    
    def list_components(self) -> None:
        """
        Print a formatted list of available components.
        
        Shows component names and how to access/display them.
        """
        self.component.list()

    def _component_attr_names(self) -> list[str]:
        components = []
        if hasattr(self, "_widget_metadata") and self._widget_metadata and "components" in self._widget_metadata:
            components = self._widget_metadata["components"] or []
        return [self._to_python_attr(comp) for comp in components]

    def _resolve_component_reference(self, name: str) -> ComponentReference | None:
        if not hasattr(self, "_widget_metadata") or not self._widget_metadata or "components" not in self._widget_metadata:
            return None
        components = self._widget_metadata["components"]
        for comp in components:
            if self._to_python_attr(comp) == name or comp.lower() == name.lower():
                return ComponentReference(self, comp)
        return None

    def __dir__(self):
        """Return list of attributes including outputs/component helpers for autocomplete."""
        # Get default attributes
        default_attrs = object.__dir__(self)
        export_attrs: list[str] = []
        
        if hasattr(self, "_exports") and self._exports:
            export_attrs = list(self._exports.keys())
        return list(set(default_attrs + export_attrs + ["outputs", "component"]))
    
    def __getattr__(self, name: str):
        """
        Enable access to components via dot notation (legacy).
        
        Examples:
            scatter.component.slider -> ComponentReference
            scatter.component.color_legend -> ComponentReference
        """
        # Avoid infinite recursion for special attributes
        if name.startswith('_'):
            raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")
        
        reference = self._resolve_component_reference(name)
        if reference is not None:
            return reference
        
        raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")

    def _get_export_value(self, export_name: str) -> Any:
        """Return the live value of an export (used by ExportHandle)."""
        return super().__getattribute__(export_name)
    
    @staticmethod
    def _to_python_attr(component_name: str) -> str:
        """Convert PascalCase component name to snake_case attribute."""
        # Insert underscore before uppercase letters and convert to lowercase
        import re
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', component_name)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

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
        previous_metadata = self._widget_metadata
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
                theme_name=self._theme.name if self._theme else None,
                theme_description=self._theme.description if self._theme else None,
                notebook_path=store.get_notebook_path(),
            )
            if previous_metadata and previous_metadata.get("id"):
                widget_entry["base_widget_id"] = previous_metadata["id"]
                for entry in store.index["widgets"]:
                    if entry["id"] == widget_entry["id"]:
                        entry["base_widget_id"] = previous_metadata["id"]
                        break
                store._save_index()
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

    def _on_code_change(self, change):
        """Reset approval when code changes unless it matches an approved hash."""
        if self.execution_mode != "approve":
            if not self.execution_approved:
                self.execution_approved = True
            return
        current_hash = compute_code_hash(self.code or "")
        approved_hash = self.execution_approved_hash or ""
        if approved_hash and current_hash == approved_hash:
            if not self.execution_approved:
                self.execution_approved = True
        else:
            if self.execution_approved:
                self.execution_approved = False

    def _on_execution_approved(self, change):
        """Persist approval hash when user approves the current code."""
        if not change.get("new"):
            return
        self.execution_approved_hash = compute_code_hash(self.code or "")


def _resolve_import_source(import_name: str, import_source: Any) -> tuple[Any | None, str | None]:
    """Resolve a provided import source into a widget + trait name."""
    if isinstance(import_source, ExportHandle):
        return import_source.widget, import_source.name
    
    if hasattr(import_source, "trait_names") and hasattr(import_source, import_name):
        return import_source, import_name
    
    if hasattr(import_source, "__self__"):
        source_widget = import_source.__self__
        if hasattr(source_widget, import_name):
            return source_widget, import_name
    
    return None, None


def _serialize_inputs(widget: VibeWidget) -> dict[str, Any]:
    """Serialize inputs for save/load bundles."""
    values: dict[str, Any] = {}
    # Data is treated as an input and stored under "data".
    try:
        values["data"] = clean_for_json(widget.data)
    except Exception:
        values["data"] = widget.data

    for name, value in (widget._imports or {}).items():
        if isinstance(value, ExportHandle) or getattr(value, "__vibe_export__", False):
            values[name] = {"type": "export_handle", "name": getattr(value, "name", name)}
            continue
        try:
            values[name] = clean_for_json(value)
        except Exception:
            values[name] = str(value)

    return {"embedded": True, "values": values}


def _link_imports(widget: VibeWidget, imports: dict[str, Any] | None) -> None:
    """Link imported traits to widget."""
    if not imports:
        return
    
    for import_name, import_source in imports.items():
        source_widget, source_trait = _resolve_import_source(import_name, import_source)
        if source_widget and source_trait:
            if isinstance(source_widget, VibeWidget) and source_trait in getattr(source_widget, "_exports", {}):
                try:
                    initial_value = source_widget._get_export_value(source_trait)
                    setattr(widget, import_name, initial_value)
                except AttributeError:
                    pass

                def _propagate(change, target_widget=widget, target_trait=import_name):
                    target_widget.set_trait(target_trait, change.new)

                source_widget.observe(_propagate, names=source_trait)
            else:
                traitlets.link((source_widget, source_trait), (widget, import_name))


def _display_widget(widget: VibeWidget) -> None:
    """Display widget in IPython environment if available."""
    try:
        from IPython.display import display
        display(widget)
    except ImportError:
        pass
    except Exception as exc:
        print(f"[vibe_widget] Display error: {exc}", file=sys.stderr)


def _resolve_model(
    model_override: str | None = None,
    config_override: Config | None = None,
) -> tuple[str, Config]:
    """Resolve the model using global config; config arg is deprecated shim."""
    if config_override is not None:
        warnings.warn(
            "Passing `config` to create/edit is deprecated; call vw.config(...) first.",
            DeprecationWarning,
            stacklevel=3,
        )
        set_global_config(config_override)

    config = get_global_config()
    candidate = model_override or config.model
    model_map = PREMIUM_MODELS if config.mode == "premium" else STANDARD_MODELS
    resolved_model = model_map.get(candidate, candidate)
    return resolved_model, config


def _normalize_api_inputs(
    data: Any,
    outputs: dict[str, str] | OutputBundle | None,
    inputs: dict[str, Any] | InputsBundle | None,
) -> tuple[Any, dict[str, str] | None, dict[str, Any] | None, str | None]:
    """Allow flexible ordering/wrapping for outputs/inputs/data."""
    normalized_data = data
    normalized_inputs = inputs
    normalized_outputs = outputs
    data_var_name: str | None = None

    # Data can be passed as an InputsBundle to keep everything together
    if isinstance(normalized_data, InputsBundle):
        data_var_name = normalized_data.data_name
        bundle_inputs = normalized_data.inputs or {}
        if isinstance(normalized_inputs, InputsBundle):
            normalized_inputs = {**bundle_inputs, **(normalized_inputs.inputs or {})}
        else:
            normalized_inputs = {**bundle_inputs, **(normalized_inputs or {})}
        normalized_data = normalized_data.data

    if isinstance(normalized_outputs, OutputBundle):
        normalized_outputs = normalized_outputs.outputs

    if isinstance(normalized_inputs, InputsBundle):
        if normalized_data is None:
            normalized_data = normalized_inputs.data
            data_var_name = normalized_inputs.data_name or data_var_name
        normalized_inputs = normalized_inputs.inputs

    return normalized_data, normalized_outputs, normalized_inputs, data_var_name


def create(
    description: str,
    data: pd.DataFrame | str | Path | None = None,
    outputs: dict[str, str] | None = None,
    inputs: dict[str, Any] | None = None,
    theme: Theme | str | None = None,
    config: Config | None = None,
    display: bool = True,
    cache: bool = True,
) -> VibeWidget:
    """Create a VibeWidget visualization with automatic data processing.
    
    Args:
        description: Natural language description of the visualization
        data: DataFrame, file path, or URL to visualize
        outputs: Dict of {trait_name: description} for exposed state
        inputs: Dict of {trait_name: source} for consumed state
        theme: Theme object, theme name, or prompt string
        config: Optional Config object with model settings (deprecated; call vw.config instead)
        display: Whether to display the widget immediately (IPython environments only)
        cache: If False, bypass cache and regenerate widget/theme
    
    Returns:
        VibeWidget instance
    
    Examples:
        >>> widget = create("show temperature trends", df)
        >>> widget = create("visualize sales data", "sales.csv")
    """
    if inputs is None and data is not None and not isinstance(data, InputsBundle):
        frame = inspect.currentframe()
        caller_frame = frame.f_back if frame else None
        data = _build_inputs_bundle((data,), {}, caller_frame=caller_frame)

    data, outputs, inputs, data_var_name = _normalize_api_inputs(
        data=data,
        outputs=outputs,
        inputs=inputs,
    )
    model, resolved_config = _resolve_model(config_override=config)
    df = load_data(data)
    resolved_theme = resolve_theme_for_request(
        theme,
        model=model,
        api_key=resolved_config.api_key if resolved_config else None,
        cache=cache,
    )

    widget = VibeWidget._create_with_dynamic_traits(
        description=description,
        df=df,
        model=model,
        exports=outputs,
        imports=inputs,
        theme=resolved_theme,
        data_var_name=data_var_name,
        display_widget=display,
        cache=cache,
        execution_mode=resolved_config.execution if resolved_config else "auto",
        execution_approved=None,
    )
    
    _link_imports(widget, inputs)
    # Store recipe for convenient reruns/clones
    widget._set_recipe(
        description=description,
        data_source=data,
        data_type=type(data) if data is not None else None,
        data_columns=list(df.columns) if isinstance(df, pd.DataFrame) else None,
        exports=outputs,
        imports=inputs,
        model=model,
        theme=resolved_theme,
    )

    return widget


class _SourceInfo:
    """Container for resolved source information."""
    def __init__(
        self,
        code: str,
        metadata: dict[str, Any] | None,
        components: list[str],
        df: pd.DataFrame | None,
        theme: Theme | None,
        target_component: str | None = None,
    ):
        self.code = code
        self.metadata = metadata
        self.components = components
        self.df = df
        self.theme = theme
        # When editing a specific component, this is the component name
        self.target_component = target_component


def _resolve_source(
    source: "VibeWidget | ComponentReference | str | Path",
    store: WidgetStore
) -> _SourceInfo:
    """Resolve source widget to code, metadata, components, and data."""
    if isinstance(source, VibeWidget):
        return _SourceInfo(
            code=source.code,
            metadata=source._widget_metadata,
            components=source._widget_metadata.get("components", []) if source._widget_metadata else [],
            df=pd.DataFrame(source.data) if source.data else None,
            theme=source._theme,
            target_component=None,
        )
    
    if isinstance(source, ComponentReference):
        # When editing a component, we pass the full code but track which component is targeted
        return _SourceInfo(
            code=source.code,
            metadata=source.metadata,
            components=[source.component_name],
            df=pd.DataFrame(source.widget.data) if source.widget.data else None,
            theme=source.widget._theme,
            target_component=source.component_name,
        )
    
    if isinstance(source, (str, Path)):
        result = store.load_by_id(str(source)) if isinstance(source, str) else None
        if not result and isinstance(source, str):
            result = store.load_from_file(Path(source))
        elif isinstance(source, Path):
            result = store.load_from_file(source)
        
        if result:
            metadata, code = result
            theme = None
            if metadata:
                theme_description = metadata.get("theme_description")
                theme_name = metadata.get("theme_name")
                if theme_description:
                    theme = Theme(description=theme_description, name=theme_name)
            return _SourceInfo(
                code=code,
                metadata=metadata,
                components=metadata.get("components", []),
                df=None,
                theme=theme,
                target_component=None,
            )
        
        error_msg = f"Could not find widget with ID '{source}'" if isinstance(source, str) else f"Widget file not found: {source}"
        raise ValueError(error_msg)
    
    raise TypeError(f"Invalid source type: {type(source)}")


def edit(
    description: str,
    source: "VibeWidget | ComponentReference | str | Path",
    data: pd.DataFrame | str | Path | None = None,
    outputs: dict[str, str] | OutputBundle | None = None,
    inputs: dict[str, Any] | InputsBundle | None = None,
    theme: Theme | str | None = None,
    config: Config | None = None,
    cache: bool = True,
) -> "VibeWidget":
    """Edit a widget by building upon existing code.
    
    Args:
        description: Natural language description of changes
        source: Widget, ComponentReference, widget ID, or file path
        data: DataFrame to visualize (uses source data if None)
        outputs: Dict of {trait_name: description} for new/modified outputs
        inputs: Dict of {trait_name: source} for new/modified inputs
        theme: Theme object, theme name, or prompt string
        config: Optional Config object with model settings (deprecated; call vw.config instead)
        cache: If False, bypass cache and regenerate widget/theme
    
    Returns:
        New VibeWidget instance with edited code
    
    Examples:
        >>> scatter2 = edit("add hover tooltips", scatter)
        >>> legend = edit("make legend horizontal", scatter.component.color_legend)
    """
    data, outputs, inputs, _ = _normalize_api_inputs(
        data=data,
        outputs=outputs,
        inputs=inputs,
    )
    store = WidgetStore()
    source_info = _resolve_source(source, store)
    model, resolved_config = _resolve_model(config_override=config)
    if theme is None and source_info.theme is not None:
        resolved_theme = source_info.theme
    else:
        resolved_theme = resolve_theme_for_request(
            theme,
            model=model,
            api_key=resolved_config.api_key if resolved_config else None,
            cache=cache,
        )
    df = source_info.df if data is None and source_info.df is not None else load_data(data)
    
    # Enhance description when targeting a specific component
    effective_description = description
    if source_info.target_component:
        effective_description = f"[Focus on component: {source_info.target_component}] {description}"
    
    widget = VibeWidget._create_with_dynamic_traits(
        description=effective_description,
        df=df,
        model=model,
        exports=outputs,
        imports=inputs,
        theme=resolved_theme,
        data_var_name=None,
        base_code=source_info.code,
        base_components=source_info.components,
        base_widget_id=source_info.metadata.get("id") if source_info.metadata else None,
        cache=cache,
        execution_mode=resolved_config.execution if resolved_config else "auto",
        execution_approved=None,
    )
    
    _link_imports(widget, inputs)
    widget._set_recipe(
        description=description,  # Store original description in recipe
        data_source=data if data is not None else source_info.df,
        data_type=type(data) if data is not None else (type(source_info.df) if source_info.df is not None else None),
        data_columns=list(df.columns) if isinstance(df, pd.DataFrame) else None,
        exports=outputs,
        imports=inputs,
        model=model,
        theme=resolved_theme,
        base_code=source_info.code,
        base_components=source_info.components,
        base_widget_id=source_info.metadata.get("id") if source_info.metadata else None,
    )
    
    return widget


def load(path: str | Path, approval: bool = True, display: bool = True) -> VibeWidget:
    """Load a widget bundle from disk."""
    target = Path(path)
    with open(target, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    description = payload.get("description") or "Loaded widget"
    code = payload.get("code") or ""
    outputs = payload.get("outputs") or {}
    inputs_signature = payload.get("inputs_signature") or {}
    theme_payload = payload.get("theme") or {}
    components = payload.get("components") or []
    save_inputs = payload.get("save_inputs") or {}
    embedded = bool(save_inputs.get("embedded"))
    input_values = save_inputs.get("values") if isinstance(save_inputs.get("values"), dict) else {}

    data_rows = []
    if embedded and isinstance(input_values, dict):
        data_rows = input_values.pop("data", [])

    df = pd.DataFrame(data_rows) if isinstance(data_rows, list) else pd.DataFrame()

    imports: dict[str, Any] = {}
    if isinstance(inputs_signature, dict):
        for name in inputs_signature.keys():
            if name == "data":
                continue
            imports[name] = None
    if isinstance(input_values, dict):
        for name, value in input_values.items():
            if name == "data":
                continue
            if isinstance(value, dict) and value.get("type") == "export_handle":
                imports[name] = None
            else:
                imports[name] = value

    theme = None
    if isinstance(theme_payload, dict) and (theme_payload.get("name") or theme_payload.get("description")):
        theme = Theme(
            description=theme_payload.get("description") or "",
            name=theme_payload.get("name"),
        )

    metadata = {
        "description": description,
        "components": components,
        "model": payload.get("model"),
        "theme_name": theme_payload.get("name") if isinstance(theme_payload, dict) else None,
        "theme_description": theme_payload.get("description") if isinstance(theme_payload, dict) else None,
        "inputs_signature": inputs_signature,
        "outputs": outputs,
        "source_path": str(target.resolve()),
        "version": payload.get("version"),
        "created_at": payload.get("created_at"),
        "audit": payload.get("audit"),
    }

    execution_mode = "approve" if approval else "auto"
    execution_approved = not approval
    approved_hash = compute_code_hash(code) if not approval else ""

    widget = VibeWidget._create_with_dynamic_traits(
        description=description,
        df=df,
        model=payload.get("model") or DEFAULT_MODEL,
        exports=outputs,
        imports=imports,
        theme=theme,
        data_var_name=None,
        existing_code=code,
        existing_metadata=metadata,
        display_widget=display,
        cache=False,
        execution_mode=execution_mode,
        execution_approved=execution_approved,
        execution_approved_hash=approved_hash,
    )

    if isinstance(input_values, dict):
        for name, value in input_values.items():
            if name == "data":
                continue
            if isinstance(value, dict) and value.get("type") == "export_handle":
                continue
            try:
                setattr(widget, name, value)
            except Exception:
                pass

    widget._set_recipe(
        description=description,
        data_source=data_rows if embedded else None,
        data_type=type(data_rows) if embedded else None,
        data_columns=list(df.columns) if isinstance(df, pd.DataFrame) else None,
        exports=outputs,
        imports=imports,
        model=payload.get("model") or DEFAULT_MODEL,
        theme=theme,
    )

    return widget


def clear(target: Union["VibeWidget", str] = "all") -> dict[str, int]:
    """Clear cached widgets, themes, audits, or a specific widget's cache."""
    results = {"widgets": 0, "themes": 0, "audits": 0}

    if isinstance(target, VibeWidget):
        metadata = getattr(target, "_widget_metadata", {}) or {}
        widget_id = metadata.get("id")
        widget_slug = metadata.get("slug")
        results["widgets"] = WidgetStore().clear_for_widget(widget_id=widget_id, slug=widget_slug)
        results["audits"] = AuditStore().clear_for_widget(widget_id=widget_id, widget_slug=widget_slug)
        return results

    if isinstance(target, str):
        normalized = target.strip().lower()
        if normalized in {"all"}:
            results["widgets"] = WidgetStore().clear()
            results["audits"] = AuditStore().clear()
            results["themes"] = clear_theme_cache()
            return results
        if normalized in {"widget", "widgets"}:
            results["widgets"] = WidgetStore().clear()
            return results
        if normalized in {"audit", "audits"}:
            results["audits"] = AuditStore().clear()
            return results
        if normalized in {"theme", "themes"}:
            results["themes"] = clear_theme_cache()
            return results

        results["widgets"] = WidgetStore().clear_for_widget(widget_id=target, slug=target)
        results["audits"] = AuditStore().clear_for_widget(widget_id=target, widget_slug=target)
        return results

    raise TypeError("vw.clear expects a cache type string or a VibeWidget instance.")
