from __future__ import annotations

"""Small helpers for the public output/input API."""

from dataclasses import dataclass
from typing import Any
import inspect
import re


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
    """Container that unifies data with other inputs."""

    data: Any
    inputs: dict[str, Any]
    data_name: str | None = None


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

    def __call__(self):
        getter = getattr(self.widget, "_get_export_value", None)
        return getter(self.name) if getter else None

    @property
    def value(self):
        return self()

    def __repr__(self) -> str:
        metadata = getattr(self.widget, "_widget_metadata", {}) or {}
        slug = metadata.get("slug") or getattr(self.widget, "description", None) or "widget"
        return f"<VibeExport {slug}.{self.name}>"


def _sanitize_input_name(name: str | None, fallback: str) -> str:
    if not name:
        return fallback
    sanitized = re.sub(r"\W+", "_", name).strip("_")
    if not sanitized:
        return fallback
    if sanitized[0].isdigit():
        sanitized = f"input_{sanitized}"
    return sanitized


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
    caller_frame=None,
) -> InputsBundle:
    debug_inputs = False
    try:
        import os

        debug_inputs = os.getenv("VIBE_WIDGET_DEBUG_INPUTS") == "1"
    except Exception:
        debug_inputs = False
    inputs: dict[str, Any] = {}
    data = None
    data_name = None

    if args:
        data = args[0]
        data_name = _sanitize_input_name(_infer_name_from_frame(data, caller_frame), "data")
        for idx, arg in enumerate(args[1:], start=1):
            inferred = _infer_name_from_frame(arg, caller_frame)
            name = _sanitize_input_name(inferred, f"input_{idx}")
            suffix = 2
            unique = name
            while unique in inputs:
                unique = f"{name}_{suffix}"
                suffix += 1
            inputs[unique] = arg
        if debug_inputs:
            print(
                "[vibe_widget][debug] inputs positional:",
                {"data_name": data_name, "extra_inputs": list(inputs.keys())},
            )

    if "data" in kwargs:
        kw_data = kwargs.pop("data")
        if data is None:
            data = kw_data
            data_name = "data"
        else:
            inputs["data"] = kw_data
        if debug_inputs:
            print("[vibe_widget][debug] inputs kw 'data' seen")

    for name, value in kwargs.items():
        inputs[name] = value
    if debug_inputs:
        print(
            "[vibe_widget][debug] inputs kwargs:",
            {"keys": list(kwargs.keys()), "data_name": data_name},
        )

    return InputsBundle(data=data, inputs=inputs, data_name=data_name)


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


def inputs(*args: Any, **kwargs: Any) -> InputsBundle:
    """Bundle inputs, optionally capturing a data value for widget creation."""
    frame = inspect.currentframe()
    caller_frame = frame.f_back if frame else None
    return _build_inputs_bundle(args, kwargs, caller_frame=caller_frame)
