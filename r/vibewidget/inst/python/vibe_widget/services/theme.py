"""Theme service wrapper."""

from __future__ import annotations

from vibe_widget.llm.providers.base import ProviderError
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
        """Resolve a theme, falling back to the keyless path when no API key is configured."""
        try:
            return resolve_theme_for_request(
                theme,
                model=model,
                api_key=api_key,
                cache=cache,
            )
        except ProviderError as exc:
            if exc.kind != "auth":
                raise
            # Built-in and saved themes need no provider; an unknown theme prompt
            # still reaches the LLM below and raises the same error.
            return resolve_theme_for_request(theme, cache=cache)
