"""Destinations for trace events.

``LocalSink`` is always the first hop: events land on the participant's disk,
where they can read them, before any later sink uploads them.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Protocol


class TraceSink(Protocol):
    """Anything that accepts serialized trace events."""

    def write(self, event: dict[str, Any]) -> None:
        """Persist or forward one event."""
        ...

    def close(self) -> None:
        """Release resources; further writes may be ignored."""
        ...


class LocalSink:
    """Append events as JSON lines to ``<trace_dir>/<session_id>.jsonl``."""

    def __init__(self, trace_dir: Path, session_id: str):
        self.trace_dir = Path(trace_dir)
        self.path = self.trace_dir / f"{session_id}.jsonl"
        self._lock = threading.Lock()

    def write(self, event: dict[str, Any]) -> None:
        line = json.dumps(event, ensure_ascii=False, default=str)
        with self._lock:
            self.trace_dir.mkdir(parents=True, exist_ok=True)
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")

    def close(self) -> None:
        return None


class MemorySink:
    """Keep events in a list (tests and in-process inspection)."""

    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []
        self._lock = threading.Lock()

    def write(self, event: dict[str, Any]) -> None:
        with self._lock:
            self.events.append(event)

    def close(self) -> None:
        return None


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    """Read a trace log, skipping lines that are not valid JSON."""
    events: list[dict[str, Any]] = []
    try:
        lines = Path(path).read_text(encoding="utf-8").splitlines()
    except OSError:
        return events
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events
