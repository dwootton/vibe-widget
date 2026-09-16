"""Deterministic, offline stand-ins for LLM-backed generation.

Selected by setting the environment variable ``VIBE_PROVIDER=fake`` before a
widget is constructed. When enabled, ``core/widget.py`` builds a
:class:`FakeProvider` instead of ``OpenRouterProvider`` and installs a
:class:`FakeOrchestrator` on the widget's ``GenerationService`` instead of
``AgentSdkOrchestrator``. Every generate/revise/repair call then resolves
instantly, deterministically, and with zero network traffic or API cost.

This is the backbone of the host-bridge, R-package, and browser test suites:
none of them should ever depend on model behavior, an API key, or network
access, and all of them need generation to be scriptable (including
simulating a provider failure) rather than merely "successful."

Not selected by any default code path - a caller must opt in explicitly via
the environment variable, which keeps it impossible to accidentally ship a
fake-generated widget in production.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from vibe_widget.llm.providers.base import LLMProvider

# A minimal but real guest module in the gen-1 contract: default-exports a
# function invoked as `React.createElement(module.default, { model, React })`
# (see `AppWrapper/components/SandboxedRunner.js`'s mount call - the module
# receives exactly `model` and `React`, nothing else, and must use
# `React.createElement` or its own JSX/htm setup, not a host-provided `html`
# tag). This renders the `data` rows the widget was constructed with as a
# plain, clickable table using only `React.createElement`, so it needs no
# JSX transform and no additional runtime dependency.
#
# When an output name is known (see `_table_widget_code` below, used by
# `FakeOrchestrator.generate` when the caller declared at least one output),
# clicking a row calls `model.set(<output>, row); model.save_changes();` -
# the same two calls any real generated widget makes - so host-bridge and
# browser tests can exercise a genuine browser -> Python output round trip
# without hand-writing widget code for every test.
def _table_widget_code(output_name: str | None) -> str:
    on_click = (
        f'(row) => {{ model.set({output_name!r}, row); model.save_changes(); }}'
        if output_name
        else "undefined"
    )
    return f"""\
export default function FakeGeneratedWidget({{ model, React }}) {{
  const h = React.createElement;
  const rows = model.get("data") || [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const onRowClick = {on_click};
  return h(
    "div",
    {{ "data-vibe-fake-widget": true, style: {{ fontFamily: "sans-serif", fontSize: "13px" }} }},
    h(
      "table",
      {{ style: {{ borderCollapse: "collapse", width: "100%" }} }},
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          columns.map((c) =>
            h(
              "th",
              {{ key: c, style: {{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "4px 8px" }} }},
              c
            )
          )
        )
      ),
      h(
        "tbody",
        null,
        rows.map((row, i) =>
          h(
            "tr",
            {{
              key: i,
              "data-row-index": i,
              onClick: onRowClick ? () => onRowClick(row) : undefined,
              style: onRowClick ? {{ cursor: "pointer" }} : undefined,
            }},
            columns.map((c) => h("td", {{ key: c, style: {{ padding: "4px 8px" }} }}, String(row[c])))
          )
        )
      )
    )
  );
}}
"""


DEFAULT_WIDGET_CODE = _table_widget_code(None)


def fake_provider_enabled() -> bool:
    """Whether ``VIBE_PROVIDER=fake`` is set in the current environment."""
    return os.environ.get("VIBE_PROVIDER", "").strip().lower() == "fake"


class FakeProvider(LLMProvider):
    """Minimal ``LLMProvider`` implementation used only to satisfy the
    constructor pipeline in ``core/widget.py`` (which expects an
    ``LLMProvider`` instance to exist as ``self._llm_provider``). Actual
    generation never reaches these methods when a :class:`FakeOrchestrator`
    is installed - they exist as a safety net for any code path that calls
    the provider directly (e.g. a future text-only helper), and simply
    reflect the input back rather than perform any real work.
    """

    def __init__(self, model: str = "fake/offline", api_key: Optional[str] = None):
        self.model = model

    def generate_widget_code(
        self,
        description: str,
        data_info: dict[str, Any],
        progress_callback: Optional[Callable[[str], None]] = None,
    ) -> str:
        return DEFAULT_WIDGET_CODE

    def revise_widget_code(
        self,
        current_code: str,
        revision_description: str,
        data_info: dict[str, Any],
        base_code: Optional[str] = None,
        base_components: Optional[list[str]] = None,
        progress_callback: Optional[Callable[[str], None]] = None,
    ) -> str:
        return current_code

    def fix_code_error(
        self,
        broken_code: str,
        error_message: str,
        data_info: dict[str, Any],
    ) -> str:
        return broken_code

    def generate_audit_report(
        self,
        code: str,
        description: str,
        data_info: dict[str, Any],
        level: str,
        changed_lines: Optional[list[int]] = None,
    ) -> str:
        return "status: pass\nfindings: []\n"

    def generate_text(
        self,
        prompt: str,
        progress_callback: Optional[Callable[[str], None]] = None,
    ) -> str:
        return ""


@dataclass
class FakeStep:
    """One scripted progress event emitted before a scripted call resolves."""

    event_type: str = "step"
    message: str = "Generating"
    delay: float = 0.0


@dataclass
class FakeGeneration:
    """One scripted outcome for `generate` / `revise_code` / `fix_runtime_error`."""

    code: str = DEFAULT_WIDGET_CODE
    steps: list[FakeStep] = field(
        default_factory=lambda: [
            FakeStep(message="Analyzing data"),
            FakeStep(message="Writing widget code"),
        ]
    )
    error: Optional[Exception] = None


class FakeOrchestrator:
    """Drop-in replacement for ``AgentSdkOrchestrator``'s public surface.

    ``GenerationService.generate``/``.revise_code`` and ``RepairService.
    fix_runtime_error`` all delegate to an ``orchestrator`` object with
    exactly these three methods, so installing this in place of the real
    orchestrator (see ``GenerationService(..., orchestrator=...)``) bypasses
    the entire agentic loop - no tool calls, no streaming HTTP, no token
    accounting, no API key - while every other layer of the engine (widget
    traits, repair/retry bookkeeping, grab-edit plumbing, audit) runs
    unmodified against real, deterministic output.

    Behavior is scripted with FIFO queues (`queue_generation` /
    `queue_revision` / `queue_repair`); once a queue is empty it keeps
    returning its own last entry (or a safe default) rather than raising, so
    a widget that regenerates or is revised more times than a test queued for
    stays well-defined.
    """

    def __init__(self, *, default_code: str = DEFAULT_WIDGET_CODE):
        self._default_code = default_code
        self._generation_queue: list[FakeGeneration] = []
        self._revision_queue: list[FakeGeneration] = []
        self._repair_queue: list[FakeGeneration] = []
        # Every call this orchestrator has serviced, for test assertions
        # (e.g. "the repair loop was never entered").
        self.calls: list[dict[str, Any]] = []

    def queue_generation(self, gen: FakeGeneration) -> None:
        self._generation_queue.append(gen)

    def queue_revision(self, gen: FakeGeneration) -> None:
        self._revision_queue.append(gen)

    def queue_repair(self, gen: FakeGeneration) -> None:
        self._repair_queue.append(gen)

    @staticmethod
    def _next(queue_: list[FakeGeneration], default: FakeGeneration) -> FakeGeneration:
        if not queue_:
            return default
        # Once only one entry remains, keep returning it rather than
        # exhausting the queue, so repeated calls stay deterministic.
        return queue_.pop(0) if len(queue_) > 1 else queue_[0]

    @staticmethod
    def _run(gen: FakeGeneration, progress_callback: Optional[Callable[[str, str], None]]) -> str:
        for step in gen.steps:
            if step.delay:
                time.sleep(step.delay)
            if progress_callback:
                progress_callback(step.event_type, step.message)
        if gen.error is not None:
            raise gen.error
        return gen.code

    # ---- AgentSdkOrchestrator-compatible surface ---------------------------

    def generate(
        self,
        *,
        description: str,
        outputs: dict[str, str] | None = None,
        inputs: dict[str, Any] | None = None,
        input_summaries: dict[str, str] | None = None,
        actions: dict[str, str] | None = None,
        action_params: dict[str, Any] | None = None,
        base_code: str | None = None,
        base_components: list[str] | None = None,
        theme_description: str | None = None,
        progress_callback: Optional[Callable[[str, str], None]] = None,
        agent_run_config: Any = None,
    ) -> tuple[str, dict[str, Any]]:
        self.calls.append({"op": "generate", "description": description})
        # With nothing scripted, default to a table wired to the first
        # declared output (if any) rather than always the fully generic
        # table, so a caller doesn't have to hand-write widget code just to
        # exercise a browser -> Python output round trip in a test.
        default_code = self._default_code
        if default_code == DEFAULT_WIDGET_CODE and outputs:
            default_code = _table_widget_code(sorted(outputs)[0])
        gen = self._next(self._generation_queue, FakeGeneration(code=default_code))
        code = self._run(gen, progress_callback)
        return code, {"model": "fake/offline"}

    def revise_code(
        self,
        *,
        code: str,
        revision_request: str,
        data_info: dict[str, Any],
        progress_callback: Optional[Callable[[str, str], None]] = None,
        agent_run_config: Any = None,
    ) -> str:
        self.calls.append({"op": "revise_code", "revision_request": revision_request})
        # Default (nothing queued): a harmless no-op revision so callers can
        # verify the round trip completed without needing to script one.
        gen = self._next(self._revision_queue, FakeGeneration(code=code, steps=[]))
        return self._run(gen, progress_callback)

    def fix_runtime_error(
        self,
        *,
        code: str,
        error_message: str,
        data_info: dict[str, Any],
        progress_callback: Optional[Callable[[str, str], None]] = None,
    ) -> str:
        self.calls.append({"op": "fix_runtime_error", "error_message": error_message})
        gen = self._next(self._repair_queue, FakeGeneration(code=code, steps=[]))
        return self._run(gen, progress_callback)
