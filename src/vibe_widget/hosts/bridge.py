"""Drive a headless :class:`VibeWidget` from any non-Jupyter host.

:class:`HostSession` is the seam described in ``design/r-host-plan.md``
section 2.1: it wraps a ``VibeWidget`` constructed with ``display=False`` (so
its ``comm`` is ``anywidget``'s ``DummyComm``) and turns its traitlets/custom
message surface into two small, thread-safe primitives:

* ``drain_events()`` - a queue of outbound events (state patches, custom
  messages, close) any transport can forward to a client.
* ``apply_changes()`` / ``dispatch_custom()`` - inbound writes, always
  executed on one dedicated writer thread, so a caller never races the
  widget's own generation thread and a slow observer (grab-edit revision, an
  audit request) never blocks the caller longer than its own timeout.

Nothing here talks about WebSockets, HTTP, or R - :mod:`server` and
:mod:`static` build on this, and R never sees it directly (it calls
:mod:`session_api`, which itself calls this).
"""

from __future__ import annotations

import logging
import queue
import threading
import time
from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    from vibe_widget.core.widget import VibeWidget

logger = logging.getLogger(__name__)

# anywidget/ipywidgets framework plumbing that must never cross the host
# boundary. `_esm` in particular holds the multi-megabyte AppWrapper bundle
# text (verified ~4 MB) - the host serves that once as a static asset
# instead of re-embedding it in every snapshot/patch, which would make every
# session and every reconnect pay megabytes of avoidable traffic.
EXCLUDED_TRAITS: frozenset[str] = frozenset(
    {
        "_esm",
        "_css",
        "_anywidget_id",
        "_model_module",
        "_model_module_version",
        "_model_name",
        "_view_module",
        "_view_module_version",
        "_view_name",
        "_dom_classes",
        "_view_count",
        "layout",
        "tabbable",
        "tooltip",
    }
)

class HostSessionClosed(RuntimeError):
    """Raised when an operation is attempted on a closed HostSession."""


class HostSession:
    def __init__(self, widget: "VibeWidget", *, event_queue_size: int = 4096):
        self._widget = widget
        self._closed = False
        self._close_lock = threading.RLock()
        self._seq_lock = threading.Lock()
        self._seq = 0
        self._events: "queue.Queue[dict[str, Any]]" = queue.Queue(maxsize=event_queue_size)
        self._inbox: "queue.Queue[Callable[[], None] | None]" = queue.Queue()
        self._trait_names = self._syncable_trait_names(widget)

        # Capture outbound custom messages instead of trying to send them
        # over a (nonexistent) Jupyter comm. `AnyWidget.send` normally calls
        # `self.comm.send(...)`; DummyComm's send is a no-op, so overriding
        # the bound method here is both necessary (nothing would otherwise
        # deliver these messages anywhere) and safe (nothing else calls
        # `widget.send` expecting comm semantics).
        widget.send = self._on_widget_send  # type: ignore[method-assign]

        widget.observe(self._on_trait_change, names=list(self._trait_names))

        self._writer_thread = threading.Thread(
            target=self._writer_loop, name="vibe-host-writer", daemon=True
        )
        self._writer_thread.start()

    # ---- construction helpers ----------------------------------------------

    @staticmethod
    def _syncable_trait_names(widget: "VibeWidget") -> tuple[str, ...]:
        return tuple(sorted(name for name in widget.traits(sync=True) if name not in EXCLUDED_TRAITS))

    # ---- outbound: widget -> host consumer ---------------------------------

    def _on_widget_send(self, content: Any, buffers: Any = None) -> None:
        if buffers:
            logger.warning(
                "HostSession dropping unsupported binary buffers on outbound custom message %r",
                content.get("type") if isinstance(content, dict) else type(content).__name__,
            )
        self._publish({"kind": "custom", "content": content})

    def _on_trait_change(self, change: dict[str, Any]) -> None:
        name = change["name"]
        try:
            value = self._widget.get_state([name]).get(name)
        except Exception:
            logger.exception("HostSession failed to serialize trait %r for outbound patch", name)
            return
        self._publish({"kind": "patch", "changes": {name: value}})

    def _publish(self, event: dict[str, Any]) -> None:
        with self._seq_lock:
            self._seq += 1
            event = {**event, "seq": self._seq}
        try:
            self._events.put_nowait(event)
        except queue.Full:
            # A slow/disconnected consumer must never block widget threads
            # (including the generation worker). Drop and log loudly rather
            # than deadlock the engine; a reconnecting client re-syncs from
            # `snapshot()` regardless, so a dropped patch is recoverable.
            logger.error("HostSession event queue full (%s); dropping event kind=%s", self._events.maxsize, event.get("kind"))

    def drain_events(self, *, block: bool = False, timeout: float | None = None) -> list[dict[str, Any]]:
        """Return and remove all currently queued outbound events.

        With ``block=True`` this waits up to ``timeout`` seconds for at
        least one event before returning (an empty list on timeout),
        which is what a WebSocket send loop or an R polling call wants
        instead of busy-spinning on an empty queue.
        """
        events: list[dict[str, Any]] = []
        try:
            if block:
                events.append(self._events.get(timeout=timeout))
            while True:
                events.append(self._events.get_nowait())
        except queue.Empty:
            pass
        return events

    def snapshot(self) -> dict[str, Any]:
        """Full current state, safe to send to a newly-connected client."""
        return self._widget.get_state(list(self._trait_names))

    # ---- inbound: host consumer -> widget ----------------------------------

    def apply_changes(self, changes: dict[str, Any], *, timeout: float | None = 30.0) -> None:
        """Apply ``{trait: value}`` to the widget on the single writer thread.

        Blocks the caller up to ``timeout`` seconds, but always mutates the
        widget from the *same* background thread regardless of which thread
        called this - so concurrent callers (e.g. an R input write racing a
        browser client's own input write) are serialized rather than
        corrupting each other, and a slow observer this triggers (grab-edit
        revision, an audit request) runs off of the caller's thread.
        """
        if not changes:
            return
        unknown = [name for name in changes if name not in self._trait_names]
        if unknown:
            raise ValueError(f"Unknown or disallowed trait(s): {sorted(unknown)}")
        # No further write restriction: a real AnyWidget/Jupyter comm places
        # none either (the frontend legitimately writes `status`,
        # `widget_logs`, `error_message`, etc. directly as part of its own
        # runtime-error-capture -> repair-loop flow, over the live comm just
        # as much as over this one), and a widget-model boundary is not a
        # meaningful place to enforce per-field ownership. What *is*
        # enforced (loopback bind, per-session token, Origin allow-list) is
        # who can open a connection at all - see `server.py`.
        self._submit(lambda: self._apply_changes_on_writer(changes), timeout=timeout)

    def _apply_changes_on_writer(self, changes: dict[str, Any]) -> None:
        for name, value in changes.items():
            setattr(self._widget, name, value)

    def dispatch_custom(self, content: dict[str, Any], *, timeout: float | None = 30.0) -> None:
        """Deliver an inbound custom message, as if it arrived over a comm."""
        self._submit(lambda: self._widget._handle_custom_msg(self._widget, content, []), timeout=timeout)

    def invoke(self, fn: Callable[[], Any], *, timeout: float | None = 30.0) -> Any:
        """Run an arbitrary callable on the writer thread and return its result.

        Used by :mod:`session_api` for operations that read *and* write the
        widget (e.g. ``widget.save(path)``) and must not race trait writes.
        """
        box: dict[str, Any] = {}

        def _run() -> None:
            box["result"] = fn()

        self._submit(_run, timeout=timeout)
        return box.get("result")

    def _submit(self, job: Callable[[], None], *, timeout: float | None) -> None:
        if self._closed:
            raise HostSessionClosed("HostSession is closed")
        done = threading.Event()
        box: dict[str, BaseException | None] = {"exc": None}

        def _run() -> None:
            try:
                job()
            except BaseException as exc:  # noqa: BLE001 - re-raised on the caller's thread
                box["exc"] = exc
            finally:
                done.set()

        self._inbox.put(_run)
        if not done.wait(timeout=timeout):
            raise TimeoutError(f"HostSession writer did not complete within {timeout}s")
        if box["exc"] is not None:
            raise box["exc"]

    def _writer_loop(self) -> None:
        while True:
            job = self._inbox.get()
            if job is None:
                return
            job()

    # ---- lifecycle ----------------------------------------------------------

    def wait_for(
        self,
        predicate: Callable[["VibeWidget"], bool],
        *,
        timeout: float = 120.0,
        poll_interval: float = 0.05,
    ) -> bool:
        """Block the calling thread until ``predicate(widget)`` is true.

        Polling (rather than an event-driven wait) is deliberate: predicates
        are arbitrary and cheap (``widget.status in {...}``), and this keeps
        the implementation trivially correct under concurrent trait writes
        from the generation thread, instead of trying to wire a condition
        variable through every trait that might matter to a predicate.
        """
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if predicate(self._widget):
                return True
            time.sleep(poll_interval)
        return predicate(self._widget)

    def close(self, reason: str = "closed") -> None:
        with self._close_lock:
            if self._closed:
                return
            self._closed = True
        try:
            self._widget.unobserve(self._on_trait_change, names=list(self._trait_names))
        except Exception:
            logger.exception("HostSession failed to unobserve traits during close")
        self._publish({"kind": "closed", "reason": reason})
        self._inbox.put(None)

    @property
    def closed(self) -> bool:
        return self._closed

    @property
    def widget(self) -> "VibeWidget":
        return self._widget

    @property
    def trait_names(self) -> tuple[str, ...]:
        return self._trait_names
