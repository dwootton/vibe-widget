"""Process-wide trace recorder.

Core Vibe Widget announces events through ``vibe_widget.tracing``; starting a
recorder installs it as that hook's listener, and stopping removes it. Recording
never raises into widget code: a failing sink is logged and skipped.
"""

from __future__ import annotations

import platform
import sys
import threading
import uuid
from collections.abc import Iterable
from pathlib import Path
from typing import Any

try:
    from vibe_widget import tracing
except ImportError as exc:  # a vibe_widget release from before the hook existed
    raise ImportError(
        "vibe-widget-study needs a vibe_widget with the tracing hook "
        "(vibe_widget.tracing); upgrade vibe_widget."
    ) from exc
from vibe_widget.utils.logging import get_logger
from vibe_widget.utils.serialization import clean_for_json
from vibe_widget_study.events import DEFAULT_LOCAL_STREAMS, STREAMS, TraceEvent, stream_for_kind
from vibe_widget_study.sinks import LocalSink, TraceSink, read_jsonl

logger = get_logger(__name__)

TRACE_GITIGNORE = "# Study traces can contain prompts and code; never commit them.\n*\n"


def _client_version() -> str:
    try:
        from vibe_widget import __version__

        return f"py/{__version__}"
    except Exception:
        return "py/unknown"


def default_trace_dir() -> Path:
    """``<cwd>/.vibewidget/traces``, next to the widget store."""
    return Path.cwd() / ".vibewidget" / "traces"


class TraceRecorder:
    """Collects trace events for this kernel session and fans them out to sinks."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.session_id = uuid.uuid4().hex
        self.enabled = False
        self.streams: frozenset[str] = frozenset()
        self.trace_dir: Path | None = None
        self._sinks: list[TraceSink] = []
        self._counts: dict[str, int] = {}

    # ------------------------------------------------------------------
    # Control
    # ------------------------------------------------------------------

    def start(
        self,
        trace_dir: str | Path | None = None,
        *,
        streams: Iterable[str] | None = None,
        sinks: Iterable[TraceSink] = (),
    ) -> Path:
        """Start recording to a local JSONL log (plus any extra sinks).

        Args:
            trace_dir: Directory for the log. Defaults to ``.vibewidget/traces``.
            streams: Streams to record. Defaults to intents, code, errors, schema.
            sinks: Additional sinks that receive every recorded event.

        Returns:
            Path of this session's log file.
        """
        chosen = frozenset(streams) if streams is not None else DEFAULT_LOCAL_STREAMS
        unknown = chosen - set(STREAMS)
        if unknown:
            raise ValueError(f"Unknown trace streams: {sorted(unknown)}; expected {STREAMS}")
        if "intents" not in chosen:
            raise ValueError("The 'intents' stream is required: it anchors every trace.")

        directory = Path(trace_dir) if trace_dir is not None else default_trace_dir()
        directory.mkdir(parents=True, exist_ok=True)
        ignore = directory / ".gitignore"
        if not ignore.exists():
            try:
                ignore.write_text(TRACE_GITIGNORE, encoding="utf-8")
            except OSError:
                pass

        with self._lock:
            if self.enabled:
                self._close_sinks()
            local = LocalSink(directory, self.session_id)
            self._sinks = [local, *sinks]
            self.trace_dir = directory
            self.streams = chosen
            self.enabled = True
        tracing.set_listener(self._on_core_event)
        self.emit(
            "session.start",
            payload={
                "streams": sorted(chosen),
                "python": platform.python_version(),
                "platform": sys.platform,
            },
        )
        return local.path

    def stop(self) -> None:
        """Stop recording. The local log stays on disk."""
        if not self.enabled:
            return
        self.emit("session.stop", payload={"counts": dict(self._counts)})
        with self._lock:
            self.enabled = False
            self._close_sinks()
        if tracing.get_listener() == self._on_core_event:
            tracing.set_listener(None)

    def _on_core_event(self, kind: str, **fields: Any) -> None:
        """Listener installed into ``vibe_widget.tracing`` while recording."""
        self.emit(kind, **fields)

    def _close_sinks(self) -> None:
        for sink in self._sinks:
            try:
                sink.close()
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("Trace sink close failed: %s", exc)
        self._sinks = []

    # ------------------------------------------------------------------
    # Recording
    # ------------------------------------------------------------------

    def wants(self, stream: str) -> bool:
        """Whether events of ``stream`` would be recorded right now."""
        return self.enabled and stream in self.streams

    def emit(
        self,
        kind: str,
        *,
        payload: dict[str, Any] | None = None,
        lineage_id: str | None = None,
        version_id: str | None = None,
        parent_version_id: str | None = None,
    ) -> dict[str, Any] | None:
        """Record one event if recording is on and its stream is enabled.

        Returns:
            The serialized event, or ``None`` when it was not recorded.
        """
        if not self.enabled:
            return None
        try:
            stream = stream_for_kind(kind)
            if stream not in self.streams:
                return None
            event = TraceEvent(
                kind=kind,
                stream=stream,
                session_id=self.session_id,
                payload=clean_for_json(payload or {}),
                lineage_id=lineage_id,
                version_id=version_id,
                parent_version_id=parent_version_id,
                client_version=_client_version(),
            ).to_dict()
        except Exception as exc:
            logger.warning("Dropping trace event %s: %s", kind, exc)
            return None

        with self._lock:
            sinks = list(self._sinks)
            self._counts[kind] = self._counts.get(kind, 0) + 1
        for sink in sinks:
            try:
                sink.write(event)
            except Exception as exc:
                logger.warning("Trace sink %s failed: %s", type(sink).__name__, exc)
        return event

    # ------------------------------------------------------------------
    # Inspection
    # ------------------------------------------------------------------

    @property
    def log_path(self) -> Path | None:
        """This session's local log file, if recording has been started."""
        if self.trace_dir is None:
            return None
        return self.trace_dir / f"{self.session_id}.jsonl"

    def status(self) -> dict[str, Any]:
        """Summary of what is being recorded and where."""
        with self._lock:
            return {
                "recording": self.enabled,
                "session_id": self.session_id,
                "streams": sorted(self.streams),
                "log_path": str(self.log_path) if self.log_path else None,
                "counts": dict(self._counts),
            }

    def read_events(self, all_sessions: bool = False) -> list[dict[str, Any]]:
        """Read events back from the local log(s)."""
        if self.trace_dir is None:
            return []
        if not all_sessions:
            path = self.log_path
            return read_jsonl(path) if path else []
        events: list[dict[str, Any]] = []
        for path in sorted(self.trace_dir.glob("*.jsonl")):
            events.extend(read_jsonl(path))
        events.sort(key=lambda e: str(e.get("ts", "")))
        return events


recorder = TraceRecorder()
"""The process-wide recorder every widget reports to."""
