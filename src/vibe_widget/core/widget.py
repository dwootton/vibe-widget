"""
Core VibeWidget implementation.
Clean, robust widget generation without legacy profile logic.
"""
from pathlib import Path
from typing import Any, Union, TYPE_CHECKING
from datetime import datetime, timezone
import json
import inspect
import sys
import threading
import time
import os

import anywidget
import traitlets

if TYPE_CHECKING:
    import pandas as pd


def _is_dataframe(obj: Any) -> bool:
    """Check if obj is a pandas DataFrame without importing pandas."""
    return type(obj).__module__.startswith("pandas") and type(obj).__name__ == "DataFrame"


def _get_pandas():
    """Lazy import pandas."""
    import pandas as pd
    return pd

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
from vibe_widget.core.lifecycle import WidgetLifecycle
from vibe_widget.services.audit import AuditService
from vibe_widget.services.generation import GenerationService
from vibe_widget.llm.agents.config import resolve_agent_run_config
from vibe_widget.llm.agents.context import AgentHarnessContext
from vibe_widget.llm.tools.agents_tools import default_agent_tools
from vibe_widget.services.repair import RepairService
from vibe_widget.llm.agentic_agents import MaxTokensExceeded
from vibe_widget.services.theme import ThemeService
from vibe_widget.services.bundling import BundleService
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

def _running_in_colab() -> bool:
    if (
        os.environ.get("COLAB_RELEASE_TAG")
        or os.environ.get("COLAB_BACKEND_VERSION")
        or os.environ.get("COLAB_GPU")
    ):
        return True
    try:
        import google.colab  # noqa: F401

        return True
    except Exception:
        return False


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


logger = get_logger(__name__)

def _write_debug_log(event: str, payload: str = "") -> None:
    """Append debug events to logs.txt for local inspection."""
    try:
        repo_root = Path(__file__).resolve().parents[3]
        log_path = repo_root / "logs.txt"
        timestamp = datetime.now(timezone.utc).isoformat()
        entry = f"{timestamp} | {event}"
        if payload:
            entry = f"{entry} | {payload}"
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(entry + "\n")
    except Exception:
        return
_EDITOR_BUNDLE_CACHE: str | None = None


class VibeWidget(anywidget.AnyWidget):
    data = traitlets.List([]).tag(sync=True)
    status = traitlets.Unicode("idle").tag(sync=True)
    logs = traitlets.List([]).tag(sync=True)
    code = traitlets.Unicode("").tag(sync=True)
    render_code = traitlets.Unicode("").tag(sync=True)
    error_message = traitlets.Unicode("").tag(sync=True)
    widget_error = traitlets.Unicode("").tag(sync=True)
    last_runtime_error = traitlets.Unicode("").tag(sync=True)
    widget_logs = traitlets.List([]).tag(sync=True)
    retry_count = traitlets.Int(0).tag(sync=True)
    frontend_ready = traitlets.Bool(False).tag(sync=True)
    grab_edit_request = traitlets.Dict({}).tag(sync=True)
    state_prompt_request = traitlets.Dict({}).tag(sync=True)
    action_event = traitlets.Dict({}).tag(sync=True)
    audit_state = traitlets.Dict({}).tag(sync=True)
    execution_state = traitlets.Dict({}).tag(sync=True)
    debug_mode = traitlets.Bool(False).tag(sync=True)
    debug_event = traitlets.Dict({}).tag(sync=True)
    _is_closed = traitlets.Bool(False).tag(sync=False)

    def close(self) -> None:
        """Close widget comms and mark as disposed."""
        if self._is_closed:
            return
        self._is_closed = True
        try:
            super().close()
        except Exception:
            pass

    def save_changes(self, *args, **kwargs) -> None:
        """Guard against sends after the comm is closed."""
        if self._is_closed:
            return
        try:
            super().save_changes(*args, **kwargs)
        except Exception as exc:
            message = str(exc).lower()
            if "cannot send" in message:
                self._is_closed = True
                return
            raise

    def send(self, *args, **kwargs) -> None:
        """Guard custom messages after the comm is closed."""
        if self._is_closed:
            return
        try:
            super().send(*args, **kwargs)
        except Exception as exc:
            message = str(exc).lower()
            if "cannot send" in message:
                self._is_closed = True
                return
            raise

    def __del__(self) -> None:
        """Best-effort cleanup when widget is garbage collected."""
        try:
            self.close()
        except Exception:
            pass

    def _ipython_display_(self) -> None:
        """Ensure rich display works in environments that skip mimebundle reprs."""
        try:
            from IPython.display import display
            if getattr(self, "_displayed", False):
                _write_debug_log("ipython_display_skip", f"model_id={getattr(self, 'model_id', '')}")
                return
            self._displayed = True
            try:
                import traceback
                stack = "".join(traceback.format_stack(limit=6)).strip()
            except Exception:
                stack = ""

            _write_debug_log(
                "ipython_display",
                f"model_id={getattr(self, 'model_id', '')} stack={stack}"
            )
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
        df: "pd.DataFrame",
        model: str = DEFAULT_MODEL,
        exports: dict[str, str] | None = None,
        imports: dict[str, Any] | None = None,
        theme: Theme | None = None,
        var_name: str | None = None,
        input_sampling: bool = False,
        base_code: str | None = None,
        base_components: list[str] | None = None,
        base_widget_id: str | None = None,
        existing_code: str | None = None,
        existing_metadata: dict[str, Any] | None = None,
        display_widget: bool = False,
        data_root: Path | None = None,
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
            data_root=data_root,
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
        df: "pd.DataFrame",
        model: str = DEFAULT_MODEL,
        exports: dict[str, str] | None = None,
        imports: dict[str, Any] | None = None,
        theme: Theme | None = None,
        var_name: str | None = None,
        input_sampling: bool = False,
        base_code: str | None = None,
        base_components: list[str] | None = None,
        base_widget_id: str | None = None,
        existing_code: str | None = None,
        existing_metadata: dict[str, Any] | None = None,
        display_widget: bool = False,
        data_root: Path | None = None,
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
        self.description = description
        self._exports = exports or {}
        self._imports = imports or {}
        self._actions = kwargs.pop("actions", None) or {}
        self._action_params = kwargs.pop("action_params", None) or {}
        self._input_summaries = kwargs.pop("input_summaries", None)
        self._input_sampling = input_sampling
        self._export_accessors: dict[str, ExportHandle] = {}
        self._state = StateManager(self)
        self._displayed = False
        self._theme = theme
        self._base_code = base_code
        self._base_components = base_components or []
        self._base_widget_id = base_widget_id
        self._creation_params: dict[str, Any] = {}
        self._llm_provider = None
        self._generation_service: GenerationService | None = None
        self._audit_service: AuditService | None = None
        self._repair_service: RepairService | None = None
        self._bundle_service = BundleService()
        self._last_bundle_hash = ""
        self._last_bundle_error = ""
        self._max_retries = RepairService.MAX_RETRIES
        self._repair_in_progress = False
        self._last_logged_runtime_error = ""
        self._widget_metadata: dict[str, Any] | None = None
        self._prompt_history = list((existing_metadata or {}).get("prompt_history") or [])
        self._data_path = data_root
        
        app_wrapper_dir = Path(__file__).resolve().parents[1]
        app_wrapper_path = app_wrapper_dir / "AppWrapper.bundle.js"
        if not app_wrapper_path.exists():
            # Fallback for older builds
            app_wrapper_path = app_wrapper_dir / "app_wrapper.js"
        self._esm = app_wrapper_path.read_text()
        self._editor_bundle_path = app_wrapper_dir / "AppWrapper" / "AppWrapper.editor.bundle.js"
        if not self._editor_bundle_path.exists():
            self._editor_bundle_path = app_wrapper_dir / "AppWrapper.editor.bundle.js"
        
        data_json = df.to_dict(orient="records") if df is not None else []
        data_json = clean_for_json(data_json)
        
        if execution_mode is None:
            execution_mode = "auto"
        if execution_approved is None:
            execution_approved = execution_mode != "approve"
        if execution_approved_hash is None:
            execution_approved_hash = ""
        audit_state = {
            "status": "idle",
            "response": {},
            "error": "",
            "request": {},
            "apply": {
                "status": "idle",
                "response": {},
                "error": "",
            },
            "apply_request": {},
        }
        execution_state = {
            "mode": execution_mode,
            "approved": execution_approved,
            "approved_hash": execution_approved_hash,
        }

        super().__init__(
            data=data_json,
            status="generating",
            logs=[],
            code="",
            render_code="",
            error_message="",
            widget_error="",
            widget_logs=[],
            retry_count=0,
            audit_state=audit_state,
            execution_state=execution_state,
            debug_mode=False,
            state_prompt_request={},
            **kwargs
        )

        self._lifecycle = WidgetLifecycle(self)
        # Track whether we should render immediately (not in tests/headless)
        self._display_widget = display_widget

        if existing_code is None:
            self._append_prompt_history(description, source="create")

        if display_widget:
            _display_widget(self)
        
        self.observe(self._on_error, names='error_message')
        self.observe(self._on_widget_error, names='widget_error')
        self.observe(self._on_grab_edit, names='grab_edit_request')
        self.observe(self._on_state_prompt, names='state_prompt_request')
        self.observe(self._on_audit_state, names='audit_state')
        self.observe(self._on_code_change, names='code')
        self.observe(self._on_execution_state, names='execution_state')
        self.observe(self._on_frontend_ready, names='frontend_ready')
        self.observe(self._on_debug_event, names='debug_event')
        self.on_msg(self._handle_custom_msg)
        
        try:
            input_count = len(self._imports or {})
            self._reset_logs([f"Analyzing inputs: {input_count}"])
            
            resolved_model, config = _resolve_model(model)
            provider = OpenRouterProvider(resolved_model, config.api_key)
            agent_run_config = resolve_agent_run_config(
                preset=getattr(config, "agent_preset", "project"),
                overrides=getattr(config, "agent_run", None),
            )
            self._agent_run_config = agent_run_config
            self._agent_tool_registry = default_agent_tools()
            if self._data_path:
                resolved_path = Path(self._data_path).resolve()
                if resolved_path not in agent_run_config.allowed_roots:
                    agent_run_config.allowed_roots.append(resolved_path)
            stream_setting = getattr(config, "streaming", True)
            if stream_setting and _running_in_colab():
                stream_setting = False
                self._append_log("Colab detected: disabling streaming updates")
            self._generation_service = GenerationService(
                provider,
                agent_run_config=agent_run_config,
                stream=stream_setting,
            )
            self._audit_service = AuditService()
            self._llm_provider = provider
            self.orchestrator = self._generation_service.orchestrator
            self._max_retries = max(0, int(getattr(config, "retry", RepairService.MAX_RETRIES)))
            self._repair_service = RepairService(
                self._generation_service.orchestrator,
                max_retries=self._max_retries,
            )
            inputs_for_prompt = self._input_summaries or _summarize_inputs_for_prompt(self._imports)
            if self._data_path:
                inputs_for_prompt.setdefault("data_path", str(self._data_path))
            if df is not None and _is_dataframe(df) and "data" not in inputs_for_prompt:
                try:
                    inputs_for_prompt["data"] = summarize_for_prompt(df)
                except Exception:
                    inputs_for_prompt["data"] = "<data>"
            
            if existing_code is not None:
                self._append_log("Reusing existing widget code")
                self._apply_code(existing_code)
                self._set_status("ready")
                self.description = description
                self._widget_metadata = existing_metadata or {}
                self._sync_prompt_history_metadata()
                if self._theme and "theme_description" not in self._widget_metadata:
                    self._widget_metadata["theme_description"] = self._theme.description
                    self._widget_metadata["theme_name"] = self._theme.name
                imports_serialized = {}
                if self._imports:
                    for import_name in self._imports.keys():
                        imports_serialized[import_name] = f"<imported_trait:{import_name}>"
                if _is_dataframe(df) and "data" not in imports_serialized:
                    imports_serialized["data"] = "<input>"
                self._generation_context = {
                    "var_name": var_name,
                    "data_shape": df.shape if df is not None else None,
                    "resolved_model": resolved_model,
                    "imports_serialized": imports_serialized,
                    "theme_name": self._theme.name if self._theme else None,
                    "theme_description": self._theme.description if self._theme else None,
                    "revision_parent": self._base_widget_id,
                }
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
            if _is_dataframe(df) and "data" not in imports_serialized:
                imports_serialized["data"] = "<input>"

            self._generation_context = {
                "var_name": var_name,
                "data_shape": df.shape if df is not None else None,
                "resolved_model": resolved_model,
                "imports_serialized": imports_serialized,
                "theme_name": self._theme.name if self._theme else None,
                "theme_description": self._theme.description if self._theme else None,
                "revision_parent": self._base_widget_id,
            }
            self._pending_generation = (
                description,
                inputs_for_prompt,
            )
            
            store = WidgetStore()
            cached_widget = None
            if cache:
                cached_widget = store.lookup(
                    description=description,
                    var_name=var_name,
                    data_shape=df.shape if df is not None else None,
                    exports=self._exports,
                    imports_serialized=imports_serialized,
                    theme_description=self._theme.description if self._theme else None,
                    revision_parent=self._base_widget_id,
                )
            else:
                self._append_log("Skipping cache (cache=False)")
            
            # Generation/audit services are already initialized.
            
            if cached_widget:
                self._extend_logs([
                    "✓ Found cached widget",
                    f"  {cached_widget.get('var_name', 'widget')}",
                    f"  Created: {cached_widget['created_at'][:10]}",
                ])
                widget_code = store.load_widget_code(cached_widget)
                self._apply_code(widget_code)
                self._set_status("ready")
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
                self._pending_generation = None
                return
            
            self._append_log("Generating widget code")
            self._generation_context = {
                "var_name": var_name,
                "data_shape": df.shape if df is not None else None,
                "resolved_model": resolved_model,
                "imports_serialized": imports_serialized,
                "theme_name": self._theme.name if self._theme else None,
                "theme_description": self._theme.description if self._theme else None,
                "revision_parent": self._base_widget_id,
            }
            self._pending_generation = (
                description,
                inputs_for_prompt,
            )
            if self.frontend_ready:
                self._start_generation(description, inputs_for_prompt)
            else:
                # Fallback: if frontend_ready never arrives (e.g. Colab comm
                # sync issues), start generation after a short delay.
                def _frontend_ready_fallback():
                    time.sleep(3)
                    pending = getattr(self, "_pending_generation", None)
                    if pending is not None:
                        self._pending_generation = None
                        self._append_log("Frontend ready timeout — starting generation")
                        self._start_generation(*pending)

                fallback = threading.Thread(
                    target=_frontend_ready_fallback, daemon=True
                )
                fallback.start()
            return
            
        except Exception as e:
            self._set_status("error")
            self._append_log(f"Error: {str(e)}")
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

    def _set_status(self, status: str, *, force: bool = False) -> None:
        """Update widget lifecycle status through the lifecycle manager."""
        lifecycle = getattr(self, "_lifecycle", None)
        if lifecycle is None:
            self.status = status
            _write_debug_log("status_set", f"{status}")
            return
        prev_status = self.status
        if status == prev_status and not force:
            _write_debug_log("status_transition_skipped", f"{prev_status} -> {status}")
            return
        lifecycle.transition(status, force=force)
        _write_debug_log("status_transition", f"{prev_status} -> {status}")
        if status == "ready":
            return

    def _append_log(self, message: str) -> None:
        logs = list(self.logs or [])
        logs.append(message)
        self.logs = logs
        _write_debug_log("progress_log_append", message)

    def _reset_logs(self, messages: list[str]) -> None:
        self.logs = list(messages)
        _write_debug_log("progress_log_reset", " | ".join(messages))

    def _extend_logs(self, messages: list[str]) -> None:
        if not messages:
            return
        logs = list(self.logs or [])
        logs.extend(messages)
        self.logs = logs
        for message in messages:
            _write_debug_log("progress_log_extend", message)

    # Adds logger streams to the generation call
    def _start_generation(
        self,
        description: str,
        inputs_for_prompt: dict[str, str],
    ) -> None:
        
        parser = CodeStreamParser()
        chunk_buffer: list[str] = []
        update_counter = 0
        last_pattern_count = 0

        def stream_callback(event_type: str, message: str):
            """Handle progress events from orchestrator."""
            nonlocal update_counter, last_pattern_count

            _write_debug_log("agent_trace", f"{event_type} | {message}")

            event_messages = {
                "step": f"{message}",
                "thinking": f"{message[:150]}",
                "complete": f"✓ {message}",
                "error": f"✘ {message}",
                "chunk": message,
                "agent_message": f"Agent: {message}",
                "tool_call": f"{message}",
                "tool_result": f"{message}",
            }

            display_msg = event_messages.get(event_type, message)

            if event_type == "chunk":
                chunk_buffer.append(message)
                update_counter += 1

                updates = parser.parse_chunk(message)

                should_update = (
                    update_counter % 30 == 0
                    or parser.has_new_pattern()
                    or len("".join(chunk_buffer)) > 500
                )

                if should_update:
                    if chunk_buffer:
                        chunk_buffer.clear()

                    for update in updates:
                        if update["type"] == "micro_bubble":
                            self._append_log(update["message"])

                    current_pattern_count = len(parser.detected)
                    if current_pattern_count == last_pattern_count and update_counter % 100 == 0:
                        self._append_log(f"Generating code ({update_counter} chunks)")
                    last_pattern_count = current_pattern_count
            else:
                self._append_log(display_msg)

        def handle_complete(widget_code: str) -> None:
            context = getattr(self, "_generation_context", {}) or {}
            self._append_log(f"Code generated: {len(widget_code)} characters")

            store = WidgetStore()
            widget_entry = store.save(
                widget_code=widget_code,
                description=description,
                var_name=context.get("var_name"),
                data_shape=context.get("data_shape"),
                model=context.get("resolved_model"),
                exports=self._exports,
                imports_serialized=context.get("imports_serialized", {}),
                theme_name=context.get("theme_name"),
                theme_description=context.get("theme_description"),
                notebook_path=store.get_notebook_path(),
                revision_parent=context.get("revision_parent"),
                prompt_history=list(self._prompt_history or []),
            )

            self._extend_logs([
                f"Widget saved: {widget_entry.get('var_name', 'widget')}",
                f"Location: .vibewidget/widgets/{widget_entry['file_name']}",
            ])
            self._apply_code(widget_code)
            self._set_status("ready")
            self.description = description
            widget_entry["prompt_history"] = list(self._prompt_history or [])
            self._widget_metadata = widget_entry

            self.data_info = LLMProvider.build_data_info(
                outputs=self._exports,
                inputs=inputs_for_prompt,
                actions=self._actions,
                action_params=self._action_params,
                theme_description=self._theme.description if self._theme else None,
            )

        def handle_error(exc: Exception) -> None:
            self._set_status("error")
            error_msg = str(exc)
            # Store the error message so repair flow can access it
            self.error_message = error_msg

            # Special handling for truncation errors
            if isinstance(exc, MaxTokensExceeded):
                self._append_log(f"⚠ {error_msg}")
                self._append_log("Try: 'make it simpler' or 'reduce complexity'")
            else:
                self._append_log(f"Error: {error_msg}")
            logger.exception("Widget generation failed")

        if getattr(self, "_display_widget", True):
            # async path for interactive rendering
            self._generation_service.start_generation_async(
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
                on_complete=handle_complete,
                on_error=handle_error,
            )
        else:
            # synchronous path for non-display contexts (tests, headless) to ensure code is ready
            try:
                code, _ = self._generation_service.generate(
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
                handle_complete(code)
            except Exception as exc:
                handle_error(exc)

    def _normalize_audit_state(self, state: dict[str, Any] | None) -> dict[str, Any]:
        base = {
            "status": "idle",
            "response": {},
            "error": "",
            "request": {},
            "apply": {
                "status": "idle",
                "response": {},
                "error": "",
            },
            "apply_request": {},
        }
        if not isinstance(state, dict):
            return base
        merged = dict(base)
        merged.update(state)
        apply_state = dict(base["apply"])
        if isinstance(state.get("apply"), dict):
            apply_state.update(state["apply"])
        merged["apply"] = apply_state
        return merged

    def _update_audit_state(self, **updates: Any) -> None:
        state = self._normalize_audit_state(self.audit_state)
        apply_updates = updates.pop("apply", None)
        if isinstance(apply_updates, dict):
            apply_state = dict(state.get("apply", {}))
            apply_state.update(apply_updates)
            state["apply"] = apply_state
        state.update(updates)
        self.audit_state = state

    def _normalize_execution_state(self, state: dict[str, Any] | None) -> dict[str, Any]:
        base = {
            "mode": "auto",
            "approved": True,
            "approved_hash": "",
        }
        if not isinstance(state, dict):
            return base
        merged = dict(base)
        merged.update(state)
        return merged

    def _update_execution_state(self, **updates: Any) -> None:
        state = self._normalize_execution_state(self.execution_state)
        state.update(updates)
        self.execution_state = state

    @property
    def audit_status(self) -> str:
        return self._normalize_audit_state(self.audit_state).get("status", "idle")

    @audit_status.setter
    def audit_status(self, value: str) -> None:
        self._update_audit_state(status=value)

    @property
    def audit_response(self) -> dict[str, Any]:
        return self._normalize_audit_state(self.audit_state).get("response", {})

    @audit_response.setter
    def audit_response(self, value: dict[str, Any]) -> None:
        self._update_audit_state(response=value)

    @property
    def audit_error(self) -> str:
        return self._normalize_audit_state(self.audit_state).get("error", "")

    @audit_error.setter
    def audit_error(self, value: str) -> None:
        self._update_audit_state(error=value)

    @property
    def audit_apply_status(self) -> str:
        return self._normalize_audit_state(self.audit_state).get("apply", {}).get("status", "idle")

    @audit_apply_status.setter
    def audit_apply_status(self, value: str) -> None:
        self._update_audit_state(apply={"status": value})

    @property
    def audit_apply_response(self) -> dict[str, Any]:
        return self._normalize_audit_state(self.audit_state).get("apply", {}).get("response", {})

    @audit_apply_response.setter
    def audit_apply_response(self, value: dict[str, Any]) -> None:
        self._update_audit_state(apply={"response": value})

    @property
    def audit_apply_error(self) -> str:
        return self._normalize_audit_state(self.audit_state).get("apply", {}).get("error", "")

    @audit_apply_error.setter
    def audit_apply_error(self, value: str) -> None:
        self._update_audit_state(apply={"error": value})

    @property
    def execution_mode(self) -> str:
        return self._normalize_execution_state(self.execution_state).get("mode", "auto")

    @execution_mode.setter
    def execution_mode(self, value: str) -> None:
        self._update_execution_state(mode=value)

    @property
    def execution_approved(self) -> bool:
        return bool(self._normalize_execution_state(self.execution_state).get("approved", True))

    @execution_approved.setter
    def execution_approved(self, value: bool) -> None:
        self._update_execution_state(approved=bool(value))

    @property
    def execution_approved_hash(self) -> str:
        return self._normalize_execution_state(self.execution_state).get("approved_hash", "")

    @execution_approved_hash.setter
    def execution_approved_hash(self, value: str) -> None:
        self._update_execution_state(approved_hash=value or "")

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
            "prompt_history": list(self._prompt_history or []),
        }

        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=True)
        return target

    def _rerun_with(self, *args, **kwargs) -> "VibeWidget":
        if not self._creation_params:
            raise ValueError("This widget was created before rerun support was added.")

        params = self._creation_params
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
                merged = dict(params.get("imports") or {})
                merged.update(bundle_inputs or {})
                candidate_imports = merged
            else:
                matched = False
                if params.get("data_type") and isinstance(arg, params.get("data_type")):
                    candidate_data = arg
                    matched = True
                if not matched:
                    # Try to swap an import with the same type
                    for name, source in (params.get("imports") or {}).items():
                        if source is not None and isinstance(arg, type(source)):
                            merged = dict(params.get("imports") or {})
                            merged[name] = arg
                            candidate_imports = merged
                            matched = True
                            break
                if not matched:
                    # Fallback: treat as data (covers DataFrame, str path, etc.)
                    candidate_data = arg

        data = candidate_data if candidate_data is not None else params.get("data_source")
        imports = candidate_imports if candidate_imports is not None else params.get("imports")
        df = load_data(data)
        existing_code = getattr(self, "code", None)
        existing_metadata = getattr(self, "_widget_metadata", None)

        if params.get("data_columns") and _is_dataframe(df):
            missing = set(params.get("data_columns")) - set(df.columns)
            if missing:
                raise ValueError(
                    "The new dataset is missing required columns for this widget: "
                    f"{sorted(missing)}. Provide data with these columns or regenerate the widget."
                )

        widget = VibeWidget._create_with_dynamic_traits(
            description=params.get("description"),
            df=df,
            model=params.get("model_resolved"),
            exports=params.get("exports"),
            imports=imports,
            theme=params.get("theme"),
            var_name=None,
            base_code=params.get("base_code"),
            base_components=params.get("base_components"),
            base_widget_id=params.get("base_widget_id"),
            existing_code=existing_code,
            existing_metadata=existing_metadata,
            display_widget=display,
            execution_mode=self.execution_mode,
            execution_approved=None,
            execution_approved_hash=self.execution_approved_hash,
        )
        widget._store_creation_params(
            description=params.get("description"),
            data_source=data,
            data_type=type(data) if data is not None else params.get("data_type"),
            data_columns=list(df.columns) if _is_dataframe(df) else params.get("data_columns"),
            exports=params.get("exports"),
            imports=imports,
            model=params.get("model_resolved"),
            theme=params.get("theme"),
            base_code=params.get("base_code"),
            base_components=params.get("base_components"),
            base_widget_id=params.get("base_widget_id"),
        )
        return widget

    def edit(
        self,
        description: str,
        data: "pd.DataFrame | str | Path | None" = None,
        outputs: dict[str, str] | OutputBundle | None = None,
        inputs: dict[str, Any] | InputsBundle | None = None,
        actions: dict[str, str] | ActionBundle | None = None,
        theme: Theme | str | None = None,
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

    def _on_audit_state(self, change):
        """Handle audit requests embedded in audit_state."""
        new_state = self._normalize_audit_state(change.get("new"))
        old_state = self._normalize_audit_state(change.get("old"))

        request = new_state.get("request") or {}
        if request and request != (old_state.get("request") or {}):
            self._handle_audit_request(request)

        apply_request = new_state.get("apply_request") or {}
        if apply_request and apply_request != (old_state.get("apply_request") or {}):
            self._handle_audit_apply_request(apply_request)

    def _load_editor_bundle(self) -> str:
        global _EDITOR_BUNDLE_CACHE
        if _EDITOR_BUNDLE_CACHE is not None:
            return _EDITOR_BUNDLE_CACHE
        if not self._editor_bundle_path.exists():
            raise FileNotFoundError(
                f"Editor bundle not found at {self._editor_bundle_path}. "
                "Run `npm run build-app-wrapper` to generate it."
            )
        _EDITOR_BUNDLE_CACHE = self._editor_bundle_path.read_text(encoding="utf-8")
        return _EDITOR_BUNDLE_CACHE

    def _handle_custom_msg(self, *args) -> None:
        """Handle frontend custom messages across ipywidgets versions."""
        if len(args) == 3:
            _, content, buffers = args
        elif len(args) == 2:
            content, buffers = args
        else:
            return
        if not isinstance(content, dict):
            return
        msg_type = content.get("type")
        if msg_type == "request_editor_bundle":
            try:
                bundle = self._load_editor_bundle()
                self.send({"type": "editor_bundle", "code": bundle})
            except Exception as exc:
                self.send({"type": "editor_bundle_error", "error": str(exc)})
            return
        if msg_type == "save_widget":
            request_id = content.get("request_id")
            path = content.get("path") or "widget.vw"
            include_inputs = bool(content.get("include_inputs"))
            try:
                saved_path = self.save(path, include_inputs=include_inputs)
                self.send(
                    {
                        "type": "save_widget_result",
                        "request_id": request_id,
                        "path": str(saved_path),
                        "success": True,
                    }
                )
            except Exception as exc:
                self.send(
                    {
                        "type": "save_widget_result",
                        "request_id": request_id,
                        "error": str(exc),
                        "success": False,
                    }
                )
            return
        if msg_type != "remote_call":
            return

        call_id = content.get("id")
        name = content.get("name")
        args = content.get("args") or {}
        if not call_id or not name or not isinstance(args, dict):
            self.send(
                {
                    "type": "remote_call_result",
                    "id": call_id,
                    "success": False,
                    "error": "invalid_remote_call",
                }
            )
            return
        tool_registry = getattr(self, "_agent_tool_registry", None) or default_agent_tools()
        run_config = getattr(self, "_agent_run_config", None)
        if run_config is None:
            config = get_global_config()
            run_config = resolve_agent_run_config(
                preset=getattr(config, "agent_preset", "project"),
                overrides=getattr(config, "agent_run", None),
            )
        context = AgentHarnessContext(
            widget=self,
            permission_tier=run_config.permission_tier,
            safety_mode=run_config.safety_mode,
            allowed_roots=run_config.allowed_roots,
            sandbox_dir=run_config.sandbox_dir,
            allow_net_fetch=run_config.allow_net_fetch,
            allow_search=run_config.allow_search,
            net_allowlist=run_config.net_allowlist,
            net_mime_allowlist=run_config.net_mime_allowlist,
        )
        tool = tool_registry.get(str(name))
        if tool is None:
            self.send(
                {
                    "type": "remote_call_result",
                    "id": call_id,
                    "success": False,
                    "error": f"tool_not_found:{name}",
                }
            )
            return
        try:
            result = tool.execute(context=context, **args)
            payload = {
                "type": "remote_call_result",
                "id": call_id,
                "success": result.success,
                "result": clean_for_json(result.output),
                "error": result.error,
                "metadata": result.metadata,
            }
            self.send(payload)
        except Exception as exc:
            self.send(
                {
                    "type": "remote_call_result",
                    "id": call_id,
                    "success": False,
                    "error": str(exc),
                }
            )

    def _handle_audit_request(self, request: dict[str, Any]) -> None:
        """Handle audit requests from the frontend."""
        level = str(request.get("level", "fast")).lower()
        reuse = bool(request.get("reuse", True))
        try:
            if self.audit_status == "running":
                return
            result = self._run_audit(level=level, reuse=reuse, display=False)
            self.audit_response = result
        except Exception as exc:
            self.audit_status = "error"
            self.audit_error = str(exc)
            self.audit_response = {"error": str(exc), "level": level}
        finally:
            # Always clear the request flag so the frontend can unblock
            self._update_audit_state(request={})

    def _handle_audit_apply_request(self, request: dict[str, Any]) -> None:
        """Apply audit-driven changes via the LLM."""
        if not request:
            return
        if self.audit_apply_status == "running":
            return
        if self._generation_service is None:
            self.audit_apply_error = "No LLM service available to apply changes."
            self.audit_apply_status = "error"
            self._update_audit_state(apply_request={})
            return

        changes = request.get("changes", [])
        base_code = request.get("base_code") or self.code
        if not base_code:
            self.audit_apply_error = "No source code available to apply changes."
            self.audit_apply_status = "error"
            self._update_audit_state(apply_request={})
            return

        self.audit_apply_status = "running"
        self.audit_apply_error = ""
        if self.status != "generating":
            self._set_status("generating")

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
            self._apply_code(revised_code)
            self._set_status("ready")
            self.audit_apply_status = "idle"
            self.audit_apply_response = {"success": True, "applied": len(changes)}
        except Exception as exc:
            self.audit_apply_status = "error"
            self.audit_apply_error = str(exc)
            self.audit_apply_response = {"success": False, "error": str(exc)}
            self._set_status("ready")
        finally:
            self._update_audit_state(apply_request={})
    
    def _on_error(self, change):
        """Called when frontend reports a runtime error."""
        error_msg = change["new"]

        # Log error regardless of repair state
        if error_msg:
            logger.error("Frontend runtime error:\n%s", error_msg)
            _write_debug_log("runtime_error_received", f"status={self.status} retry={self.retry_count}")
            _write_debug_log("runtime_error_message", error_msg[:500])
            self.last_runtime_error = error_msg
            preview = error_msg.split("\n")[0][:200]
            if preview != self._last_logged_runtime_error:
                path_hint = self._widget_file_path()
                hint_suffix = f" | Code file: {path_hint}" if path_hint else ""
                self._append_log(f"Runtime error: {preview}{hint_suffix}")
                self._last_logged_runtime_error = preview

        # Skip if this is a clear event (empty string)
        if not error_msg:
            return

        # Prevent re-entrance during repair
        if self._repair_in_progress:
            _write_debug_log("repair_skipped", "repair already in progress")
            return

        orchestrator = getattr(self, "orchestrator", None)
        if self._repair_service is None:
            if orchestrator is None or not hasattr(orchestrator, "fix_runtime_error"):
                return
            self._repair_service = RepairService(orchestrator, max_retries=self._max_retries)
        elif orchestrator is not None and getattr(self._repair_service, "orchestrator", None) is not orchestrator:
            self._repair_service = RepairService(orchestrator, max_retries=self._max_retries)

        if self.retry_count >= self._max_retries:
            self._set_status("blocked")
            self._append_log("Repair blocked: retry limit reached")
            _write_debug_log("repair_blocked", f"retry={self.retry_count}")
            return

        self._repair_in_progress = True
        try:
            self.retry_count += 1
            self._set_status("retrying")
            _write_debug_log("repair_attempt_start", f"retry={self.retry_count}")

            error_preview = error_msg.split("\n")[0][:100]
            path_hint = self._widget_file_path()
            hint_suffix = f" | Code file: {path_hint}" if path_hint else ""
            self._extend_logs([f"Runtime error: {error_preview}{hint_suffix}", "Repairing code..."])

            result = self._repair_service.fix_runtime_error(
                code=self.code,
                error_message=error_msg,
                data_info=self.data_info,
                retry_count=self.retry_count,
                widget_error=self.widget_error,
                last_runtime_error=self.last_runtime_error,
                widget_logs=list(self.widget_logs or []),
                code_path=self._widget_file_path(),
            )
            _write_debug_log("repair_result", f"applied={result.applied} retryable={result.retryable}")

            if result.applied:
                self._append_log("Code fixed, retrying")
                bundle_success = self._apply_code(result.code)
                if bundle_success:
                    self._set_status("ready")
                    # Reset retry count and clear error state so frontend renders widget
                    self.retry_count = 0
                    self.error_message = ""
                    self.widget_error = ""
                    self.last_runtime_error = ""
                    self.widget_logs = []  # Clear old error logs
                    _write_debug_log("repair_success", "fix applied and bundled")
                else:
                    # Bundling failed - _apply_code will set error_message
                    self._append_log("Fix applied but bundling failed")
                    _write_debug_log("repair_bundle_failed", "fix applied but bundling failed")
                return

            self._append_log(result.message or "Fix attempt failed")
            if result.retryable:
                self._set_status("error")
            else:
                self._set_status("blocked")
        finally:
            self._repair_in_progress = False

    def _append_widget_log(self, message: str, *, level: str = "info", source: str = "python") -> None:
        logs = list(self.widget_logs or [])
        logs.append(
            {
                "timestamp": time.time(),
                "message": message,
                "level": level,
                "source": source,
            }
        )
        if len(logs) > 200:
            logs = logs[-200:]
        self.widget_logs = logs

    def _append_prompt_history(
        self,
        prompt: str,
        *,
        source: str,
        meta: dict[str, Any] | None = None,
    ) -> None:
        cleaned = str(prompt or "").strip()
        if not cleaned:
            return
        entry = {
            "prompt": cleaned,
            "source": source,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if meta:
            entry["meta"] = clean_for_json(meta)
        history = list(self._prompt_history or [])
        history.append(entry)
        self._prompt_history = history
        self._sync_prompt_history_metadata()

    def _sync_prompt_history_metadata(self) -> None:
        if self._widget_metadata is None:
            return
        self._widget_metadata["prompt_history"] = list(self._prompt_history or [])

    @property
    def prompt_history(self) -> list[dict[str, Any]]:
        """Return collected prompts for this widget instance."""
        return list(self._prompt_history or [])
    
    def _widget_file_path(self) -> str | None:
        metadata = getattr(self, "_widget_metadata", {}) or {}
        file_name = metadata.get("file_name")
        if file_name:
            return f".vibewidget/widgets/{file_name}"
        return None

    def _on_widget_error(self, change):
        """Surface widget errors coming from the frontend."""
        error_msg = change.get("new") or ""
        if not error_msg:
            return
        logger.error("Widget runtime error:\n%s", error_msg)
        _write_debug_log("widget_error_received", error_msg[:500])
        try:
            self._append_widget_log(f"Widget error: {error_msg}", level="error", source="js")
        except Exception:
            pass
    
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
        parent_var_name = parent_metadata.get("var_name") or "widget"
        
        # Component widget metadata
        component_metadata = {
            **parent_metadata,
            "is_component_view": True,
            "source_component": component_name,
            "parent_cache_key": parent_metadata.get("cache_key"),
            "parent_var_name": parent_var_name,
            "var_name": f"{parent_var_name}:{self._to_python_attr(component_name)}",
            # Component has single component (itself)
            "components": [component_name],
        }
        
        # Get data from parent widget
        data = self.data
        pd = _get_pandas()
        df = pd.DataFrame(data) if data else pd.DataFrame()
        
        # Create the component widget
        widget = VibeWidget._create_with_dynamic_traits(
            description=f"{component_name} (from {parent_var_name})",
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
        self._append_prompt_history(
            user_prompt,
            source="grab_edit",
            meta={"element": element_desc.get("description") or element_desc.get("tag")},
        )
        if self._generation_service is None:
            self._set_status("error")
            self._reset_logs(["✘ Edit failed: LLM service unavailable"])
            return
        
        old_code = self.code
        previous_metadata = self._widget_metadata
        self._pending_old_code = old_code
        self.edit_in_progress = True
        self._set_status("generating")
        self._reset_logs([f"Editing: {user_prompt[:50]}{'...' if len(user_prompt) > 50 else ''}"])
        
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
                    self._append_log("Analyzing code")
                    showed_analyzing = True
                
                window_start = max(0, old_position - WINDOW_SIZE)
                window_end = min(len(old_code), old_position + WINDOW_SIZE + len(chunk))
                window = old_code[window_start:window_end]
                
                found_at = window.find(chunk)
                
                if found_at != -1:
                    old_position = window_start + found_at + len(chunk)
                else:
                    if not showed_applying:
                        self._append_log("Applying changes")
                        showed_applying = True
                    
                    updates = parser.parse_chunk(chunk)
                    if parser.has_new_pattern():
                        for update in updates:
                            if update["type"] == "micro_bubble":
                                self._append_log(update["message"])
                return
            
            if event_type == "complete":
                self._append_log(f"✓ {message}")
            elif event_type == "error":
                self._append_log(f"✘ {message}")
        
        try:
            revision_request = self._build_grab_revision_request(element_desc, user_prompt)
            
            revised_code = self._generation_service.revise_code(
                code=self.code,
                revision_request=revision_request,
                data_info=self.data_info,
                progress_callback=progress_callback,
            )
            
            self._apply_code(revised_code)
            self._set_status("ready")
            self._append_log("✓ Edit applied")
            
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
                prompt_history=list(self._prompt_history or []),
            )
            widget_entry["prompt_history"] = list(self._prompt_history or [])
            self._widget_metadata = widget_entry
            var_name = widget_entry.get('var_name', 'widget')
            self._append_log(f"Saved: {var_name} (cache: {widget_entry['cache_key'][:8]}...)")
            
        except Exception as e:
            if "cancelled" in str(e).lower():
                self._apply_code(old_code)
                self._set_status("ready")
                self._append_log("✗ Edit cancelled")
            else:
                self._set_status("error")
                self._append_log(f"✘ Edit failed: {str(e)}")
        
        self.edit_in_progress = False
        self.grab_edit_request = {}

    def _on_state_prompt(self, change):
        """Handle state viewer prompts for regeneration or repair."""
        request = change.get("new") or {}
        if not request:
            return
        user_prompt = str(request.get("prompt", "") or "").strip()
        if not user_prompt:
            self.state_prompt_request = {}
            return
        self._append_prompt_history(
            user_prompt,
            source="state_prompt",
            meta={"mode": str(request.get("mode") or "")},
        )

        base_code = request.get("base_code")
        if isinstance(base_code, str) and base_code.strip():
            self._base_code = base_code
            self._base_components = []

        error_override = str(request.get("error", "") or "").strip()
        self.state_prompt_request = {}

        status = str(getattr(self, "status", "") or "").lower()
        if status == "generating":
            self._generation_service.cancel_generation()
            self._handle_regeneration_prompt(user_prompt)
            return
        if status == "ready":
            self._handle_regeneration_prompt(user_prompt)
        elif status in {"error", "blocked"}:
            self._handle_repair_prompt(user_prompt, error_override)

    def _handle_regeneration_prompt(self, user_prompt: str) -> None:
        if self._generation_service is None:
            self._set_status("error")
            self._reset_logs(["✘ Regeneration failed: LLM service unavailable"])
            return

        self._set_status("generating")
        self.error_message = ""
        self.widget_error = ""
        self.retry_count = 0
        self._extend_logs([
            f"USER INPUT: {user_prompt}",
            f"Regenerating: {user_prompt[:50]}{'...' if len(user_prompt) > 50 else ''}"
        ])

        inputs_for_prompt = self._input_summaries or _summarize_inputs_for_prompt(self._imports)
        if "data" not in inputs_for_prompt and self.data:
            try:
                inputs_for_prompt["data"] = summarize_for_prompt(_get_pandas().DataFrame(self.data))
            except Exception:
                inputs_for_prompt["data"] = "<data>"

        base_description = (self.description or "").strip()
        if base_description:
            description = f"{base_description}\n\nUser refinement: {user_prompt}"
        else:
            description = user_prompt

        try:
            self._start_generation(description, inputs_for_prompt)
        except Exception as exc:
            self._set_status("error")
            self._append_log(f"✘ Regeneration failed: {exc}")

    def _handle_repair_prompt(self, user_prompt: str, error_override: str) -> None:
        if self._generation_service is None or self.orchestrator is None:
            self._set_status("error")
            self._reset_logs(["✘ Repair failed: LLM service unavailable"])
            return

        error_message = error_override or self.widget_error or self.error_message
        if not error_message:
            self._reset_logs(["✘ Repair failed: missing error context"])
            self._set_status("error")
            return

        self._set_status("retrying")
        self._extend_logs([
            f"USER INPUT: {user_prompt}",
            f"Manual repair: {user_prompt[:50]}{'...' if len(user_prompt) > 50 else ''}",
            "Asking LLM to repair with user context",
        ])

        try:
            result = self._repair_service.fix_runtime_error(
                code=self.code,
                error_message=error_message,
                data_info=self.data_info,
                retry_count=self.retry_count,
                widget_error=self.widget_error,
                last_runtime_error=self.last_runtime_error,
                widget_logs=list(self.widget_logs or []),
                code_path=self._widget_file_path(),
                user_prompt=user_prompt,
                progress_callback=None,
            )
            if result.applied:
                bundle_success = self._apply_code(result.code)
                if bundle_success:
                    self.error_message = ""
                    self.widget_error = ""
                    self.last_runtime_error = ""
                    self.widget_logs = []  # Clear old error logs
                    self.retry_count = 0
                    self._set_status("ready")
                else:
                    self._append_log("Fix applied but bundling failed")
                return
            self._append_log(result.message or "Repair did not change the code")
            self._set_status("error")
        except Exception as exc:
            self._append_log(f"Repair failed: {exc}")
            self._set_status("error")
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
            self._refresh_render_code(change.get("new") or "")
            return
        current_hash = compute_code_hash(self.code or "")
        approved_hash = self.execution_approved_hash or ""
        if approved_hash and current_hash == approved_hash:
            if not self.execution_approved:
                self.execution_approved = True
        else:
            if self.execution_approved:
                self.execution_approved = False
        self._refresh_render_code(change.get("new") or "")

    def _on_execution_state(self, change):
        """Persist approval hash when user approves the current code."""
        new_state = self._normalize_execution_state(change.get("new"))
        old_state = self._normalize_execution_state(change.get("old"))
        if not new_state.get("approved"):
            return
        current_hash = compute_code_hash(self.code or "")
        if new_state.get("approved_hash") == current_hash:
            return
        if old_state.get("approved") and old_state.get("approved_hash") == current_hash:
            return
        updated = dict(new_state)
        updated["approved_hash"] = current_hash
        self.execution_state = updated

    def _on_frontend_ready(self, change) -> None:
        """Start pending generation once the frontend signals readiness."""
        if not change.get("new"):
            return
        pending = getattr(self, "_pending_generation", None)
        if not pending:
            return
        self._pending_generation = None
        description, inputs_for_prompt = pending
        self._start_generation(description, inputs_for_prompt)

    def _on_debug_event(self, change):
        """Persist frontend debug events to logs.txt."""
        payload = change.get("new") or {}
        if not payload:
            return
        event = payload.get("source", "debug")
        message = payload.get("message") or payload.get("event") or ""
        label = payload.get("label") or ""
        meta = payload.get("modelId") or ""
        parts = [part for part in [meta, label, message] if part]
        _write_debug_log(event, " | ".join(parts))

    def _refresh_render_code(self, source: str) -> bool:
        """Ensure render_code stays in sync with the current source code.

        Returns True if bundling succeeded (or fallback to unbundled), False otherwise.
        """
        if not source:
            self.render_code = ""
            self._last_bundle_hash = ""
            return False
        source_hash = self._bundle_service.bundle_key(source)
        if self._last_bundle_hash == source_hash and self.render_code:
            return True
        bundle_result = self._bundle_service.bundle(source)
        if bundle_result.code and bundle_result.bundled:
            self.render_code = bundle_result.code
            self._last_bundle_hash = source_hash
            return True

        # Bundling failed - check if we can fall back to unbundled (Babel in browser)
        # Environment errors (no node/esbuild) are safe to fall back
        env_errors = {"bundler_unavailable", "no_source", "npm_not_available"}
        is_env_error = bundle_result.error in env_errors

        if is_env_error or os.getenv("VIBE_ALLOW_UNBUNDLED") == "1":
            # Fall back to raw source - frontend Babel will transform it
            self.render_code = source
            self._last_bundle_hash = source_hash
            return True
        else:
            # Code-related bundle error - this is a real error
            self.render_code = ""
            self._last_bundle_hash = source_hash
            if bundle_result.error and bundle_result.error != self._last_bundle_error:
                self._append_log(f"Bundling failed: {bundle_result.error}")
                self._last_bundle_error = bundle_result.error
                self.error_message = f"Bundling failed: {bundle_result.error}"
            self._set_status("error")
            return False

    def _apply_code(self, source: str) -> bool:
        """Set source + render code together.

        Returns True if bundling succeeded, False otherwise.
        """
        self.code = source
        return self._refresh_render_code(source)



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
        if getattr(widget, "_displayed", False):
            _write_debug_log("display_widget_skip", f"model_id={getattr(widget, 'model_id', '')}")
            return
        from IPython.display import display
        _write_debug_log("display_widget", f"model_id={getattr(widget, 'model_id', '')}")
        display(widget)
    except ImportError:
        pass
    except Exception as exc:
        print(f"[vibe_widget] Display error: {exc}", file=sys.stderr)


def _resolve_model(
    model_override: str | None = None,
) -> tuple[str, Config]:
    """Resolve the model using global config."""
    config = get_global_config()
    candidate = model_override or config.model
    model_map = PREMIUM_MODELS if config.mode == "premium" else STANDARD_MODELS
    resolved_model = model_map.get(candidate, candidate)
    return resolved_model, config


def _looks_like_data(value: Any) -> bool:
    """Check if a value looks like data (DataFrame, file path, URL) vs a plain value like a token."""
    # DataFrame or pandas object
    if _is_dataframe(value):
        return True
    # Path object
    if isinstance(value, Path):
        return True
    # String that looks like a file path or URL
    if isinstance(value, str):
        # URL
        if value.startswith(("http://", "https://")):
            return True
        # File path with known data extension
        lower = value.lower()
        data_extensions = (
            ".csv", ".tsv", ".json", ".geojson", ".parquet",
            ".nc", ".nc4", ".netcdf", ".xml", ".xlsx", ".xls", ".pdf", ".txt"
        )
        if any(lower.endswith(ext) for ext in data_extensions):
            return True
        # Existing file or directory
        try:
            if Path(value).exists():
                return True
        except (OSError, ValueError):
            pass
    # Dict that looks like data (has features for GeoJSON, or data/results keys)
    if isinstance(value, dict):
        if "features" in value or any(k in value for k in ("data", "results", "items", "records")):
            return True
    # List of dicts (records)
    if isinstance(value, list) and value and isinstance(value[0], dict):
        return True
    return False


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
            candidate = next(iter(bundle_inputs.values()))
            # Only treat as data if it looks like actual data, not a plain value like a token
            if _looks_like_data(candidate):
                normalized_data = candidate
            else:
                # Keep as input, not data
                if isinstance(normalized_inputs, InputsBundle):
                    normalized_inputs = {**bundle_inputs, **(normalized_inputs.inputs or {})}
                else:
                    normalized_inputs = {**bundle_inputs, **(normalized_inputs or {})}
                normalized_data = None
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
            candidate = next(iter(bundle_inputs.values()))
            # Only promote to data if it looks like actual data, not a plain value like a token
            if _looks_like_data(candidate):
                normalized_data = candidate
                normalized_inputs = {}
            else:
                normalized_inputs = bundle_inputs
        else:
            normalized_inputs = bundle_inputs

    if isinstance(normalized_actions, ActionBundle):
        normalized_action_params = normalized_actions.params
        normalized_actions = normalized_actions.actions

    return normalized_data, normalized_outputs, normalized_inputs, normalized_actions, normalized_action_params, var_name


def create(
    description: str,
    data: "pd.DataFrame | str | Path | None" = None,
    outputs: dict[str, str] | OutputBundle | None = None,
    inputs: dict[str, Any] | InputsBundle | None = None,
    actions: dict[str, str] | ActionBundle | None = None,
    theme: Theme | str | None = None,
    display: bool = True,
    cache: bool = True,
) -> "WidgetHandle":
    """Create a VibeWidget visualization with automatic data processing.

    Args:
        description: Natural language description of the visualization
        data: DataFrame, file path, or URL to visualize
        outputs: Dict of {trait_name: description} for exposed state
        inputs: Dict of {trait_name: source} for consumed state
        actions: Dict of {action_name: description} for interactive callbacks
        theme: Theme object, theme name, or prompt string
        display: Whether to display the widget immediately (IPython environments only)
        cache: If False, bypass cache and regenerate widget/theme

    Returns:
        WidgetHandle for re-running and inspecting the widget

    Examples:
        >>> scatter_plot = create("show temperature trends", df)
        >>> sales_chart = create("visualize sales data", "sales.csv")
    """
    _write_debug_log("create_called", f"display={display} cache={cache}")
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
    model, resolved_config = _resolve_model()
    data_path: Path | None = None
    if data is not None and isinstance(data, (str, Path)):
        candidate = Path(data)
        if candidate.exists() and candidate.is_dir():
            data_path = candidate.resolve()
            df = _get_pandas().DataFrame()
        else:
            df = load_data(data)
    else:
        df = load_data(data)
    if data_path is not None:
        if inputs is None:
            inputs = {}
        if "data_path" not in inputs:
            inputs = dict(inputs)
            inputs["data_path"] = str(data_path)
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
        data_root=data_path,
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
        data_columns=list(df.columns) if _is_dataframe(df) else None,
        exports=outputs,
        imports=inputs,
        model=model,
        theme=resolved_theme,
    )

    _write_debug_log("create_return", f"model_id={getattr(widget, 'model_id', '')}")
    return WidgetHandle(widget)


class _SourceInfo:
    """Container for resolved source information."""
    def __init__(
        self,
        code: str,
        metadata: dict[str, Any] | None,
        components: list[str],
        df: "pd.DataFrame | None",
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


class WidgetHandle:
    """Callable handle that renders widgets without displaying itself."""

    __vibe_widget_handle__ = True

    def __init__(self, widget: "VibeWidget"):
        self._widget = widget

    @property
    def widget(self) -> "VibeWidget":
        return self._widget

    def __call__(self, *args, **kwargs) -> "VibeWidget":
        _write_debug_log("handle_rerun", f"model_id={getattr(self._widget, 'model_id', '')}")
        widget = self._widget._rerun_with(*args, **kwargs)
        self._widget = widget
        return widget

    def __setattr__(self, name: str, value: Any) -> None:
        if name == "_widget":
            super().__setattr__(name, value)
            return
        setattr(self._widget, name, value)

    def __getattr__(self, name: str):
        return getattr(self._widget, name)

    def __repr__(self) -> str:
        metadata = getattr(self._widget, "_widget_metadata", {}) or {}
        label = metadata.get("var_name") or getattr(self._widget, "description", None) or "widget"
        status = getattr(self._widget, "status", "unknown")
        return f"<VibeWidgetHandle {label} status={status}>"

    def _repr_mimebundle_(self, **kwargs):  # pragma: no cover - display hook
        return {"text/plain": repr(self)}, {}


def _resolve_source(
    source: "VibeWidget | WidgetHandle | str | Path",
    store: WidgetStore
) -> _SourceInfo:
    """Resolve source widget to code, metadata, components, and data."""
    if isinstance(source, WidgetHandle):
        source = source.widget

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
                df=_get_pandas().DataFrame(source.data) if source.data else None,
                theme=source._theme,
                target_component=None,  # Not needed - standalone code already focuses on component
            )

        # Regular widget
        return _SourceInfo(
            code=source.code,
            metadata=source._widget_metadata,
            components=source._widget_metadata.get("components", []) if source._widget_metadata else [],
            df=_get_pandas().DataFrame(source.data) if source.data else None,
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
    source: "VibeWidget | WidgetHandle | str | Path",
    data: "pd.DataFrame | str | Path | None" = None,
    outputs: dict[str, str] | OutputBundle | None = None,
    inputs: dict[str, Any] | InputsBundle | None = None,
    actions: dict[str, str] | ActionBundle | None = None,
    theme: Theme | str | None = None,
    display: bool = True,
    cache: bool = True,
    _var_name: str | None = None,
) -> "WidgetHandle":
    """Edit a widget by building upon existing code.

    Args:
        description: Natural language description of changes
        source: Widget (including component widgets), widget ID, or file path
        data: DataFrame to visualize (uses source data if None)
        outputs: Dict of {trait_name: description} for new/modified outputs
        inputs: Dict of {trait_name: source} for new/modified inputs
        actions: Dict of {action_name: description} for new/modified actions
        theme: Theme object, theme name, or prompt string
        cache: If False, bypass cache and regenerate widget/theme

    Returns:
        WidgetHandle for the edited widget

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
    model, resolved_config = _resolve_model()
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
        data_columns=list(df.columns) if _is_dataframe(df) else None,
        exports=outputs,
        imports=inputs,
        model=model,
        theme=resolved_theme,
        base_code=source_info.code,
        base_components=source_info.components,
        base_widget_id=base_cache_key,
    )

    return WidgetHandle(widget)


_WIDGET_SELECTOR_ESM = """
function render({ model, el }) {
  const widgets = model.get('widgets') || [];
  const container = document.createElement('div');
  container.style.cssText = `
    font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
    background: #000;
    border-radius: 8px;
    padding: 16px;
    max-width: 800px;
    outline: none;
    border: 1px solid #333;
  `;
  container.tabIndex = 0;

  let selectedIndex = 0;
  let isActive = true;
  const totalItems = widgets.length + 1; // +1 for Exit option

  // Disable Jupyter keyboard shortcuts
  function disableJupyterKeyboard() {
    try {
      if (typeof Jupyter !== 'undefined' && Jupyter.keyboard_manager) {
        Jupyter.keyboard_manager.disable();
      }
    } catch (e) {}
  }

  function enableJupyterKeyboard() {
    try {
      if (typeof Jupyter !== 'undefined' && Jupyter.keyboard_manager) {
        Jupyter.keyboard_manager.enable();
      }
    } catch (e) {}
  }

  function finishSelection(index) {
    if (!isActive) return;
    isActive = false;
    enableJupyterKeyboard();
    model.set('selected_index', index);
    model.save_changes();
    // Hide the selector
    container.style.display = 'none';
  }

  function renderList() {
    if (!isActive) return;

    const header = `
      <div style="color: #f97316; font-size: 12px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.1em;">
        Cached Widgets (${widgets.length} total)
      </div>
      <div style="color: #64748b; font-size: 11px; margin-bottom: 12px;">
        ↑↓ Navigate • Enter Select • Esc Exit
      </div>
    `;

    let rows = '';
    const maxShow = Math.min(widgets.length, 20);
    for (let i = 0; i < maxShow; i++) {
      const w = widgets[i];
      const isSelected = i === selectedIndex;
      const bgColor = isSelected ? '#1e293b' : 'transparent';
      const borderLeft = isSelected ? '3px solid #f97316' : '3px solid transparent';

      const shape = w.data_shape;
      const shapeStr = shape && shape.length >= 2 ? shape[0] + '×' + shape[1] : '-';
      const created = (w.created_at || '').slice(0, 19).replace('T', ' ');
      const descShort = (w.description || '').slice(0, 40) + ((w.description || '').length > 40 ? '...' : '');

      rows += '<div data-index="' + i + '" style="display:flex;align-items:center;padding:8px 12px;background:' + bgColor + ';border-left:' + borderLeft + ';cursor:pointer;">' +
        '<span style="width:30px;color:#f97316;font-weight:600;">' + i + '</span>' +
        '<span style="width:140px;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (w.var_name || 'unknown') + '</span>' +
        '<span style="flex:1;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + descShort + '</span>' +
        '<span style="width:70px;color:#64748b;text-align:right;">' + shapeStr + '</span>' +
        '<span style="width:140px;color:#64748b;text-align:right;">' + created + '</span>' +
        '</div>';
    }

    if (widgets.length > 20) {
      rows += '<div style="color:#64748b;padding:8px 12px;">... and ' + (widgets.length - 20) + ' more</div>';
    }

    // Exit option
    const exitSelected = selectedIndex === widgets.length;
    const exitBg = exitSelected ? '#1e293b' : 'transparent';
    const exitBorder = exitSelected ? '3px solid #f97316' : '3px solid transparent';
    rows += '<div data-index="' + widgets.length + '" style="display:flex;align-items:center;padding:8px 12px;margin-top:8px;border-top:1px solid #333;background:' + exitBg + ';border-left:' + exitBorder + ';cursor:pointer;">' +
      '<span style="color:#ef4444;">✕ Exit (cancel selection)</span></div>';

    // Description panel
    let descPanel = '';
    if (selectedIndex < widgets.length && widgets[selectedIndex]) {
      const selected = widgets[selectedIndex];
      descPanel = '<div style="margin-top:12px;padding:12px;background:#111;border-radius:4px;border:1px solid #333;">' +
        '<div style="color:#f97316;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Description</div>' +
        '<div style="color:#e2e8f0;font-size:12px;line-height:1.5;">' + (selected.description || 'No description') + '</div></div>';
    }

    container.innerHTML = header +
      '<div style="font-size:12px;">' +
      '<div style="display:flex;padding:6px 12px;border-bottom:1px solid #333;color:#64748b;text-transform:uppercase;font-size:10px;">' +
      '<span style="width:30px;">#</span>' +
      '<span style="width:140px;">Name</span>' +
      '<span style="flex:1;">Description</span>' +
      '<span style="width:70px;text-align:right;">Shape</span>' +
      '<span style="width:140px;text-align:right;">Created</span>' +
      '</div>' + rows + '</div>' + descPanel;

    // Add click handlers - single click selects, double click confirms
    container.querySelectorAll('[data-index]').forEach(function(row) {
      row.onclick = function() {
        const idx = parseInt(row.dataset.index, 10);
        selectedIndex = idx;
        renderList();
        container.focus(); // Keep focus for keyboard nav
      };
      row.ondblclick = function() {
        const idx = parseInt(row.dataset.index, 10);
        if (idx >= widgets.length) {
          finishSelection(-1); // Exit
        } else {
          finishSelection(idx);
        }
      };
    });
  }

  function processKey(key) {
    if (!isActive) return false;

    if (key === 'ArrowDown') {
      selectedIndex = Math.min(selectedIndex + 1, totalItems - 1);
      renderList();
      return true;
    } else if (key === 'ArrowUp') {
      selectedIndex = Math.max(selectedIndex - 1, 0);
      renderList();
      return true;
    } else if (key === 'Enter') {
      if (selectedIndex >= widgets.length) {
        finishSelection(-1);
      } else {
        finishSelection(selectedIndex);
      }
      return true;
    } else if (key === 'Escape') {
      finishSelection(-1);
      return true;
    }
    return false;
  }

  function handleKey(e) {
    if (!isActive) return;
    // Only handle if our container is focused or contains focus
    if (document.activeElement !== container && !container.contains(document.activeElement)) {
      return;
    }

    if (processKey(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }

  // Container-level handler (for when container has focus)
  container.addEventListener('keydown', function(e) {
    if (!isActive) return;
    if (processKey(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }, true);

  // Document-level capture to intercept before Jupyter
  document.addEventListener('keydown', handleKey, true);

  el.appendChild(container);
  renderList();

  // Auto-focus with multiple attempts and keep trying
  function tryFocus() {
    if (isActive && document.body.contains(container)) {
      container.focus();
      disableJupyterKeyboard();
    }
  }
  setTimeout(tryFocus, 50);
  setTimeout(tryFocus, 150);
  setTimeout(tryFocus, 300);
  setTimeout(tryFocus, 500);

  // Also focus when container is clicked
  container.addEventListener('click', function() {
    if (isActive) {
      container.focus();
      disableJupyterKeyboard();
    }
  });

  // Cleanup
  return function() {
    isActive = false;
    enableJupyterKeyboard();
    document.removeEventListener('keydown', handleKey, true);
  };
}
export default { render };
"""


class WidgetSelector(anywidget.AnyWidget):
    """Interactive widget selector with keyboard navigation."""

    _esm = _WIDGET_SELECTOR_ESM
    widgets = traitlets.List([]).tag(sync=True)
    selected_index = traitlets.Int(-2).tag(sync=True)  # -2 = pending, -1 = exit, 0+ = widget index


class WidgetBrowser:
    """Non-blocking widget browser returned by vw.load().

    Displays an interactive selector. After selection, call directly with data:
        widget = vw.load()
        # ... navigate and press Enter to select ...
        widget(data)  # Renders the selected widget with your data
    """

    def __init__(
        self,
        widgets_data: list[dict[str, Any]],
        approval: bool = True,
        display_widget: bool = True,
    ):
        self._widgets_data = widgets_data
        self._approval = approval
        self._display_widget = display_widget
        self._selector: WidgetSelector | None = None
        self._result: "WidgetHandle | None" = None
        self._finished = False
        self._selected_name: str | None = None

        if not widgets_data:
            print("No cached widgets found.")
            self._finished = True
            return

        # Prepare widget data for JS
        js_widgets = []
        for w in widgets_data[:50]:
            js_widgets.append({
                "var_name": w.get("var_name", "unknown"),
                "description": w.get("description", ""),
                "data_shape": w.get("data_shape"),
                "created_at": w.get("created_at", ""),
                "_index": w.get("_index", 0),
            })

        self._selector = WidgetSelector(widgets=js_widgets, selected_index=-2)

        # Watch for selection
        self._selector.observe(self._on_selection, names=['selected_index'])

        # Display immediately
        from IPython.display import display
        display(self._selector)

    def _on_selection(self, change):
        """Called when user makes a selection."""
        idx = change['new']
        if idx == -2:  # Still pending
            return

        self._finished = True

        if idx == -1:  # Exit/cancel
            self._result = None
            print("Selection cancelled.")
        elif 0 <= idx < len(self._widgets_data):
            # Load the selected widget (don't display yet - user will call widget(data))
            selected = self._widgets_data[idx]
            var_name = selected.get("var_name")
            self._selected_name = var_name
            widget_idx = selected.get("_index", 0)

            store = WidgetStore()
            result = store.load_by_var_name(var_name, widget_idx)
            if result:
                widget_entry, code = result
                self._result = _load_from_cached_entry(
                    widget_entry,
                    code,
                    approval=self._approval,
                    display=False,  # Don't display - just store it
                )
                desc = selected.get("description", "")[:60]
                if len(selected.get("description", "")) > 60:
                    desc += "..."
                print(f"✓ Selected: {var_name}")
                print(f"  {desc}")
                print(f"  Use: widget(data) to render")

    def __call__(self, data=None, *, inputs=None, display=True, **kwargs):
        """Render the selected widget with data.

        Args:
            data: DataFrame or data to pass to the widget
            inputs: Dict of additional inputs to pass to the widget
            display: Whether to display the widget (default True)
            **kwargs: Additional arguments passed to the widget

        Returns:
            The rendered widget, or None if no selection was made
        """
        if self._result is None:
            if self.is_pending:
                print("No widget selected yet. Navigate and press Enter to select.")
            else:
                print("No widget selected (cancelled).")
            return None
        return self._result(data, inputs=inputs, display=display, **kwargs)

    @property
    def selected(self) -> "WidgetHandle | None":
        """Get the selected widget (None if cancelled or not yet selected)."""
        return self._result

    @property
    def is_pending(self) -> bool:
        """True if user hasn't made a selection yet."""
        return not self._finished

    def __repr__(self):
        if self._finished:
            if self._result:
                name = self._selected_name or "widget"
                return f"WidgetBrowser(selected='{name}') - call with widget(data) to render"
            return "WidgetBrowser(cancelled)"
        return "WidgetBrowser(pending - navigate and press Enter)"


def _show_widget_selector(
    widgets_data: list[dict[str, Any]],
    approval: bool = True,
    display_widget: bool = True,
) -> "WidgetBrowser":
    """Show interactive widget selector (non-blocking)."""
    return WidgetBrowser(
        widgets_data=widgets_data,
        approval=approval,
        display_widget=display_widget,
    )


def _load_from_cached_entry(
    cached_entry: dict[str, Any],
    code: str,
    approval: bool = True,
    display: bool = True,
) -> "WidgetHandle":
    """Load a widget from a cached entry and code."""
    description = cached_entry.get("description") or "Loaded widget"
    outputs = cached_entry.get("outputs") or {}
    theme = None

    theme_desc = cached_entry.get("theme_description")
    theme_name = cached_entry.get("theme_name")
    if theme_desc or theme_name:
        theme = Theme(description=theme_desc or "", name=theme_name)

    metadata = dict(cached_entry)
    model = cached_entry.get("model") or DEFAULT_MODEL

    execution_mode = "approve" if approval else "auto"
    execution_approved = not approval
    approved_hash = compute_code_hash(code) if not approval else ""

    widget = VibeWidget._create_with_dynamic_traits(
        description=description,
        df=None,
        model=model,
        exports=outputs,
        imports={},
        theme=theme,
        var_name=cached_entry.get("var_name"),
        existing_code=code,
        existing_metadata=metadata,
        display_widget=display,
        cache=False,
        execution_mode=execution_mode,
        execution_approved=execution_approved,
        execution_approved_hash=approved_hash,
    )

    # Store creation params to enable rerun with new data
    widget._store_creation_params(
        description=description,
        data_source=None,
        data_type=None,
        data_columns=None,
        exports=outputs,
        imports={},
        model=model,
        theme=theme,
    )

    return WidgetHandle(widget)


def load(
    path: str | Path | None = None,
    approval: bool = True,
    display: bool = True
) -> "WidgetHandle | WidgetBrowser | None":
    """Load a widget bundle or cached widget file from disk.

    Args:
        path: Path to .vw bundle or cached widget file. If None, shows
              an interactive selector for cached widgets (non-blocking).
        approval: Whether to require approval before running code
        display: Whether to display the widget immediately

    Returns:
        - If path provided: WidgetHandle for the loaded widget
        - If no path: WidgetBrowser (non-blocking). Navigate with ↑↓, Enter to
          select, Esc to cancel. Access result via `browser.selected`

    Example:
        # Load specific widget
        widget = vw.load("my_widget.vw")

        # Browse cached widgets (non-blocking)
        browser = vw.load()
        # ... navigate and press Enter ...
        widget = browser.selected  # WidgetHandle or None if cancelled
    """
    # No path provided - show interactive selector (non-blocking)
    if path is None:
        store = WidgetStore()
        widgets_data = store.get_recent_widgets(limit=100)
        return _show_widget_selector(
            widgets_data,
            approval=approval,
            display_widget=display,
        )

    target = Path(path)

    payload: dict[str, Any] | None = None
    cached_entry: dict[str, Any] | None = None
    code = ""

    if target.suffix == ".vw":
        with open(target, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    else:
        if target.is_dir():
            raise ValueError("vw.load expects a .vw bundle or cached widget file, not a directory.")

        store = WidgetStore()
        widgets_dict = store.index.get("widgets", {})
        for var_name, widgets in widgets_dict.items():
            for idx, widget in enumerate(widgets):
                file_name = widget.get("file_name")
                if not file_name:
                    continue
                store_path = (store.widgets_dir / file_name).resolve()
                if store_path == target.resolve():
                    cached_entry = dict(widget)
                    cached_entry["var_name"] = var_name
                    cached_entry["_index"] = idx
                    break
            if cached_entry:
                break

        if cached_entry:
            code = target.read_text(encoding="utf-8")
        else:
            cached = store.load_from_file(target)
            if cached:
                cached_entry, code = cached

    if payload is None and cached_entry is None:
        raise FileNotFoundError(f"Widget file not found: {target}")

    if payload is not None:
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

        pd = _get_pandas()
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
            "prompt_history": payload.get("prompt_history") or [],
        }
        model = payload.get("model") or DEFAULT_MODEL
        data_rows_embedded = data_rows if embedded else None
    else:
        description = cached_entry.get("description") or "Loaded widget"
        outputs = {}
        imports = {}
        df = _get_pandas().DataFrame()
        components = cached_entry.get("components") or WidgetStore().extract_components(code)
        theme_name = cached_entry.get("theme_name")
        theme_description = cached_entry.get("theme_description")
        theme = None
        if theme_name or theme_description:
            theme = Theme(
                description=theme_description or "",
                name=theme_name,
            )

        metadata = {
            "description": description,
            "components": components,
            "model": cached_entry.get("model"),
            "theme_name": theme_name,
            "theme_description": theme_description,
            "source_path": str(target.resolve()),
            "created_at": cached_entry.get("created_at"),
            "cache_key": cached_entry.get("cache_key"),
            "var_name": cached_entry.get("var_name"),
            "revision_parent": cached_entry.get("revision_parent"),
            "prompt_history": cached_entry.get("prompt_history") or [],
        }
        model = cached_entry.get("model") or DEFAULT_MODEL
        data_rows_embedded = None
        input_values = {}

    execution_mode = "approve" if approval else "auto"
    execution_approved = not approval
    approved_hash = compute_code_hash(code) if not approval else ""

    widget = VibeWidget._create_with_dynamic_traits(
        description=description,
        df=df,
        model=model,
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

    if payload is not None and isinstance(input_values, dict):
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
        data_source=data_rows_embedded,
        data_type=type(data_rows_embedded) if data_rows_embedded is not None else None,
        data_columns=list(df.columns) if _is_dataframe(df) else None,
        exports=outputs,
        imports=imports,
        model=model,
        theme=theme,
    )

    return WidgetHandle(widget)


def clear(target: Union["VibeWidget", "WidgetHandle", str] = "all") -> dict[str, int]:
    """Clear cached widgets, themes, audits, or a specific widget's cache."""
    results = {"widgets": 0, "themes": 0, "audits": 0}

    if isinstance(target, WidgetHandle):
        target = target.widget

    if isinstance(target, VibeWidget):
        metadata = getattr(target, "_widget_metadata", {}) or {}
        cache_key = metadata.get("cache_key")
        var_name = metadata.get("var_name")
        results["widgets"] = WidgetStore().clear_for_widget(cache_key=cache_key, var_name=var_name)
        results["audits"] = AuditStore().clear_for_widget(widget_id=cache_key, widget_slug=var_name)
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

        results["widgets"] = WidgetStore().clear_for_widget(var_name=target)
        results["audits"] = AuditStore().clear_for_widget(widget_slug=target)
        return results

    raise TypeError("vw.clear expects a cache type string or a VibeWidget instance.")
