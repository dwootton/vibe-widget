"""Runtime repair service for Vibe Widgets."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from vibe_widget.llm.agentic_agents import AgentSdkOrchestrator
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

    def __init__(self, orchestrator: AgentSdkOrchestrator, *, max_retries: int | None = None):
        self.orchestrator = orchestrator
        if max_retries is None:
            max_retries = self.MAX_RETRIES
        self.max_retries = max(0, int(max_retries))

    def build_error_context(
        self,
        *,
        error_message: str,
        widget_error: str = "",
        last_runtime_error: str = "",
        widget_logs: list[dict[str, Any]] | None = None,
        code_path: str | None = None,
        user_prompt: str | None = None,
    ) -> str:
        """Build a structured error context for repair."""
        sections = []
        base_error = error_message.strip() if error_message else ""
        if base_error:
            sections.append(f"Runtime error:\n{base_error}")
        if widget_error and widget_error.strip() and widget_error.strip() != base_error:
            sections.append(f"Widget error:\n{widget_error.strip()}")
        if last_runtime_error and last_runtime_error.strip() and last_runtime_error.strip() != base_error:
            sections.append(f"Last runtime error:\n{last_runtime_error.strip()}")
        if code_path:
            sections.append(f"Code file: {code_path}")
        if widget_logs:
            filtered = [
                entry
                for entry in widget_logs
                if entry and entry.get("level") in {"error", "warn"}
            ]
            if filtered:
                recent = filtered[-20:]
                log_lines = []
                for entry in recent:
                    message = entry.get("message", "")
                    if message:
                        log_lines.append(f"- {message}")
                if log_lines:
                    sections.append("Recent widget logs:\n" + "\n".join(log_lines))
        if user_prompt:
            sections.append(f"User note:\n{user_prompt.strip()}")
        return "\n\n".join(section for section in sections if section)

    def fix_runtime_error(
        self,
        *,
        code: str,
        error_message: str,
        data_info: dict[str, Any],
        retry_count: int,
        widget_error: str = "",
        last_runtime_error: str = "",
        widget_logs: list[dict[str, Any]] | None = None,
        code_path: str | None = None,
        user_prompt: str | None = None,
        progress_callback: Callable[[str, str], None] | None = None,
    ) -> RepairResult:
        if not error_message:
            return RepairResult(code=code, applied=False, retryable=False, message="No error message to repair.")
        if retry_count >= self.max_retries:
            return RepairResult(code=code, applied=False, retryable=False, message="Max retry attempts reached.")

        try:
            full_error = self.build_error_context(
                error_message=error_message,
                widget_error=widget_error,
                last_runtime_error=last_runtime_error,
                widget_logs=widget_logs,
                code_path=code_path,
                user_prompt=user_prompt,
            )
            fixed_code = self.orchestrator.fix_runtime_error(
                code=code,
                error_message=full_error,
                data_info=clean_for_json(data_info),
                progress_callback=progress_callback,
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
        if applied:
            message = "Repair applied."
            retryable = False
        else:
            # Allow retry when LLM produces no changes - next attempt may succeed
            message = "Repair produced no changes - will retry."
            retryable = retry_count + 1 < self.max_retries
        return RepairResult(code=fixed_code, applied=applied, retryable=retryable, message=message)
