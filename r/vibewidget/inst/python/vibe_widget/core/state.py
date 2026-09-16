"""State management helpers for Vibe Widgets."""

from __future__ import annotations

from typing import Any

from vibe_widget.api import ExportHandle


class OutputsNamespace:
    """Namespace for accessing outputs on a widget."""

    def __init__(self, widget: Any):
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


class ActionsNamespace:
    """Namespace for calling actions on a widget."""

    def __init__(self, widget: Any):
        object.__setattr__(self, "_widget", widget)

    def __getattr__(self, name: str):
        actions = getattr(self._widget, "_actions", {}) or {}
        if name in actions:
            action_params = getattr(self._widget, "_action_params", {}) or {}
            params_schema = action_params.get(name)

            def action_caller(**kwargs):
                import time

                action_event = {
                    "action": name,
                    "params": kwargs,
                    "timestamp": time.time(),
                }
                self._widget.action_event = action_event
                return None

            action_caller.__name__ = name
            action_caller.__doc__ = actions[name]
            return action_caller

        raise AttributeError(f"'{type(self._widget).__name__}.actions' has no attribute '{name}'")

    def __dir__(self) -> list[str]:
        actions = getattr(self._widget, "_actions", {}) or {}
        return list(actions.keys())


class ComponentNamespace:
    """Namespace for accessing component widgets."""

    def __init__(self, widget: Any):
        object.__setattr__(self, "_widget", widget)
        object.__setattr__(self, "_cache", {})

    def __getattr__(self, name: str):
        cache = object.__getattribute__(self, "_cache")
        if name in cache:
            return cache[name]

        widget = object.__getattribute__(self, "_widget")
        component_name = widget._resolve_component_name(name)
        if component_name is None:
            available = widget._component_attr_names()
            hint = f" Available: {', '.join(available)}" if available else ""
            raise AttributeError(
                f"'{type(widget).__name__}.component' has no attribute '{name}'.{hint}"
            )

        component_widget = widget._create_component_widget(component_name)
        cache[name] = component_widget
        return component_widget

    def __dir__(self) -> list[str]:
        widget = object.__getattribute__(self, "_widget")
        return widget._component_attr_names() + ["list", "names"]

    def __iter__(self):
        widget = object.__getattribute__(self, "_widget")
        return iter(widget._component_attr_names())

    def __len__(self) -> int:
        widget = object.__getattribute__(self, "_widget")
        return len(widget._component_attr_names())

    @property
    def names(self) -> list[str]:
        widget = object.__getattribute__(self, "_widget")
        return widget._component_attr_names()


class StateManager:
    """Unified state manager for outputs/actions/components."""

    def __init__(self, widget: Any):
        self._widget = widget
        self._outputs: OutputsNamespace | None = None
        self._actions: ActionsNamespace | None = None
        self._components: ComponentNamespace | None = None

    @property
    def outputs(self) -> OutputsNamespace:
        if self._outputs is None:
            self._outputs = OutputsNamespace(self._widget)
        return self._outputs

    @property
    def actions(self) -> ActionsNamespace:
        if self._actions is None:
            self._actions = ActionsNamespace(self._widget)
        return self._actions

    @property
    def component(self) -> ComponentNamespace:
        if self._components is None:
            self._components = ComponentNamespace(self._widget)
        return self._components
