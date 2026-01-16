"""Module-level namespaces for discoverable access to themes, models, and config options."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from vibe_widget.themes import Theme


class ThemesNamespace:
    """Namespace for accessing themes as attributes.

    Usage:
        vw.themes                    # Pretty prints catalog of all themes
        vw.themes.national_geographic  # Returns Theme object
        vw.themes()                  # Also returns catalog (backward compat)
    """

    def __repr__(self) -> str:
        from vibe_widget.themes import ThemeRegistry
        catalog = ThemeRegistry().list()
        lines = [f"  {name:<20} {desc}" for name, desc in sorted(catalog.items())]
        header = f"Available themes ({len(catalog)}):"
        return header + "\n" + "\n".join(lines)

    def __call__(self):
        """Backward compatibility: vw.themes() still works."""
        from vibe_widget.themes import ThemeRegistry
        return ThemeRegistry().list()

    def __getattr__(self, name: str) -> "Theme":
        from vibe_widget.themes import ThemeRegistry
        theme = ThemeRegistry().get(name)
        if theme is None:
            available = list(ThemeRegistry().list().keys())
            raise AttributeError(
                f"Theme '{name}' not found. Available themes: {available[:5]}... "
                f"(use vw.themes to see all {len(available)})"
            )
        return theme

    def __dir__(self):
        from vibe_widget.themes import ThemeRegistry
        return list(ThemeRegistry().list().keys())


class ModelsNamespace:
    """Namespace for accessing model information.

    Usage:
        vw.models                # Pretty prints available models
        vw.models.standard       # Returns default standard model ID
        vw.models.premium        # Returns default premium model ID
        vw.models()              # Also returns catalog (backward compat)
    """

    def __repr__(self) -> str:
        from vibe_widget.config import STANDARD_MODELS, PREMIUM_MODELS, DEFAULT_MODEL
        lines = [
            "Available models:",
            f"  default:  {DEFAULT_MODEL}",
            f"  standard: {STANDARD_MODELS.get('openrouter', 'N/A')}",
            f"  premium:  {PREMIUM_MODELS.get('openrouter', 'N/A')}",
            "",
            "Usage:",
            "  vw.config(model=vw.models.standard)",
            "  vw.config(model=vw.models.premium)",
            "  vw.config(model='openai/gpt-4o')  # Or any OpenRouter model ID",
        ]
        return "\n".join(lines)

    def __call__(self, *args, **kwargs):
        """Backward compatibility: vw.models() still works."""
        from vibe_widget.config import models as models_func
        return models_func(*args, **kwargs)

    @property
    def standard(self) -> str:
        """Default standard (fast/cheap) model."""
        from vibe_widget.config import STANDARD_MODELS
        return STANDARD_MODELS.get("openrouter", "")

    @property
    def premium(self) -> str:
        """Default premium (powerful/expensive) model."""
        from vibe_widget.config import PREMIUM_MODELS
        return PREMIUM_MODELS.get("openrouter", "")

    @property
    def default(self) -> str:
        """Default model."""
        from vibe_widget.config import DEFAULT_MODEL
        return DEFAULT_MODEL

    def __dir__(self):
        return ["standard", "premium", "default"]


class ModeNamespace:
    """Namespace for mode options.

    Usage:
        vw.mode.standard  # "standard" - fast/cheap models
        vw.mode.premium   # "premium" - powerful/expensive models
    """
    standard: str = "standard"
    premium: str = "premium"

    def __repr__(self) -> str:
        return (
            "Mode options:\n"
            "  vw.mode.standard  # Fast/cheap models (default)\n"
            "  vw.mode.premium   # Powerful/expensive models"
        )

    def __dir__(self):
        return ["standard", "premium"]


class ExecutionNamespace:
    """Namespace for execution options.

    Usage:
        vw.execution.auto     # "auto" - runs immediately
        vw.execution.approve  # "approve" - review before run
    """
    auto: str = "auto"
    approve: str = "approve"

    def __repr__(self) -> str:
        return (
            "Execution options:\n"
            "  vw.execution.auto     # Runs immediately (default)\n"
            "  vw.execution.approve  # Review before run"
        )

    def __dir__(self):
        return ["auto", "approve"]


class PresetsNamespace:
    """Namespace for agent preset options.

    Usage:
        vw.presets.project    # "project" - balanced config (default)
        vw.presets.safe       # "safe" - sandboxed with minimal permissions
        vw.presets.connected  # "connected" - network access enabled
    """
    project: str = "project"
    safe: str = "safe"
    connected: str = "connected"

    def __repr__(self) -> str:
        return (
            "Agent preset options:\n"
            "  vw.presets.project    # Balanced config (default)\n"
            "  vw.presets.safe       # Sandboxed, minimal permissions\n"
            "  vw.presets.connected  # Network access enabled"
        )

    def __dir__(self):
        return ["project", "safe", "connected"]


# Singleton instances
themes = ThemesNamespace()
models = ModelsNamespace()
mode = ModeNamespace()
execution = ExecutionNamespace()
presets = PresetsNamespace()
