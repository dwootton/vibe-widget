"""Provider adapter for agent tool calls."""

from __future__ import annotations

from typing import Any

from vibe_widget.llm.providers.base import LLMProvider


class AgentProviderAdapter:
    """Wrap an LLM provider with tool-capable chat completions."""

    def __init__(self, provider: LLMProvider):
        self.provider = provider

    def supports_tools(self) -> bool:
        return hasattr(self.provider, "client") and hasattr(self.provider.client, "chat")

    def supports_streaming(self) -> bool:
        return self.supports_tools()

    def chat_complete(
        self,
        *,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        tool_choice: str | dict[str, Any] | None = None,
        max_tokens: int = 8192,
        temperature: float = 0.7,
    ):
        if not self.supports_tools():
            raise RuntimeError("Provider does not support tool calls.")
        params: dict[str, Any] = {
            "model": getattr(self.provider, "model", None),
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if tools:
            params["tools"] = tools
            if tool_choice:
                params["tool_choice"] = tool_choice
        return self.provider.client.chat.completions.create(**params)

    def chat_complete_stream(
        self,
        *,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        tool_choice: str | dict[str, Any] | None = None,
        max_tokens: int = 8192,
        temperature: float = 0.7,
    ):
        if not self.supports_streaming():
            raise RuntimeError("Provider does not support streaming.")
        params: dict[str, Any] = {
            "model": getattr(self.provider, "model", None),
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True,
        }
        if tools:
            params["tools"] = tools
            if tool_choice:
                params["tool_choice"] = tool_choice
        return self.provider.client.chat.completions.create(**params)
