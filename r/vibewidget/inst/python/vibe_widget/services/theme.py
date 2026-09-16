"""Theme service wrapper."""

from __future__ import annotations

from typing import Any

from vibe_widget.themes import Theme, resolve_theme_for_request


class ThemeService:
    """Resolve themes for widget creation/edit flows."""

    def resolve(
        self,
        theme: Theme | str | None,
        *,
        model: str,
        api_key: str | None,
        cache: bool,
    ) -> Theme | None:
        return resolve_theme_for_request(
            theme,
            model=model,
            api_key=api_key,
            cache=cache,
        )
