"""Code generation services for Vibe Widgets."""

from __future__ import annotations

from typing import Any, Callable
import threading

from vibe_widget.llm.agentic import AgenticOrchestrator
from vibe_widget.llm.providers.base import LLMProvider
from vibe_widget.utils.serialization import clean_for_json


class GenerationCancelled(Exception):
    """Raised when a generation run is cancelled or superseded."""


class GenerationService:
    """Generation runner with synchronous helpers and async orchestration."""

    MAX_RETRIES = 2

    def __init__(self, llm_provider: LLMProvider):
        self.llm_provider = llm_provider
        self.orchestrator = AgenticOrchestrator(provider=llm_provider)
        self._run_id = 0
        self._cancel_event: threading.Event | None = None
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()

    def cancel_generation(self) -> None:
        with self._lock:
            if self._cancel_event is not None:
                self._cancel_event.set()

    def start_generation_async(
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
        on_complete: Callable[[str], None] | None = None,
        on_error: Callable[[Exception], None] | None = None,
    ) -> int:
        with self._lock:
            self._run_id += 1
            run_id = self._run_id
            cancel_event = threading.Event()
            self._cancel_event = cancel_event

        thread = threading.Thread(
            target=self._generation_worker,
            args=(
                run_id,
                cancel_event,
                description,
                outputs,
                inputs,
                input_summaries,
                actions,
                action_params,
                base_code,
                base_components,
                theme_description,
                progress_callback,
                on_complete,
                on_error,
            ),
            daemon=True,
        )
        self._thread = thread
        thread.start()
        return run_id

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

    def _generation_worker(
        self,
        run_id: int,
        cancel_event: threading.Event,
        description: str,
        outputs: dict[str, str] | None,
        inputs: dict[str, Any] | None,
        input_summaries: dict[str, str] | None,
        actions: dict[str, str] | None,
        action_params: dict[str, dict[str, str] | None] | None,
        base_code: str | None,
        base_components: list[str] | None,
        theme_description: str | None,
        progress_callback: Callable[[str, str], None] | None,
        on_complete: Callable[[str], None] | None,
        on_error: Callable[[Exception], None] | None,
    ) -> None:
        def check_cancel() -> None:
            with self._lock:
                superseded = run_id != self._run_id
            if cancel_event.is_set() or superseded:
                raise GenerationCancelled()

        def handle_progress(event_type: str, message: str) -> None:
            check_cancel()
            if progress_callback:
                progress_callback(event_type, message)

        try:
            check_cancel()
            code, _ = self.generate(
                description=description,
                outputs=outputs,
                inputs=inputs,
                input_summaries=input_summaries,
                actions=actions,
                action_params=action_params,
                base_code=base_code,
                base_components=base_components,
                theme_description=theme_description,
                progress_callback=handle_progress,
            )
            check_cancel()
            if on_complete:
                on_complete(code)
        except GenerationCancelled:
            return
        except Exception as exc:
            if on_error:
                on_error(exc)
            else:
                raise

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
