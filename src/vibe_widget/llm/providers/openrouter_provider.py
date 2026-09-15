"""OpenRouter provider: the OpenAI-compatible provider with OpenRouter defaults."""

from __future__ import annotations

from typing import Any

from vibe_widget.llm.providers.openai_compat import (
    MAX_TOKENS,
    OPENROUTER_BASE_URL,
    OpenAICompatProvider,
)

__all__ = ["MAX_TOKENS", "OpenRouterProvider"]


class OpenRouterProvider(OpenAICompatProvider):
    """LLM provider preset that routes traffic through OpenRouter."""

    base_url_default = OPENROUTER_BASE_URL

    def __init__(
        self,
        model: str,
        api_key: str | None = None,
        site_url: str | None = None,
        app_title: str | None = None,
        **kwargs: Any,
    ) -> None:
        """Create an OpenRouter-backed provider, optionally sending analytics headers."""
        headers = {}
        if site_url:
            headers["HTTP-Referer"] = site_url
        if app_title:
            headers["X-Title"] = app_title
        if headers:
            kwargs.setdefault("default_headers", headers)
        super().__init__(model, api_key, **kwargs)
