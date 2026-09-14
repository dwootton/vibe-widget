"""Provider for any OpenAI-compatible chat completions endpoint."""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any, Callable
from urllib.parse import urlparse

import openai
from openai import OpenAI

from vibe_widget.llm.providers.base import LLMProvider, ProviderError
from vibe_widget.utils.platform import is_emscripten

MAX_TOKENS = 20000
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Ordered most specific first: APITimeoutError subclasses APIConnectionError.
_ERROR_KINDS = (
    (openai.AuthenticationError, "auth"),
    (openai.PermissionDeniedError, "auth"),
    (openai.NotFoundError, "not_found"),
    (openai.RateLimitError, "rate_limit"),
    (openai.APITimeoutError, "timeout"),
    (openai.APIConnectionError, "connection"),
)


def _is_context_length(exc: Exception) -> bool:
    """True when a 400 says the prompt exceeded the model's context window."""
    body = getattr(exc, "body", None)
    code = getattr(exc, "code", None) or ""
    if not code and isinstance(body, dict):
        code = (body.get("error") or {}).get("code") or ""
    text = str(exc).lower()
    return (
        code == "context_length_exceeded"
        or "context length" in text
        or "maximum context" in text
    )


class OpenAICompatProvider(LLMProvider):
    """LLM provider that talks to an OpenAI-compatible chat completions API."""

    base_url_default: str | None = None

    def __init__(
        self,
        model: str,
        api_key: str | None = None,
        *,
        base_url: str | None = None,
        temperature: float = 0.7,
        timeout: float = 120.0,
        default_headers: dict[str, str] | None = None,
    ) -> None:
        """Create a provider bound to one model on one OpenAI-compatible host."""
        self.model = model
        self.temperature = temperature
        self.timeout = timeout
        self.base_url = (
            base_url
            or self.base_url_default
            or os.environ.get("VIBE_BASE_URL")
            or OPENROUTER_BASE_URL
        )
        self.usage: dict[str, int] = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "requests": 0,
        }

        resolved_key = api_key or self._api_key_from_env()
        if not resolved_key:
            raise ProviderError(
                f"No API key for {self.host}; set VIBE_API_KEY in your environment "
                "or pass vw.config(api_key=...).",
                "auth",
            )

        # In Pyodide / JupyterLite the default httpx jsfetch transport can
        # fail with "TypeError: Failed to fetch".  Use a custom transport
        # that calls pyfetch() with explicit CORS-friendly options.
        http_client = None
        if is_emscripten():
            try:
                from vibe_widget.utils.pyodide_http import make_pyodide_http_client

                http_client = make_pyodide_http_client()
            except Exception:
                pass  # fall back to default transport

        self.client = OpenAI(
            base_url=self.base_url,
            api_key=resolved_key,
            default_headers=default_headers or None,
            http_client=http_client,
            timeout=timeout,
        )

    @property
    def host(self) -> str:
        """Hostname of the configured endpoint, for user-facing messages."""
        return urlparse(self.base_url).hostname or self.base_url

    def _api_key_from_env(self) -> str | None:
        key = os.environ.get("VIBE_API_KEY") or os.environ.get("OPENROUTER_API_KEY")
        if not key and "openrouter.ai" not in self.base_url:
            key = os.environ.get("OPENAI_API_KEY")
        return key

    # --- request plumbing -------------------------------------------------

    def _wrap(self, exc: Exception) -> ProviderError:
        """Translate an openai SDK exception into a ProviderError with a fix hint."""
        if _is_context_length(exc):
            return ProviderError(self._message_for("context_length"), "context_length")
        for exc_type, kind in _ERROR_KINDS:
            if isinstance(exc, exc_type):
                return ProviderError(self._message_for(kind), kind)
        return ProviderError(f"Request to {self.host} failed: {exc}", "other")

    def _message_for(self, kind: str) -> str:
        if kind == "auth":
            return (
                f"{self.host} rejected the API key for {self.model}; set a valid key "
                "with vw.config(api_key=...) or the VIBE_API_KEY environment variable."
            )
        if kind == "not_found":
            return (
                f"{self.host} has no model named {self.model}; choose another with "
                "vw.config(model=...) or list the options with vw.models()."
            )
        if kind == "rate_limit":
            return (
                f"{self.host} is rate limiting {self.model}; wait a moment and retry, "
                "or switch models with vw.config(model=...)."
            )
        if kind == "context_length":
            return (
                f"The prompt is longer than {self.model} allows on {self.host}; simplify the "
                "request, or send less data with vw.config(data_privacy='schema')."
            )
        if kind == "timeout":
            return (
                f"{self.host} did not respond within {self.timeout} seconds; raise the "
                "limit with vw.config(timeout=...)."
            )
        return (
            f"Could not reach {self.host}; check your network or the endpoint set with "
            "vw.config(base_url=...)."
        )

    def _record_usage(self, usage: Any) -> None:
        if usage is None:
            return
        self.usage["prompt_tokens"] += int(getattr(usage, "prompt_tokens", 0) or 0)
        self.usage["completion_tokens"] += int(getattr(usage, "completion_tokens", 0) or 0)

    def _stream_iter(self, stream: Any) -> Iterator[Any]:
        try:
            for chunk in stream:
                self._record_usage(getattr(chunk, "usage", None))
                yield chunk
        except Exception as exc:  # noqa: BLE001
            raise self._wrap(exc) from exc

    def _create(self, params: dict[str, Any], *, stream: bool = False) -> Any:
        """Call the chat completions API, counting the request and wrapping failures."""
        if stream:
            params = dict(params, stream=True, stream_options={"include_usage": True})
        try:
            response = self.client.chat.completions.create(**params)
        except openai.BadRequestError as exc:
            if not stream or _is_context_length(exc):
                raise self._wrap(exc) from exc
            # ponytail: retries any 400 once without stream_options, upgrade to
            # inspecting the error body if a host starts rejecting for other reasons.
            params = {k: v for k, v in params.items() if k != "stream_options"}
            try:
                response = self.client.chat.completions.create(**params)
            except Exception as retry_exc:  # noqa: BLE001
                raise self._wrap(retry_exc) from retry_exc
        except Exception as exc:  # noqa: BLE001
            raise self._wrap(exc) from exc

        self.usage["requests"] += 1
        if stream:
            return self._stream_iter(response)
        self._record_usage(getattr(response, "usage", None))
        return response

    def _complete(
        self,
        prompt: str,
        *,
        temperature: float,
        progress_callback: Callable[[str], None] | None = None,
        clean: bool = True,
    ) -> str:
        params: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": MAX_TOKENS,
            "temperature": temperature,
        }
        if progress_callback:
            text = self._handle_stream(self._create(params, stream=True), progress_callback)
        else:
            response = self._create(params)
            text = response.choices[0].message.content or ""
        return self.clean_code(text) if clean else text

    def _handle_stream(self, stream: Any, progress_callback: Callable[[str], None]) -> str:
        chunks: list[str] = []
        for chunk in stream:
            if not getattr(chunk, "choices", None):
                continue
            text = getattr(chunk.choices[0].delta, "content", None)
            if text:
                chunks.append(text)
                progress_callback(text)
        return "".join(chunks)

    def chat_completion(
        self,
        *,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        tool_choice: Any | None = None,
        max_tokens: int = 8192,
        temperature: float | None = None,
        stream: bool = False,
    ) -> Any:
        """Run a tool-capable chat completion, recording usage and wrapping errors."""
        params: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": self.temperature if temperature is None else temperature,
        }
        if tools:
            params["tools"] = tools
            if tool_choice:
                params["tool_choice"] = tool_choice
        return self._create(params, stream=stream)

    # --- LLMProvider interface -------------------------------------------

    def generate_widget_code(
        self,
        description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Generate widget code from a description."""
        prompt = self._build_prompt(description, data_info)
        return self._complete(
            prompt,
            temperature=self.temperature,
            progress_callback=progress_callback,
        )

    def revise_widget_code(
        self,
        current_code: str,
        revision_description: str,
        data_info: dict[str, Any],
        base_code: str | None = None,
        base_components: list[str] | None = None,
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Revise existing widget code."""
        prompt = self._build_revision_prompt(
            current_code,
            revision_description,
            data_info,
            base_code=base_code,
            base_components=base_components,
        )
        return self._complete(
            prompt,
            temperature=self.temperature,
            progress_callback=progress_callback,
        )

    def fix_code_error(
        self,
        broken_code: str,
        error_message: str,
        data_info: dict[str, Any],
    ) -> str:
        """Fix errors in widget code."""
        prompt = self._build_fix_prompt(broken_code, error_message, data_info)
        return self._complete(prompt, temperature=0.3)

    def generate_audit_report(
        self,
        code: str,
        description: str,
        data_info: dict[str, Any],
        level: str,
        changed_lines: list[int] | None = None,
    ) -> str:
        """Generate an audit report for widget code."""
        prompt = self._build_audit_prompt(
            code=code,
            description=description,
            data_info=data_info,
            level=level,
            changed_lines=changed_lines,
        )
        return self._complete(prompt, temperature=0.2, clean=False)

    def generate_text(
        self,
        prompt: str,
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Generate plain text from a prompt."""
        return self._complete(
            prompt,
            temperature=0.4,
            progress_callback=progress_callback,
            clean=False,
        ).strip()
