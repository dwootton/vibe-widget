"""OpenRouter provider implementation (OpenAI-compatible client)."""

import os
from typing import Any, Callable

from openai import OpenAI

from vibe_widget.llm.providers.base import LLMProvider

MAX_TOKENS = 20000

class OpenRouterProvider(LLMProvider):
    """LLM provider that routes all traffic through OpenRouter."""

    def __init__(
        self,
        model: str,
        api_key: str | None = None,
        site_url: str | None = None,
        app_title: str | None = None,
    ):
        """
        Initialize OpenRouter provider.
        
        Args:
            model: Model name or shortcut (resolved by Config/manifest)
            api_key: Optional API key (otherwise uses environment)
            site_url: Optional HTTP referer header for OpenRouter analytics
            app_title: Optional X-Title header for OpenRouter analytics
        """
        self.model = model

        api_key = api_key or os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError(
                "OpenRouter API key required. Set OPENROUTER_API_KEY or pass api_key parameter."
            )

        default_headers = {}
        if site_url:
            default_headers["HTTP-Referer"] = site_url
        if app_title:
            default_headers["X-Title"] = app_title

        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            default_headers=default_headers or None,
        )

    def generate_widget_code(
        self,
        description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Generate widget code using the configured OpenRouter model."""
        prompt = self._build_prompt(description, data_info)
        completion_params = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": MAX_TOKENS,
            "temperature": 0.7,
        }

        try:
            if progress_callback:
                completion_params["stream"] = True
                stream = self.client.chat.completions.create(**completion_params)
                return self._handle_stream(stream, progress_callback)

            response = self.client.chat.completions.create(**completion_params)
            return self.clean_code(response.choices[0].message.content)
        except Exception as exc:  # noqa: BLE001
            if "context" in str(exc).lower() or "token" in str(exc).lower():
                return self._retry_with_shorter_prompt(description, data_info, progress_callback)
            raise

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
        
        completion_params = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": MAX_TOKENS,
            "temperature": 0.7,
        }

        if progress_callback:
            completion_params["stream"] = True
            stream = self.client.chat.completions.create(**completion_params)
            return self._handle_stream(stream, progress_callback)

        response = self.client.chat.completions.create(**completion_params)
        return self.clean_code(response.choices[0].message.content)

    def fix_code_error(
        self,
        broken_code: str,
        error_message: str,
        data_info: dict[str, Any],
    ) -> str:
        """Fix errors in widget code."""
        prompt = self._build_fix_prompt(broken_code, error_message, data_info)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=MAX_TOKENS,
            temperature=0.3,
        )
        return self.clean_code(response.choices[0].message.content)

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
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=MAX_TOKENS,
            temperature=0.2,
        )
        return response.choices[0].message.content

    def generate_text(
        self,
        prompt: str,
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Generate plain text from a prompt."""
        completion_params = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": MAX_TOKENS,
            "temperature": 0.4,
        }

        if progress_callback:
            completion_params["stream"] = True
            stream = self.client.chat.completions.create(**completion_params)
            return self._handle_stream(stream, progress_callback).strip()

        response = self.client.chat.completions.create(**completion_params)
        return (response.choices[0].message.content or "").strip()

    def _handle_stream(self, stream, progress_callback: Callable[[str], None]) -> str:
        """Handle streaming response."""
        code_chunks = []
        for chunk in stream:
            if chunk.choices[0].delta.content:
                text = chunk.choices[0].delta.content
                code_chunks.append(text)
                progress_callback(text)

        return self.clean_code("".join(code_chunks))

    def _retry_with_shorter_prompt(
        self,
        description: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str], None] | None = None,
    ) -> str:
        """Retry with a shorter prompt if context length exceeded."""
        reduced_info = data_info.copy()
        if "sample" in reduced_info:
            sample = reduced_info["sample"]
            if isinstance(sample, list) and len(sample) > 1:
                reduced_info["sample"] = sample[:1]

        prompt = self._build_prompt(description, reduced_info)
        completion_params = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 8192,
            "temperature": 0.7,
        }

        if progress_callback:
            completion_params["stream"] = True
            stream = self.client.chat.completions.create(**completion_params)
            return self._handle_stream(stream, progress_callback)

        response = self.client.chat.completions.create(**completion_params)
        return self.clean_code(response.choices[0].message.content)
