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
class InputsBundle:
    """Container that unifies data with other inputs."""

    data: Any
    inputs: dict[str, Any]
    data_name: str | None = None


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

    if "data" in kwargs:
        kw_data = kwargs.pop("data")
        if data is None:
            data = kw_data
            data_name = "data"
        else:
            inputs["data"] = kw_data

    for name, value in kwargs.items():
        inputs[name] = value

    return InputsBundle(data=data, inputs=inputs, data_name=data_name)


def output(description: str) -> OutputDefinition:
    """Declare a single output."""
    return OutputDefinition(description)


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


def inputs(*args: Any, **kwargs: Any) -> InputsBundle:
    """Bundle data with inputs, allowing positional or named arguments."""
    frame = inspect.currentframe()
    caller_frame = frame.f_back if frame else None
    return _build_inputs_bundle(args, kwargs, caller_frame=caller_frame)
