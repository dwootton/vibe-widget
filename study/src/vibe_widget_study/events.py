"""Intent artifact trace events.

One trace is the lineage of a widget: the intents a person expressed (create,
edits, approvals) paired with the artifacts (code versions) they produced, plus
errors and data context. Every event belongs to exactly one *stream*, which is
the unit a study participant consents to.
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

SCHEMA_VERSION = 1

STREAMS: tuple[str, ...] = ("intents", "code", "errors", "schema", "interactions", "replay")
"""Collection streams, in the order a consent card lists them."""

DEFAULT_LOCAL_STREAMS: frozenset[str] = frozenset({"intents", "code", "errors", "schema"})
"""Streams recorded locally unless the caller asks for others."""

_KIND_PREFIX_STREAMS: tuple[tuple[str, str], ...] = (
    ("session.", "intents"),
    ("intent.", "intents"),
    ("context.contract", "intents"),
    ("artifact.version", "intents"),
    ("artifact.code", "code"),
    ("error.", "errors"),
    ("context.schema", "schema"),
    ("interaction.", "interactions"),
    ("replay.", "replay"),
)


def stream_for_kind(kind: str) -> str:
    """Return the stream an event kind belongs to.

    Args:
        kind: Dotted event kind such as ``"intent.grab_edit"``.

    Returns:
        The stream name.

    Raises:
        ValueError: If the kind maps to no stream.
    """
    for prefix, stream in _KIND_PREFIX_STREAMS:
        if kind == prefix or kind.startswith(prefix):
            return stream
    raise ValueError(f"Unknown trace event kind: {kind!r}")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class TraceEvent:
    """A single trace event, serialized one per line in the local log."""

    kind: str
    session_id: str
    payload: dict[str, Any] = field(default_factory=dict)
    lineage_id: str | None = None
    version_id: str | None = None
    parent_version_id: str | None = None
    stream: str = ""
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    ts: str = field(default_factory=_now)
    client_version: str = ""
    schema_version: int = SCHEMA_VERSION

    def __post_init__(self) -> None:
        if not self.stream:
            self.stream = stream_for_kind(self.kind)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-ready dict."""
        return asdict(self)
