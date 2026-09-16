from vibe_widget.api import ExportHandle, action, actions, inputs, output, outputs
from vibe_widget.config import Config, config
from vibe_widget.core import VibeWidget, WidgetHandle, clear, create, edit, load
from vibe_widget.namespaces import (
    execution,
    mode,
    models,
    presets,
    themes,
)
from vibe_widget.themes import Theme, theme

try:  # the version lives in pyproject.toml; read it back rather than repeating it here
    from importlib.metadata import PackageNotFoundError
    from importlib.metadata import version as _package_version

    __version__ = _package_version("vibe-widget")
except (ImportError, PackageNotFoundError):  # running from a source tree with no install
    __version__ = "0+unknown"
__all__ = [
    "VibeWidget",
    "WidgetHandle",
    "create",
    "edit",
    "load",
    "clear",
    "config",
    "Config",
    "models",
    "Theme",
    "theme",
    "themes",
    "mode",
    "execution",
    "presets",
    "output",
    "outputs",
    "inputs",
    "action",
    "actions",
    "ExportHandle",
]
