"""Provider adapter for agent tool calls."""

from __future__ import annotations

from typing import Any

from vibe_widget.llm.providers.base import LLMProvider


class AgentProviderAdapter:
    """Wrap an LLM provider with tool-capable chat completions."""

    def __init__(self, provider: LLMProvider):
        self.provider = provider

    def supports_tools(self) -> bool:
        """True when the provider exposes a tool-capable chat completion."""
        return callable(getattr(self.provider, "chat_completion", None))

    def chat_complete(
        self,
        *,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        tool_choice: str | dict[str, Any] | None = None,
        max_tokens: int = 8192,
        temperature: float | None = None,
    ) -> Any:
        """Run a non-streaming chat completion."""
        return self._complete(
            messages=messages,
            tools=tools,
            tool_choice=tool_choice,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=False,
        )

    def chat_complete_stream(
        self,
        *,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        tool_choice: str | dict[str, Any] | None = None,
        max_tokens: int = 8192,
        temperature: float | None = None,
    ) -> Any:
        """Run a streaming chat completion."""
        return self._complete(
            messages=messages,
            tools=tools,
            tool_choice=tool_choice,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=True,
        )

    def _complete(self, *, stream: bool, **kwargs: Any) -> Any:
        if not self.supports_tools():
            raise RuntimeError("Provider does not support tool calls.")
        return self.provider.chat_completion(stream=stream, **kwargs)
