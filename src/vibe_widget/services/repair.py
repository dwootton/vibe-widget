"""Runtime repair service for Vibe Widgets."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from vibe_widget.llm.agentic import AgenticOrchestrator
from vibe_widget.utils.serialization import clean_for_json


@dataclass
class RepairResult:
    code: str
    applied: bool
    retryable: bool
    message: str


class RepairService:
    """Centralized runtime repair path for widget errors."""

    MAX_RETRIES = 2

    def __init__(self, orchestrator: AgenticOrchestrator, *, max_retries: int | None = None):
        self.orchestrator = orchestrator
        if max_retries is None:
            max_retries = self.MAX_RETRIES
        self.max_retries = max(0, int(max_retries))

    def fix_runtime_error(
        self,
        *,
        code: str,
        error_message: str,
        data_info: dict[str, Any],
        retry_count: int,
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> RepairResult:
        if not error_message:
            return RepairResult(code=code, applied=False, retryable=False, message="No error message to repair.")
        if retry_count >= self.max_retries:
            return RepairResult(code=code, applied=False, retryable=False, message="Max retry attempts reached.")

        try:
            try:
                fixed_code = self.orchestrator.fix_runtime_error(
                    code=code,
                    error_message=error_message,
                    data_info=clean_for_json(data_info),
                    progress_callback=progress_callback,
                )
            except TypeError:
                fixed_code = self.orchestrator.fix_runtime_error(
                    code=code,
                    error_message=error_message,
                    data_info=clean_for_json(data_info),
                )
        except Exception as exc:
            retryable = retry_count + 1 < self.max_retries
            return RepairResult(
                code=code,
                applied=False,
                retryable=retryable,
                message=f"Repair attempt failed: {exc}",
            )

        applied = fixed_code != code
        message = "Repair applied." if applied else "Repair produced no changes."
        return RepairResult(code=fixed_code, applied=applied, retryable=False, message=message)
