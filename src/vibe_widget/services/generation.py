"""Code generation services for Vibe Widgets."""

from __future__ import annotations

from typing import Any, Callable

from vibe_widget.llm.agentic import AgenticOrchestrator
from vibe_widget.llm.providers.base import LLMProvider
from vibe_widget.utils.serialization import clean_for_json


class GenerationService:
    """Thin wrapper around the agentic orchestrator."""

    MAX_RETRIES = 2

    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider
        self.orchestrator = AgenticOrchestrator(provider=llm_provider)

    def generate(
        self,
        *,
        description: str,
        outputs: dict[str, str] | None,
        inputs: dict[str, Any] | None,
        input_summaries: dict[str, str] | None,
        actions: dict[str, str] | None,
        action_params: dict[str, dict[str, str] | None] | None,
        base_code: str | None,
        base_components: list[str] | None,
        theme_description: str | None,
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> tuple[str, dict[str, Any]]:
        """Generate widget code via the LLM."""
        return self.orchestrator.generate(
            description=description,
            outputs=outputs,
            inputs=inputs,
            input_summaries=input_summaries,
            actions=actions,
            action_params=action_params,
            base_code=base_code,
            base_components=base_components,
            theme_description=theme_description,
            progress_callback=progress_callback,
        )

    def fix_runtime_error(
        self,
        *,
        code: str,
        error_message: str,
        data_info: dict[str, Any],
        retry_count: int,
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> tuple[str, bool]:
        """Attempt to fix runtime errors with bounded retries."""
        if not error_message or retry_count >= self.MAX_RETRIES:
            return code, False
        try:
            fixed_code = self.orchestrator.fix_runtime_error(
                code=code,
                error_message=error_message,
                data_info=clean_for_json(data_info),
                progress_callback=progress_callback,
            )
            return fixed_code, False
        except Exception:
            return code, retry_count + 1 < self.MAX_RETRIES

    def revise_code(
        self,
        *,
        code: str,
        revision_request: str,
        data_info: dict[str, Any],
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> str:
        """Apply revision requests to existing code."""
        return self.orchestrator.revise_code(
            code=code,
            revision_request=revision_request,
            data_info=clean_for_json(data_info),
            progress_callback=progress_callback,
        )
