"""Intent artifact traces for vis research studies (``pip install vibe-widget-study``).

Recording is off until ``start()``. It writes this kernel session's trace to
``.vibewidget/traces/<session>.jsonl``; nothing leaves the machine. Study join
codes, consent and upload build on this local log.

Example:
    >>> import vibe_widget as vw
    >>> import vibe_widget_study as study    # or vw.study
    >>> study.start()
    >>> w = vw.create("scatter of x vs y", df)
    >>> study.events()          # DataFrame of what was recorded
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path
from typing import Any

from vibe_widget_study.events import STREAMS, TraceEvent, stream_for_kind
from vibe_widget_study.recorder import TraceRecorder, recorder
from vibe_widget_study.sinks import LocalSink, MemorySink, TraceSink

__all__ = [
    "STREAMS",
    "LocalSink",
    "MemorySink",
    "TraceEvent",
    "TraceRecorder",
    "TraceSink",
    "events",
    "recorder",
    "start",
    "status",
    "stop",
    "stream_for_kind",
]


def start(
    trace_dir: str | Path | None = None,
    *,
    streams: Iterable[str] | None = None,
) -> Path:
    """Start recording intent artifact traces locally.

    Args:
        trace_dir: Where to write the log. Defaults to ``.vibewidget/traces``.
        streams: Which streams to record (``intents`` is always required).
            Defaults to intents, code, errors and schema.

    Returns:
        Path of this session's JSONL log.
    """
    return recorder.start(trace_dir, streams=streams)


def stop() -> None:
    """Stop recording. Already-written events stay on disk."""
    recorder.stop()


def status() -> dict[str, Any]:
    """What is being recorded, for which session, and where."""
    return recorder.status()


def events(all_sessions: bool = False, as_frame: bool = True) -> Any:
    """Read recorded events back from the local log.

    Args:
        all_sessions: Include every session in the trace directory.
        as_frame: Return a pandas DataFrame (default) instead of a list of dicts.

    Returns:
        A DataFrame with one row per event, or a list of dicts.
    """
    rows = recorder.read_events(all_sessions=all_sessions)
    if not as_frame:
        return rows
    import pandas as pd

    columns = [
        "ts", "kind", "stream", "lineage_id", "version_id", "parent_version_id",
        "payload", "session_id", "id", "client_version", "schema_version",
    ]
    return pd.DataFrame(rows, columns=columns)
