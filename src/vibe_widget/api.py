from __future__ import annotations

"""Small helpers for the public output/input API."""

from dataclasses import dataclass
from typing import Any
import inspect

from vibe_widget.utils.logging import get_logger

_logger = get_logger(__name__)

@dataclass
class OutputDefinition:
    """Definition of a widget output."""

    description: str


@dataclass
class OutputBundle:
    """Container for resolved outputs."""

    outputs: dict[str, str]


@dataclass
class ActionDefinition:
    """Definition of a widget action."""

    description: str
    params: dict[str, str] | None = None


@dataclass
class ActionBundle:
    """Container for resolved actions."""

    actions: dict[str, str]
    params: dict[str, dict[str, str] | None] | None = None




@dataclass
class InputsBundle:
    """Container for resolved inputs."""

    inputs: dict[str, Any]
    sample: bool = True


@dataclass
class OutputChangeEvent:
    """Structured change event for output observers."""

    name: str
    old: Any
    new: Any
    timestamp: float
    source: str
    seq: int


class ExportHandle:
    """Callable handle that references a widget output."""

    __vibe_export__ = True

    def __init__(self, widget: Any, name: str):
        self.widget = widget
        self.name = name
        self._observer_wrappers: dict[Any, Any] = {}

    def _wrap_observer(self, handler):
        def wrapper(change):
            try:
                return handler(change)
            except Exception as exc:
                _logger.error(
                    "Observer error for %s.%s: %s",
                    getattr(self.widget, "description", "widget"),
                    self.name,
                    exc,
                )
                try:
                    import traceback

                    traceback.print_exc()
                except Exception:
                    pass
                if hasattr(self.widget, "_append_widget_log"):
                    try:
                        self.widget._append_widget_log(
                            f"Observer error for {self.name}: {exc}",
                            level="error",
                            source="python",
                        )
                    except Exception:
                        pass
        return wrapper

    def __call__(self):
        getter = getattr(self.widget, "_get_export_value", None)
        return getter(self.name) if getter else None

    @property
    def value(self):
        return self()

    @value.setter
    def value(self, new_value):
        setattr(self.widget, self.name, new_value)

    def observe(self, handler, names=None, type='change'):
        """
        Observe changes to this export's value on the underlying widget.

        Args:
            handler: Callback function that receives change dict with 'new', 'old', etc.
            names: Ignored (kept for compatibility with traitlets API)
            type: Type of notification (default: 'change')

        Returns:
            None
        """
        # Delegate to the widget's observe method with this export's name
        wrapper = self._wrap_observer(handler)
        self._observer_wrappers[handler] = wrapper
        return self.widget.observe(wrapper, names=self.name, type=type)

    def unobserve(self, handler, names=None, type='change'):
        """
        Remove an observer from this export.

        Args:
            handler: Callback function to remove
            names: Ignored (kept for compatibility with traitlets API)
            type: Type of notification (default: 'change')

        Returns:
            None
        """
        wrapper = self._observer_wrappers.pop(handler, None)
        return self.widget.unobserve(wrapper or handler, names=self.name, type=type)

    def __repr__(self) -> str:
        metadata = getattr(self.widget, "_widget_metadata", {}) or {}
        label = metadata.get("var_name") or getattr(self.widget, "description", None) or "widget"
        return f"<VibeExport {label}.{self.name}>"


def _sanitize_input_name(name: str | None, fallback: str) -> str:
    from vibe_widget.utils.validation import sanitize_input_name

    return sanitize_input_name(name, fallback)


def _infer_name_from_frame(value: Any, frame) -> str | None:
    if frame is None:
        return None
    for name, candidate in frame.f_locals.items():
        if candidate is value and not name.startswith("_"):
            return name
    for name, candidate in frame.f_globals.items():
        if candidate is value and not name.startswith("_"):
            return name
    return None


def _build_inputs_bundle(
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    *,
    sample: bool = True,
    caller_frame=None,
) -> InputsBundle:
    inputs: dict[str, Any] = {}

    if args:
        for idx, arg in enumerate(args, start=1):
            inferred = _infer_name_from_frame(arg, caller_frame)
            name = _sanitize_input_name(inferred, f"input_{idx}")
            suffix = 2
            unique = name
            while unique in inputs:
                unique = f"{name}_{suffix}"
                suffix += 1
            inputs[unique] = arg

    for name, value in kwargs.items():
        inputs[name] = value

    return InputsBundle(inputs=inputs, sample=sample)


def output(description: str) -> OutputDefinition:
    """Declare a single output."""
    return OutputDefinition(description)


def action(description: str, params: dict[str, str] | None = None) -> ActionDefinition:
    """Declare a single action."""
    return ActionDefinition(description, params=params)


def outputs(**kwargs: OutputDefinition | str) -> OutputBundle:
    """Bundle outputs into the shape the core expects."""
    output_map: dict[str, str] = {}
    for name, definition in kwargs.items():
        if isinstance(definition, OutputDefinition):
            output_map[name] = definition.description
        elif isinstance(definition, str):
            output_map[name] = definition
        else:
            raise TypeError(f"Output '{name}' must be a string or vw.output(...)")
    return OutputBundle(output_map)


def actions(**kwargs: ActionDefinition | str) -> ActionBundle:
    """Bundle actions into the shape the core expects."""
    action_map: dict[str, str] = {}
    action_params: dict[str, dict[str, str] | None] = {}
    for name, definition in kwargs.items():
        if isinstance(definition, ActionDefinition):
            action_map[name] = definition.description
            action_params[name] = definition.params
        elif isinstance(definition, str):
            action_map[name] = definition
            action_params[name] = None
        else:
            raise TypeError(f"Action '{name}' must be a string or vw.action(...)")
    return ActionBundle(action_map, params=action_params)


def inputs(*args: Any, sample: bool = True, **kwargs: Any) -> InputsBundle:
    """Bundle inputs, optionally capturing a data value for widget creation."""
    frame = inspect.currentframe()
    caller_frame = frame.f_back if frame else None
    return _build_inputs_bundle(args, kwargs, sample=sample, caller_frame=caller_frame)
