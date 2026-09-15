"""Provider for any OpenAI-compatible chat completions endpoint."""

from __future__ import annotations

import os
import re
import warnings
from collections.abc import Iterator
from typing import Any, Callable
from urllib.parse import urlparse

import openai
from openai import OpenAI

from vibe_widget.llm.providers.base import LLMProvider, ProviderError
from vibe_widget.utils.platform import is_emscripten

try:
    MAX_TOKENS = int(os.getenv("VIBE_MAX_TOKENS", "32768"))
except ValueError:
    MAX_TOKENS = 32768
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Hosts disagree about a few request parameters: newer OpenAI models reject
# `max_tokens` and want `max_completion_tokens`, Anthropic's OpenAI-compatible
# endpoint rejects `temperature` on its newest models, and some hosts reject
# `stream_options`. A rejected parameter is renamed when a replacement is known
# and dropped otherwise, then remembered so later requests to the same endpoint
# and model send the accepted shape straight away.
_PARAM_RENAMES = {"max_tokens": "max_completion_tokens"}
# Only these may be renamed or dropped. Anything else a server names in a 400 is
# a real request error and must surface, not be silently stripped.
_ADJUSTABLE_PARAMS = frozenset({"max_tokens", "temperature", "stream_options", "top_p"})
_PARAM_IN_MESSAGE = re.compile(r"[`'\"]([a-z][a-z0-9_]*)[`'\"]")
# ponytail: fixes are cached per endpoint and model for the life of the process
# and never expire, so a host that starts accepting a parameter again is only
# noticed after a restart. Add a TTL if that ever matters.
_PARAM_FIXES: dict[tuple[str, str], dict[str, str | None]] = {}
_MAX_PARAM_RETRIES = 4


def _rejected_param(exc: Exception, params: dict[str, Any]) -> str | None:
    """Name the adjustable request parameter a 400 response complained about, if any."""
    body = getattr(exc, "body", None)
    error = body.get("error") if isinstance(body, dict) else None
    error = error if isinstance(error, dict) else {}

    named = error.get("param")
    candidates = [named] if isinstance(named, str) else []
    candidates += _PARAM_IN_MESSAGE.findall(str(error.get("message") or exc))
    for candidate in candidates:
        if candidate in params and candidate in _ADJUSTABLE_PARAMS:
            return candidate
    return None

# Ordered most specific first: APITimeoutError subclasses APIConnectionError.
_ERROR_KINDS = (
    (openai.AuthenticationError, "auth"),
    (openai.PermissionDeniedError, "quota"),
    (openai.NotFoundError, "not_found"),
    (openai.RateLimitError, "rate_limit"),
    (openai.APITimeoutError, "timeout"),
    (openai.APIConnectionError, "connection"),
)


# A bad model id comes back as a 400, not a 404, and the phrasing varies by host.
_MODEL_NOT_FOUND = re.compile(
    r"not a valid model|model_not_found|does not exist|unknown model", re.IGNORECASE
)


def _server_message(exc: Exception) -> str:
    """Return the server's own error sentence, never the raw response body."""
    body = getattr(exc, "body", None)
    error = body.get("error") if isinstance(body, dict) else None
    message = error.get("message") if isinstance(error, dict) else None
    if message:
        return str(message)
    status = getattr(exc, "status_code", None)
    return f"HTTP {status}" if status else str(exc)


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
        self._param_fixes = _PARAM_FIXES.setdefault((self.base_url, model), {})

        resolved_key = api_key or self._api_key_from_env()
        if not resolved_key:
            from vibe_widget.config import NO_API_KEY_MESSAGE

            raise ProviderError(NO_API_KEY_MESSAGE, "auth")

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
        from vibe_widget.config import resolve_endpoint_from_env

        return resolve_endpoint_from_env(self.base_url)[0]

    # --- request plumbing -------------------------------------------------

    def _wrap(self, exc: Exception) -> ProviderError:
        """Translate an openai SDK exception into a ProviderError with a fix hint."""
        if _is_context_length(exc):
            return ProviderError(self._message_for("context_length"), "context_length")
        for exc_type, kind in _ERROR_KINDS:
            if isinstance(exc, exc_type):
                # A 403 says what the limit is and where to manage it; nothing to add.
                if kind == "quota":
                    return ProviderError(_server_message(exc), kind)
                return ProviderError(self._message_for(kind), kind)
        detail = _server_message(exc)
        if _MODEL_NOT_FOUND.search(detail):
            return ProviderError(self._message_for("not_found"), "not_found")
        return ProviderError(f"Request to {self.host} failed: {detail}", "other")

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

    def _apply_param_fixes(self, params: dict[str, Any]) -> dict[str, Any]:
        """Rename or drop the parameters this endpoint and model have already rejected."""
        for name, replacement in self._param_fixes.items():
            if name in params:
                value = params.pop(name)
                if replacement:
                    params[replacement] = value
        return params

    def _create(self, params: dict[str, Any], *, stream: bool = False) -> Any:
        """Call the chat completions API, adapting to parameters the host rejects."""
        if stream:
            params = dict(params, stream=True, stream_options={"include_usage": True})

        for _ in range(_MAX_PARAM_RETRIES):
            attempt = self._apply_param_fixes(dict(params))
            try:
                response = self.client.chat.completions.create(**attempt)
            except openai.BadRequestError as exc:
                rejected = None if _is_context_length(exc) else _rejected_param(exc, attempt)
                if rejected is None and "stream_options" in attempt:
                    # A host that refuses a streamed request without naming the
                    # parameter is most often refusing stream_options.
                    rejected = "stream_options"
                if rejected is None or rejected in self._param_fixes:
                    raise self._wrap(exc) from exc
                replacement = _PARAM_RENAMES.get(rejected)
                # stream_options is ours, not the user's, so dropping it is silent.
                if replacement is None and rejected != "stream_options":
                    warnings.warn(
                        f"{self.host} rejected {rejected!r} for {self.model}; "
                        f"dropping it from every request to this model.",
                        stacklevel=2,
                    )
                self._param_fixes[rejected] = replacement
                continue
            except Exception as exc:  # noqa: BLE001
                raise self._wrap(exc) from exc

            self.usage["requests"] += 1
            if stream:
                return self._stream_iter(response)
            self._record_usage(getattr(response, "usage", None))
            return response

        raise ProviderError(
            f"{self.host} rejected every request parameter combination tried for "
            f"{self.model}; check the model name with vw.models().",
            "other",
        )

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
