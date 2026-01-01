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
    ActionBundle,
)
from vibe_widget.utils.code_parser import CodeStreamParser, RevisionStreamParser
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
from vibe_widget.utils.audit_store import AuditStore, compute_code_hash
from vibe_widget.utils.util import (
    clean_for_json,
    initial_import_value,
    load_data,
    prepare_input_for_widget,
    summarize_for_prompt,
)
from vibe_widget.themes import Theme, clear_theme_cache
from vibe_widget.core.state import StateManager
from vibe_widget.services.audit import AuditService
from vibe_widget.services.generation import GenerationService
from vibe_widget.services.theme import ThemeService
from vibe_widget.utils.logging import get_logger


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


_CLASS_CACHE: dict[frozenset[str], type] = {}


def _get_widget_class(
    base_cls: type,
    exports: dict[str, Any],
    imports: dict[str, Any],
) -> type:
    """Return a cached widget subclass for the given trait signature."""
    signature = frozenset(set(exports.keys()) | set(imports.keys()))
    if not signature:
        return base_cls
    cached = _CLASS_CACHE.get(signature)
    if cached is not None:
        return cached
    dynamic_traits: dict[str, traitlets.TraitType] = {}
    for export_name in exports.keys():
        dynamic_traits[export_name] = traitlets.Any(default_value=None).tag(
            sync=True, to_json=_export_to_json_value
        )
    for import_name in imports.keys():
        if import_name not in dynamic_traits:
            dynamic_traits[import_name] = traitlets.Any(default_value=None).tag(
                sync=True, to_json=_import_to_json_value
            )
    class_name = f"VibeWidget_{abs(hash(signature))}"
    widget_class = type(class_name, (base_cls,), dynamic_traits)
    _CLASS_CACHE[signature] = widget_class
    return widget_class


# ComponentReference is deprecated - component access now returns VibeWidget directly
# For backwards compatibility, we keep this as an alias
ComponentReference = None  # Will be set to VibeWidget after class definition

logger = get_logger(__name__)


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
    action_event = traitlets.Dict({}).tag(sync=True)
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
        var_name: str | None = None,
        input_sampling: bool = True,
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

        widget_class = _get_widget_class(cls, exports, imports)

        init_values: dict[str, Any] = {}
        for export_name in exports.keys():
            init_values[export_name] = None
        for import_name, import_source in imports.items():
            initial_value = initial_import_value(import_name, import_source)
            init_values[import_name] = prepare_input_for_widget(
                initial_value,
                input_name=import_name,
                sample=input_sampling,
            )

        return widget_class(
            description=description,
            df=df,
            model=model,
            exports=exports,
            imports=imports,
            theme=theme,
            var_name=var_name,
            input_sampling=input_sampling,
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
        var_name: str | None = None,
        input_sampling: bool = True,
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
            var_name: Variable name for storage grouping (captured from caller)
            base_code: Optional base widget code for revision/composition
            base_components: Optional list of component names from base widget
            base_widget_id: Optional ID of base widget for provenance tracking
            cache: If False, bypass widget cache and regenerate
            **kwargs: Additional widget parameters
        """
        parser = CodeStreamParser()
        self._exports = exports or {}
        self._imports = imports or {}
        self._actions = kwargs.pop("actions", None) or {}
        self._action_params = kwargs.pop("action_params", None) or {}
        self._input_summaries = kwargs.pop("input_summaries", None)
        self._input_sampling = input_sampling
        self._export_accessors: dict[str, ExportHandle] = {}
        self._state = StateManager(self)
        self._widget_metadata = None
        self._theme = theme
        self._base_code = base_code
        self._base_components = base_components or []
        self._base_widget_id = base_widget_id
        self._creation_params: dict[str, Any] = {}
        self._llm_provider = None
        self._generation_service: GenerationService | None = None
        self._audit_service: AuditService | None = None
        
        app_wrapper_dir = Path(__file__).resolve().parents[1]
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
            input_count = len(self._imports or {})
            self.logs = [f"Analyzing inputs: {input_count}"]
            
            resolved_model, config = _resolve_model(model)
            provider = OpenRouterProvider(resolved_model, config.api_key)
            self._generation_service = GenerationService(provider)
            self._audit_service = AuditService()
            self._llm_provider = provider
            self.orchestrator = self._generation_service.orchestrator
            inputs_for_prompt = self._input_summaries or _summarize_inputs_for_prompt(self._imports)
            if df is not None and isinstance(df, pd.DataFrame) and "data" not in inputs_for_prompt:
                try:
                    inputs_for_prompt["data"] = summarize_for_prompt(df)
                except Exception:
                    inputs_for_prompt["data"] = "<data>"
            
            if existing_code is not None:
                self.logs = self.logs + ["Reusing existing widget code"]
                self.code = existing_code
                self.status = "ready"
                self.description = description
                self._widget_metadata = existing_metadata or {}
                if self._theme and "theme_description" not in self._widget_metadata:
                    self._widget_metadata["theme_description"] = self._theme.description
                    self._widget_metadata["theme_name"] = self._theme.name
                self.data_info = LLMProvider.build_data_info(
                    outputs=self._exports,
                    inputs=inputs_for_prompt,
                    actions=self._actions,
                    action_params=self._action_params,
                    theme_description=self._theme.description if self._theme else None,
                )
                return
            
            # Serialize imports for cache lookup
            imports_serialized = {}
            if self._imports:
                for import_name in self._imports.keys():
                    imports_serialized[import_name] = f"<imported_trait:{import_name}>"
            if isinstance(df, pd.DataFrame) and "data" not in imports_serialized:
                imports_serialized["data"] = "<input>"
            if isinstance(df, pd.DataFrame) and "data" not in imports_serialized:
                imports_serialized["data"] = "<input>"
            
            store = WidgetStore()
            cached_widget = None
            if cache:
                cached_widget = store.lookup(
                    description=description,
                    var_name=var_name,
                    data_shape=df.shape,
                    exports=self._exports,
                    imports_serialized=imports_serialized,
                    theme_description=self._theme.description if self._theme else None,
                    revision_parent=self._base_widget_id,
                )
            else:
                self.logs = self.logs + ["Skipping cache (cache=False)"]
            
            # Generation/audit services are already initialized.
            
            if cached_widget:
                self.logs = self.logs + ["✓ Found cached widget"]
                self.logs = self.logs + [f"  {cached_widget.get('var_name', 'widget')}"]
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
                    outputs=self._exports,
                    inputs=inputs_for_prompt,
                    actions=self._actions,
                    action_params=self._action_params,
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
            widget_code, _ = self._generation_service.generate(
                description=description,
                outputs=self._exports,
                inputs=self._imports,
                input_summaries=inputs_for_prompt,
                actions=self._actions,
                action_params=self._action_params,
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
                var_name=var_name,
                data_shape=df.shape,
                model=resolved_model,
                exports=self._exports,
                imports_serialized=imports_serialized,
                theme_name=self._theme.name if self._theme else None,
                theme_description=self._theme.description if self._theme else None,
                notebook_path=notebook_path,
                revision_parent=self._base_widget_id,
            )
            
            self.logs = self.logs + [f"Widget saved: {widget_entry.get('var_name', 'widget')}"]
            self.logs = self.logs + [f"Location: .vibewidget/widgets/{widget_entry['file_name']}"]
            self.code = widget_code
            self.status = "ready"
            self.description = description
            self._widget_metadata = widget_entry
            
            # Store data_info for error recovery  (build from LLMProvider method)
            self.data_info = LLMProvider.build_data_info(
                outputs=self._exports,
                inputs=inputs_for_prompt,
                actions=self._actions,
                action_params=self._action_params,
                theme_description=self._theme.description if self._theme else None,
            )
            
        except Exception as e:
            self.status = "error"
            self.logs = self.logs + [f"Error: {str(e)}"]
            raise

    def __getattribute__(self, name: str):
        """Return callable handles for exports to support import chaining."""
        if not name.startswith("_") and name not in {"outputs", "actions", "component"}:
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
    def _store_creation_params(
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
        self._creation_params = {
            "description": description,
            "data_source": data_source,
            "data_type": data_type,
            "data_columns": data_columns,
            "exports": exports,
            "imports": imports,
            "model": model,
            "model_resolved": model,
            "theme": theme,
            "base_code": base_code,
            "base_components": base_components,
            "base_widget_id": base_widget_id,
        }

    def _set_recipe(self, **kwargs) -> None:
        """Backward-compatible wrapper for storing creation parameters."""
        self._store_creation_params(**kwargs)

    def _get_creation_param(self, name: str, fallback: Any = None) -> Any:
        if self._creation_params and name in self._creation_params:
            return self._creation_params.get(name)
        legacy_key = f"_recipe_{name}"
        legacy = self.__dict__.get(legacy_key, fallback)
        if legacy is not None:
            return legacy
        return fallback

    @property
    def _recipe_description(self) -> Any:
        return self._get_creation_param("description")

    @_recipe_description.setter
    def _recipe_description(self, value: Any) -> None:
        self._creation_params["description"] = value

    @property
    def _recipe_data_source(self) -> Any:
        return self._get_creation_param("data_source")

    @_recipe_data_source.setter
    def _recipe_data_source(self, value: Any) -> None:
        self._creation_params["data_source"] = value

    @property
    def _recipe_data_type(self) -> Any:
        return self._get_creation_param("data_type")

    @_recipe_data_type.setter
    def _recipe_data_type(self, value: Any) -> None:
        self._creation_params["data_type"] = value

    @property
    def _recipe_data_columns(self) -> Any:
        return self._get_creation_param("data_columns")

    @_recipe_data_columns.setter
    def _recipe_data_columns(self, value: Any) -> None:
        self._creation_params["data_columns"] = value

    @property
    def _recipe_exports(self) -> Any:
        return self._get_creation_param("exports")

    @_recipe_exports.setter
    def _recipe_exports(self, value: Any) -> None:
        self._creation_params["exports"] = value

    @property
    def _recipe_imports(self) -> Any:
        return self._get_creation_param("imports")

    @_recipe_imports.setter
    def _recipe_imports(self, value: Any) -> None:
        self._creation_params["imports"] = value

    @property
    def _recipe_model(self) -> Any:
        return self._get_creation_param("model")

    @_recipe_model.setter
    def _recipe_model(self, value: Any) -> None:
        self._creation_params["model"] = value

    @property
    def _recipe_model_resolved(self) -> Any:
        return self._get_creation_param("model_resolved")

    @_recipe_model_resolved.setter
    def _recipe_model_resolved(self, value: Any) -> None:
        self._creation_params["model_resolved"] = value

    @property
    def _recipe_theme(self) -> Any:
        return self._get_creation_param("theme")

    @_recipe_theme.setter
    def _recipe_theme(self, value: Any) -> None:
        self._creation_params["theme"] = value

    @property
    def _recipe_base_code(self) -> Any:
        return self._get_creation_param("base_code")

    @_recipe_base_code.setter
    def _recipe_base_code(self, value: Any) -> None:
        self._creation_params["base_code"] = value

    @property
    def _recipe_base_components(self) -> Any:
        return self._get_creation_param("base_components")

    @_recipe_base_components.setter
    def _recipe_base_components(self, value: Any) -> None:
        self._creation_params["base_components"] = value

    @property
    def _recipe_base_widget_id(self) -> Any:
        return self._get_creation_param("base_widget_id")

    @_recipe_base_widget_id.setter
    def _recipe_base_widget_id(self, value: Any) -> None:
        self._creation_params["base_widget_id"] = value

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
        if not self._creation_params and not hasattr(self, "_recipe_description"):
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
                merged = dict(self._get_creation_param("imports", {}) or {})
                merged.update(bundle_inputs or {})
                candidate_imports = merged
            else:
                matched = False
                if self._get_creation_param("data_type") and isinstance(arg, self._get_creation_param("data_type")):
                    candidate_data = arg
                    matched = True
                if not matched:
                    # Try to swap an import with the same type
                    for name, source in (self._get_creation_param("imports", {}) or {}).items():
                        if source is not None and isinstance(arg, type(source)):
                            merged = dict(self._get_creation_param("imports", {}) or {})
                            merged[name] = arg
                            candidate_imports = merged
                            matched = True
                            break
                if not matched:
                    # Fallback: treat as data (covers DataFrame, str path, etc.)
                    candidate_data = arg

        data = candidate_data if candidate_data is not None else self._get_creation_param("data_source")
        imports = candidate_imports if candidate_imports is not None else self._get_creation_param("imports")
        df = load_data(data)
        existing_code = getattr(self, "code", None)
        existing_metadata = getattr(self, "_widget_metadata", None)

        if self._get_creation_param("data_columns") and isinstance(df, pd.DataFrame):
            missing = set(self._get_creation_param("data_columns")) - set(df.columns)
            if missing:
                raise ValueError(
                    "The new dataset is missing required columns for this widget: "
                    f"{sorted(missing)}. Provide data with these columns or regenerate the widget."
                )

        widget = VibeWidget._create_with_dynamic_traits(
            description=self._get_creation_param("description"),
            df=df,
            model=self._get_creation_param("model_resolved"),
            exports=self._get_creation_param("exports"),
            imports=imports,
            theme=self._get_creation_param("theme"),
            var_name=None,
            base_code=self._get_creation_param("base_code"),
            base_components=self._get_creation_param("base_components"),
            base_widget_id=self._get_creation_param("base_widget_id"),
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
        actions: dict[str, str] | ActionBundle | None = None,
        theme: Theme | str | None = None,
        config: Config | None = None,
        display: bool = True,
        cache: bool = True,
    ) -> "VibeWidget":
        """
        Instance helper that mirrors vw.edit but defaults the source to self.
        Supports the same inputs/outputs/actions/data wrappers as vw.edit.
        """
        # Capture var_name from the caller (depth=2 from here)
        from vibe_widget.utils.widget_store import capture_caller_var_name
        var_name = capture_caller_var_name(depth=2)

        data, outputs, inputs, actions, action_params, _ = _normalize_api_inputs(
            data=data,
            outputs=outputs,
            inputs=inputs,
            actions=actions,
        )
        return edit(
            description=description,
            source=self,
            data=data,
            outputs=outputs,
            inputs=inputs,
            actions=actions,
            theme=theme,
            config=config,
            display=display,
            cache=cache,
            _var_name=var_name,
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

    def _run_audit(
        self,
        *,
        level: str,
        reuse: bool,
        display: bool,
    ) -> dict[str, Any]:
        self.audit_status = "running"
        self.audit_error = ""

        widget_metadata = self._widget_metadata or {}
        widget_description = self.description or widget_metadata.get("description", "Widget")
        if self._audit_service is None:
            self._audit_service = AuditService()
        provider = self._llm_provider
        if provider is None:
            resolved_model, config = _resolve_model(widget_metadata.get("model"))
            provider = OpenRouterProvider(resolved_model, config.api_key)

        result = self._audit_service.run_audit(
            code=self.code,
            level=level,
            reuse=reuse,
            widget_metadata=widget_metadata,
            widget_description=widget_description,
            data_info=self.data_info,
            provider=provider,
        )

        self.audit_status = "idle"
        self.audit_response = result
        if display:
            try:
                from IPython.display import display, Markdown
                display(Markdown(f"```yaml\n{result['report_yaml']}\n```"))
            except Exception:
                print(result["report_yaml"])
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
        if self._generation_service is None:
            self.audit_apply_error = "No LLM service available to apply changes."
            self.audit_apply_status = "error"
            self.audit_apply_request = {}
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
            revised_code = self._generation_service.revise_code(
                code=base_code,
                revision_request=revision_request,
                data_info=self.data_info,
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
            logger.error("Frontend runtime error:\n%s", error_msg)

        if self._generation_service is None:
            return

        if not error_msg or self.retry_count >= 2:
            return
        
        self.retry_count += 1
        self.status = 'generating'
        
        error_preview = error_msg.split('\n')[0][:100]
        self.logs = self.logs + [f"Error detected: {error_preview}"]
        self.logs = self.logs + ["Asking LLM to fix the error"]
        
        try:
            orchestrator = getattr(self, "orchestrator", None)
            if orchestrator is not None and hasattr(orchestrator, "fix_runtime_error"):
                fixed_code = orchestrator.fix_runtime_error(
                    code=self.code,
                    error_message=error_msg,
                    data_info=clean_for_json(self.data_info),
                )
                should_retry = False
            else:
                fixed_code, should_retry = self._generation_service.fix_runtime_error(
                    code=self.code,
                    error_message=error_msg,
                    data_info=self.data_info,
                    retry_count=self.retry_count,
                )

            if should_retry and fixed_code == self.code:
                self.status = "error"
                self.logs = self.logs + ["Fix attempt failed"]
                self.error_message = ""
                return

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
    def outputs(self):
        """Namespace accessor for widget outputs."""
        return self._state.outputs

    @property
    def actions(self):
        """Namespace accessor for widget actions."""
        return self._state.actions

    @property
    def component(self):
        """Namespace accessor for widget components."""
        return self._state.component
    
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

    def _component_attr_names(self) -> list[str]:
        components = []
        if hasattr(self, "_widget_metadata") and self._widget_metadata and "components" in self._widget_metadata:
            components = self._widget_metadata["components"] or []
        return [self._to_python_attr(comp) for comp in components]

    def _resolve_component_name(self, name: str) -> str | None:
        """Resolve a Python attribute name to the original component name."""
        if not hasattr(self, "_widget_metadata") or not self._widget_metadata or "components" not in self._widget_metadata:
            return None
        components = self._widget_metadata["components"]
        for comp in components:
            if self._to_python_attr(comp) == name or comp.lower() == name.lower():
                return comp
        return None

    def _create_component_widget(self, component_name: str) -> "VibeWidget":
        """
        Create a VibeWidget that renders only this component.
        
        This widget has all standard VibeWidget methods including edit(), display(), etc.
        The widget's code is the original code with the default export replaced to render
        only the specified component.
        
        Args:
            component_name: Name of the component (PascalCase as in JS code)
        
        Returns:
            VibeWidget instance configured to render only this component
        """
        from vibe_widget.utils.code_parser import generate_standalone_wrapper
        
        # Generate standalone code for this component
        standalone_code = generate_standalone_wrapper(self.code, component_name)
        
        # Get metadata from parent widget
        parent_metadata = self._widget_metadata or {}
        parent_slug = parent_metadata.get('slug', 'widget')
        
        # Component widget metadata
        component_metadata = {
            **parent_metadata,
            "is_component_view": True,
            "source_component": component_name,
            "parent_widget_id": parent_metadata.get("id"),
            "parent_slug": parent_slug,
            # Override slug for the component
            "slug": f"{parent_slug}:{self._to_python_attr(component_name)}",
            # Component has single component (itself)
            "components": [component_name],
        }
        
        # Get data from parent widget
        data = self.data
        df = pd.DataFrame(data) if data else pd.DataFrame()
        
        # Create the component widget
        widget = VibeWidget._create_with_dynamic_traits(
            description=f"{component_name} (from {parent_slug})",
            df=df,
            model=parent_metadata.get("model", "claude-haiku-4-5-20251001"),
            exports=None,
            imports=None,
            theme=self._theme,
            existing_code=standalone_code,
            existing_metadata=component_metadata,
            display_widget=False,
            cache=False,
        )
        
        # Store reference back to parent for edit operations
        widget._parent_widget = self
        widget._source_component = component_name
        
        return widget

    def __dir__(self):
        """Return list of attributes including outputs/actions/component helpers for autocomplete."""
        # Get default attributes
        default_attrs = object.__dir__(self)
        export_attrs: list[str] = []

        if hasattr(self, "_exports") and self._exports:
            export_attrs = list(self._exports.keys())
        return list(set(default_attrs + export_attrs + ["outputs", "actions", "component"]))
    
    def __getattr__(self, name: str):
        """
        Enable access to exports via dot notation.
        Components should be accessed via widget.component.name.
        """
        # Avoid infinite recursion for special attributes
        if name.startswith('_'):
            raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")
        
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
        if self._generation_service is None:
            self.status = 'error'
            self.logs = ['✘ Edit failed: LLM service unavailable']
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
            
            revised_code = self._generation_service.revise_code(
                code=self.code,
                revision_request=revision_request,
                data_info=self.data_info,
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
            
            # Get parent cache_key before saving (for revision chain)
            parent_cache_key = previous_metadata.get("cache_key") if previous_metadata else None
            
            widget_entry = store.save(
                widget_code=revised_code,
                description=self.description,
                var_name=self._widget_metadata.get('var_name') if self._widget_metadata else None,
                data_shape=tuple(self._widget_metadata.get('data_shape', [0, 0])) if self._widget_metadata else (0, 0),
                model=self._widget_metadata.get('model', 'unknown') if self._widget_metadata else 'unknown',
                exports=self._exports,
                imports_serialized=imports_serialized,
                theme_name=self._theme.name if self._theme else None,
                theme_description=self._theme.description if self._theme else None,
                notebook_path=store.get_notebook_path(),
                revision_parent=parent_cache_key,
            )
            self._widget_metadata = widget_entry
            var_name = widget_entry.get('var_name', 'widget')
            self.logs = self.logs + [f"Saved: {var_name} (cache: {widget_entry['cache_key'][:8]}...)"]
            
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


ComponentReference = VibeWidget


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


def _summarize_inputs_for_prompt(imports: dict[str, Any] | None) -> dict[str, str]:
    """Build a summary map for prompt context from imports."""
    if not imports:
        return {}
    summaries: dict[str, str] = {}
    for name, value in imports.items():
        try:
            resolved = initial_import_value(name, value)
            summaries[name] = summarize_for_prompt(resolved)
        except Exception:
            summaries[name] = f"<{name}>"
    return summaries


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
    actions: dict[str, str] | ActionBundle | None = None,
) -> tuple[Any, dict[str, str] | None, dict[str, Any] | None, dict[str, str] | None, dict[str, dict[str, str] | None] | None, str | None]:
    """Allow flexible ordering/wrapping for outputs/inputs/actions/data."""
    normalized_data = data
    normalized_inputs = inputs
    normalized_outputs = outputs
    normalized_actions = actions
    normalized_action_params = None
    var_name: str | None = None

    # Data can be passed as an InputsBundle to keep everything together
    if isinstance(normalized_data, InputsBundle):
        bundle_inputs = normalized_data.inputs or {}
        if len(bundle_inputs) == 1:
            normalized_data = next(iter(bundle_inputs.values()))
        else:
            if isinstance(normalized_inputs, InputsBundle):
                normalized_inputs = {**bundle_inputs, **(normalized_inputs.inputs or {})}
            else:
                normalized_inputs = {**bundle_inputs, **(normalized_inputs or {})}
            normalized_data = None

    if isinstance(normalized_outputs, OutputBundle):
        normalized_outputs = normalized_outputs.outputs

    if isinstance(normalized_inputs, InputsBundle):
        bundle_inputs = normalized_inputs.inputs or {}
        if normalized_data is None and len(bundle_inputs) == 1:
            normalized_data = next(iter(bundle_inputs.values()))
            normalized_inputs = {}
        else:
            normalized_inputs = bundle_inputs

    if isinstance(normalized_actions, ActionBundle):
        normalized_action_params = normalized_actions.params
        normalized_actions = normalized_actions.actions

    return normalized_data, normalized_outputs, normalized_inputs, normalized_actions, normalized_action_params, var_name


def create(
    description: str,
    data: pd.DataFrame | str | Path | None = None,
    outputs: dict[str, str] | OutputBundle | None = None,
    inputs: dict[str, Any] | InputsBundle | None = None,
    actions: dict[str, str] | ActionBundle | None = None,
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
        actions: Dict of {action_name: description} for interactive callbacks
        theme: Theme object, theme name, or prompt string
        config: Optional Config object with model settings (deprecated; call vw.config instead)
        display: Whether to display the widget immediately (IPython environments only)
        cache: If False, bypass cache and regenerate widget/theme

    Returns:
        VibeWidget instance

    Examples:
        >>> scatter_plot = create("show temperature trends", df)
        >>> sales_chart = create("visualize sales data", "sales.csv")
    """
    # Capture the variable name from the caller's assignment
    # e.g., scatter_plot = vw.create(...) -> var_name = "scatter_plot"
    from vibe_widget.utils.widget_store import capture_caller_var_name
    var_name = capture_caller_var_name(depth=2)

    data, outputs, inputs, actions, action_params, _var_name = _normalize_api_inputs(
        data=data,
        outputs=outputs,
        inputs=inputs,
        actions=actions,
    )
    model, resolved_config = _resolve_model(config_override=config)
    df = load_data(data)
    theme_service = ThemeService()
    resolved_theme = theme_service.resolve(
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
        var_name=var_name,
        display_widget=display,
        cache=cache,
        execution_mode=resolved_config.execution if resolved_config else "auto",
        execution_approved=None,
        actions=actions,
        action_params=action_params,
    )

    _link_imports(widget, inputs)
    # Store recipe for convenient reruns/clones
    widget._store_creation_params(
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
    source: "VibeWidget | str | Path",
    store: WidgetStore
) -> _SourceInfo:
    """Resolve source widget to code, metadata, components, and data."""
    if isinstance(source, VibeWidget):
        # Check if this is a component widget (has _source_component)
        source_component = getattr(source, "_source_component", None)
        
        if source_component:
            # This is a component widget - use ITS standalone code as the base
            # The standalone code already renders only this component, so we treat
            # it as a regular widget edit (no target_component needed)
            return _SourceInfo(
                code=source.code,  # The standalone wrapper code
                metadata=source._widget_metadata,
                components=[source_component],
                df=pd.DataFrame(source.data) if source.data else None,
                theme=source._theme,
                target_component=None,  # Not needed - standalone code already focuses on component
            )
        
        # Regular widget
        return _SourceInfo(
            code=source.code,
            metadata=source._widget_metadata,
            components=source._widget_metadata.get("components", []) if source._widget_metadata else [],
            df=pd.DataFrame(source.data) if source.data else None,
            theme=source._theme,
            target_component=None,
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
    source: "VibeWidget | str | Path",
    data: pd.DataFrame | str | Path | None = None,
    outputs: dict[str, str] | OutputBundle | None = None,
    inputs: dict[str, Any] | InputsBundle | None = None,
    actions: dict[str, str] | ActionBundle | None = None,
    theme: Theme | str | None = None,
    config: Config | None = None,
    display: bool = True,
    cache: bool = True,
    _var_name: str | None = None,
) -> "VibeWidget":
    """Edit a widget by building upon existing code.

    Args:
        description: Natural language description of changes
        source: Widget (including component widgets), widget ID, or file path
        data: DataFrame to visualize (uses source data if None)
        outputs: Dict of {trait_name: description} for new/modified outputs
        inputs: Dict of {trait_name: source} for new/modified inputs
        actions: Dict of {action_name: description} for new/modified actions
        theme: Theme object, theme name, or prompt string
        config: Optional Config object with model settings (deprecated; call vw.config instead)
        cache: If False, bypass cache and regenerate widget/theme

    Returns:
        New VibeWidget instance with edited code

    Examples:
        >>> scatter2 = edit("add hover tooltips", scatter)
        >>> legend = edit("make legend horizontal", scatter.component.color_legend)
    """
    # Capture the variable name from the caller's assignment (if not already provided)
    if _var_name is None:
        from vibe_widget.utils.widget_store import capture_caller_var_name
        var_name = capture_caller_var_name(depth=2)
    else:
        var_name = _var_name

    data, outputs, inputs, actions, action_params, _ = _normalize_api_inputs(
        data=data,
        outputs=outputs,
        inputs=inputs,
        actions=actions,
    )
    store = WidgetStore()
    source_info = _resolve_source(source, store)
    model, resolved_config = _resolve_model(config_override=config)
    if theme is None and source_info.theme is not None:
        resolved_theme = source_info.theme
    else:
        theme_service = ThemeService()
        resolved_theme = theme_service.resolve(
            theme,
            model=model,
            api_key=resolved_config.api_key if resolved_config else None,
            cache=cache,
        )
    df = source_info.df if data is None and source_info.df is not None else load_data(data)
    
    # Get the parent widget's cache_key for revision tracking
    base_cache_key = source_info.metadata.get("cache_key") if source_info.metadata else None
    
    widget = VibeWidget._create_with_dynamic_traits(
        description=description,
        df=df,
        model=model,
        exports=outputs,
        imports=inputs,
        theme=resolved_theme,
        var_name=var_name,
        base_code=source_info.code,
        base_components=source_info.components,
        base_widget_id=base_cache_key,
        cache=cache,
        display_widget=display,
        execution_mode=resolved_config.execution if resolved_config else "auto",
        execution_approved=None,
        actions=actions,
        action_params=action_params,
    )

    _link_imports(widget, inputs)
    widget._store_creation_params(
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
        base_widget_id=base_cache_key,
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
        var_name=None,
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

    widget._store_creation_params(
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
