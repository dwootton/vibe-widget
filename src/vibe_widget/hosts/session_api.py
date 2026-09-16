"""The single Python surface an external host (R via reticulate, a test, a
static demo script) should call. Everything else in :mod:`vibe_widget.hosts`
is an implementation detail behind this module.

Design constraints that matter for reticulate specifically:

* Every function takes and returns only JSON-safe plain values (str, int,
  float, bool, None, list, dict) plus the single opaque :class:`Session`
  object, because those are exactly the types reticulate converts
  automatically and losslessly. Nothing here requires the R caller to know
  about traitlets, threads, or comms.
* Every :class:`Session` method is safe to call from whatever thread
  reticulate happens to run R callbacks on - they only ever reach the widget
  through :class:`~vibe_widget.hosts.bridge.HostSession`, which owns its own
  writer thread and serializes all inbound writes onto it.
* Nothing here ever calls into R. Streaming/observer support is pull-based
  (`Session.drain_events`) precisely so no Python thread needs a live R
  callback - R decides when it is idle enough to drain the queue (see
  `vw_observe`'s `later`-driven loop in the R package).
"""

from __future__ import annotations

import logging
import secrets
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import vibe_widget as vw
from vibe_widget.hosts.bridge import HostSession, HostSessionClosed
from vibe_widget.hosts import protocol

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = frozenset({"ready", "error", "blocked"})


class HostApiError(RuntimeError):
    """Raised for caller errors (unknown output/action name, etc.)."""


def _new_session_id() -> str:
    # 32 hex chars: well above protocol.py's 8-char minimum, effectively
    # unguessable, and safe to embed in a URL path or query string.
    return secrets.token_hex(16)


def describe_data(data: Any) -> str:
    """Description of a data.frame/DataFrame using the engine's own
    privacy-aware summarizer, for a host that wants to show the same
    profile the LLM sees without duplicating that logic (e.g. an R
    `print()` method).
    """
    from vibe_widget.utils.util import summarize_for_prompt

    return summarize_for_prompt(data)


@dataclass
class Session:
    """Handle returned by :func:`create_session` / :func:`load_session`.

    Thin and mostly delegating on purpose: real behavior lives in
    ``HostSession``/the widget; this just exposes it as small, individually
    callable, reticulate-friendly methods instead of one object graph R would
    have to reach through.
    """

    id: str
    bridge: HostSession
    engine_version: str = field(default_factory=lambda: getattr(vw, "__version__", "0.0.0"))

    # ---- status --------------------------------------------------------

    def status(self) -> str:
        return self.bridge.widget.status

    def code(self) -> str:
        return self.bridge.widget.code or ""

    def error_message(self) -> str:
        return self.bridge.widget.error_message or ""

    def is_terminal(self) -> bool:
        return self.bridge.widget.status in TERMINAL_STATUSES

    def wait(self, timeout: float = 120.0) -> str:
        """Block until generation reaches a terminal status, then return it."""
        self.bridge.wait_for(lambda w: w.status in TERMINAL_STATUSES, timeout=timeout)
        return self.bridge.widget.status

    # ---- outputs / inputs / actions -------------------------------------

    def output_names(self) -> list[str]:
        return sorted((self.bridge.widget._exports or {}).keys())

    def input_names(self) -> list[str]:
        return sorted((self.bridge.widget._imports or {}).keys())

    def action_names(self) -> list[str]:
        return sorted((self.bridge.widget._actions or {}).keys())

    def get_output(self, name: str) -> Any:
        if name not in (self.bridge.widget._exports or {}):
            raise HostApiError(f"Unknown output: {name!r}. Declared outputs: {self.output_names()}")
        handle = getattr(self.bridge.widget.outputs, name)
        return handle()

    def get_input(self, name: str) -> Any:
        if name not in (self.bridge.widget._imports or {}):
            raise HostApiError(f"Unknown input: {name!r}. Declared inputs: {self.input_names()}")
        return getattr(self.bridge.widget, name, None)

    def set_input(self, name: str, value: Any) -> None:
        if name not in (self.bridge.widget._imports or {}):
            raise HostApiError(f"Unknown input: {name!r}. Declared inputs: {self.input_names()}")
        self.bridge.apply_changes({name: value})

    def invoke_action(self, name: str, payload: dict[str, Any] | None = None) -> None:
        if name not in (self.bridge.widget._actions or {}):
            raise HostApiError(f"Unknown action: {name!r}. Declared actions: {self.action_names()}")

        def _call() -> None:
            action = getattr(self.bridge.widget.actions, name)
            action(**(payload or {}))

        self.bridge.invoke(_call)

    # ---- events (backs `vw_observe`) -------------------------------------

    def drain_events(self, block: bool = False, timeout: float | None = None) -> list[dict[str, Any]]:
        """Outbound events since the last drain: state patches, custom
        messages, and a final `closed` event. R's `vw_observe` polls this
        from a `later`-scheduled callback so it only runs when R is idle."""
        return self.bridge.drain_events(block=block, timeout=timeout)

    def snapshot(self) -> dict[str, Any]:
        return self.bridge.snapshot()

    # ---- edit / revise ---------------------------------------------------

    def edit(self, prompt: str, *, timeout: float = 120.0) -> str:
        """Whole-widget revision with no specific DOM target - the same
        mechanism as the notebook UI's "state prompt" (regenerate-in-place
        with a refinement, or repair-in-place when blocked/erroring). This
        is the right mapping for `vw_edit(w, prompt)`, which has no element
        to point at; grab-edit (below) is for a live browser session that
        does have one.
        """
        if not prompt or not prompt.strip():
            raise HostApiError("edit() requires a non-empty prompt")
        self.bridge.apply_changes({"state_prompt_request": {"prompt": prompt}})
        # `_on_state_prompt` clears the request synchronously and (for
        # ready/error/blocked widgets) sets status back to "generating"
        # before this call returns, so waiting for a terminal status again
        # is safe and does not race a stale "ready" from before the edit.
        self.bridge.wait_for(lambda w: w.status == "generating", timeout=5.0)
        self.wait(timeout=timeout)
        return self.bridge.widget.code or ""

    def grab_edit(self, element: dict[str, Any], prompt: str, *, timeout: float = 120.0) -> str:
        """Element-targeted revision, matching the browser's annotate-and-
        revise flow. `element` is the same descriptor the frontend builds in
        `AppWrapper/utils/dom.ts` (tag/classes/text/attributes/...)."""
        if not prompt or not prompt.strip():
            raise HostApiError("grab_edit() requires a non-empty prompt")
        request_id = secrets.token_hex(8)
        self.bridge.apply_changes(
            {"grab_edit_request": {"element": element, "prompt": prompt, "request_id": request_id}}
        )
        self.bridge.wait_for(lambda w: not w.grab_edit_request, timeout=timeout)
        return self.bridge.widget.code or ""

    # ---- persistence ------------------------------------------------------

    def save(self, path: str, *, include_inputs: bool = False) -> str:
        result = self.bridge.invoke(lambda: self.bridge.widget.save(path, include_inputs=include_inputs))
        return str(result)

    def save_html(self, path: str, *, max_rows: int = 500, inline_bundle: bool = True) -> str:
        from vibe_widget.hosts import static as static_module

        html = static_module.emit_html(self.bridge, max_rows=max_rows, inline_bundle=inline_bundle)
        out_path = Path(path)
        out_path.write_text(html, encoding="utf-8")
        return str(out_path)

    def approve(self) -> None:
        """Mark the currently-generated code approved under execution
        mode 'approve' (see `vw_config(execution=...)`)."""
        self.bridge.apply_changes({"execution_state": {**self.bridge.widget.execution_state, "approved": True}})

    def close(self, reason: str = "closed") -> None:
        self.bridge.close(reason)


def create_session(
    description: str,
    data: Any = None,
    *,
    outputs: dict[str, str] | None = None,
    inputs: dict[str, Any] | None = None,
    actions: dict[str, str] | None = None,
    theme: Any = None,
    model: str | None = None,
    cache: bool = True,
    wait: bool = False,
    wait_timeout: float = 120.0,
) -> Session:
    """Create a widget and immediately wrap it in a `HostSession`, with no
    Jupyter comm anywhere in the stack. Generation starts the moment the
    bridge is attached (the `frontend_ready` handshake a real browser client
    would perform on mount), running on a background thread so `drain_events`
    can stream progress while this call returns immediately (`wait=False`,
    the default) or blocks until a terminal status (`wait=True`, what a
    knitr/Quarto render wants).
    """
    if model is not None:
        # `vw.create()` has no per-call `model` parameter - model selection
        # is process-global via `vw.config(model=...)` (see `namespaces.py`).
        # Setting it here mirrors exactly what a Python caller would do
        # themselves; it is not session-scoped, and a host that needs
        # per-session model isolation must use a separate process.
        vw.config(model=model)
    handle = vw.create(
        description,
        data,
        outputs=outputs,
        inputs=inputs,
        actions=actions,
        theme=theme,
        display=False,
        cache=cache,
    )
    widget = getattr(handle, "_widget", None) or handle
    widget._generation_mode = "async"

    session = Session(id=_new_session_id(), bridge=HostSession(widget))
    # Mirrors the real handshake: the frontend sets `frontend_ready` on
    # mount, which is what `_on_frontend_ready` uses to start generation.
    widget.frontend_ready = True

    if wait:
        session.wait(timeout=wait_timeout)
    return session


def edit_session(
    source: Any,
    description: str,
    data: Any = None,
    *,
    outputs: dict[str, str] | None = None,
    inputs: dict[str, Any] | None = None,
    actions: dict[str, str] | None = None,
    theme: Any = None,
    cache: bool = True,
    wait: bool = False,
    wait_timeout: float = 120.0,
) -> Session:
    """`vw.edit(...)`-backed session creation: revise an existing widget
    (by `.vw` path, saved widget id, or another live `VibeWidget`) into a new
    one, wrapped the same way as `create_session`."""
    handle = vw.edit(
        description,
        source,
        data,
        outputs=outputs,
        inputs=inputs,
        actions=actions,
        theme=theme,
        display=False,
        cache=cache,
    )
    widget = getattr(handle, "_widget", None) or handle
    widget._generation_mode = "async"
    session = Session(id=_new_session_id(), bridge=HostSession(widget))
    widget.frontend_ready = True
    if wait:
        session.wait(timeout=wait_timeout)
    return session


def load_session(path: str, data: Any = None, *, approval: bool = True) -> Session:
    """`vw.load(...)`-backed session creation for a saved `.vw` bundle."""
    handle = vw.load(path, approval=approval, display=False)
    if handle is None:
        raise HostApiError(f"No widget could be loaded from {path!r}")
    widget = getattr(handle, "_widget", None) or handle
    if data is not None and widget.data != data:
        widget.data = data  # type: ignore[assignment]
    widget._generation_mode = "async"
    session = Session(id=_new_session_id(), bridge=HostSession(widget))
    return session


def engine_version() -> str:
    return getattr(vw, "__version__", "0.0.0")
