"""``vibe.host/1`` packet envelope, methods, and validation.

This is the wire protocol between a headless :class:`~vibe_widget.core.widget.
VibeWidget` (driven by :class:`~vibe_widget.hosts.bridge.HostSession`) and any
non-Jupyter frontend host: a WebSocket-connected browser page, a static HTML
snapshot, or a future subprocess sidecar. It intentionally mirrors the
envelope shape of vibe-next's ``vibe.transport/1`` (session/sender/
senderSequence/rpc, JSON-RPC 2.0 inside) so that a later move onto that
runtime is a transport swap, not a protocol redesign.

Validation matters here beyond correctness: this protocol is the boundary
between an R/Python process and a browser tab that could, in principle, be
pointed at by anything on the user's machine. Every packet arriving at the
host is validated before it is allowed to touch the widget - malformed,
oversized, or session-mismatched packets are rejected, not best-effort
parsed.
"""

from __future__ import annotations

import re
from typing import Any

PROTOCOL = "vibe.host/1"

# ---------------------------------------------------------------------------
# Methods
# ---------------------------------------------------------------------------

HELLO = "client.hello"
SNAPSHOT = "state.snapshot"
PATCH = "state.patch"
SET = "state.set"
CUSTOM_SEND = "custom.send"
CUSTOM_MSG = "custom.msg"
DISCONNECTED = "session.disconnected"
CLOSE = "vibe.close"

METHODS = frozenset(
    {HELLO, SNAPSHOT, PATCH, SET, CUSTOM_SEND, CUSTOM_MSG, DISCONNECTED, CLOSE}
)

# ---------------------------------------------------------------------------
# Error codes
# ---------------------------------------------------------------------------

ERR_INVALID_PACKET = "INVALID_PACKET"
ERR_INVALID_REQUEST = "INVALID_REQUEST"
ERR_UNAUTHORIZED = "UNAUTHORIZED"
ERR_SESSION_MISMATCH = "SESSION_MISMATCH"
ERR_UNKNOWN_METHOD = "UNKNOWN_METHOD"
ERR_UNKNOWN_TRAIT = "UNKNOWN_TRAIT"
ERR_PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE"
ERR_TRANSPORT_CLOSED = "TRANSPORT_CLOSED"
ERR_INTERNAL = "INTERNAL"

# ---------------------------------------------------------------------------
# Budgets (defense in depth against a misbehaving or hostile client)
# ---------------------------------------------------------------------------

# A single inbound text frame larger than this is rejected before JSON
# parsing even begins. Chosen well above any legitimate state.set payload
# (widget state is small; bulk data lives in the `data` trait which is
# itself row-guarded elsewhere) but far below a value that could meaningfully
# stall the event loop parsing it.
MAX_FRAME_BYTES = 8 * 1024 * 1024
# Sessions are opaque tokens minted by the host; this only bounds absurd
# input before any comparison is attempted.
MAX_SESSION_LEN = 128
MAX_SENDER_LEN = 64


class ProtocolError(ValueError):
    """Raised when a packet fails validation. Carries a stable `code`."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def packet(*, session: str, sender: str, sender_sequence: int, rpc: dict[str, Any]) -> dict[str, Any]:
    """Build a ``vibe.host/1`` envelope around one JSON-RPC message."""
    return {
        "protocol": PROTOCOL,
        "session": session,
        "sender": sender,
        "senderSequence": sender_sequence,
        "rpc": rpc,
    }


def request(method: str, params: dict[str, Any] | None, id_: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "method": method, "params": params or {}, "id": id_}


def notification(method: str, params: dict[str, Any] | None) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "method": method, "params": params or {}}


def response(id_: str, result: dict[str, Any] | None) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": id_, "result": result if result is not None else {}}


def error_response(id_: str | None, code: str, message: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    err: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        err["data"] = data
    return {"jsonrpc": "2.0", "id": id_, "error": err}


_SESSION_RE = re.compile(r"^[A-Za-z0-9_-]{8,128}$")


def assert_packet(value: Any, *, expected_session: str | None = None) -> dict[str, Any]:
    """Validate a decoded JSON value as a well-formed ``vibe.host/1`` packet.

    Raises :class:`ProtocolError` (never a bare exception) on any failure, so
    callers can always turn a rejection into a structured error response
    instead of tearing down the connection or leaking a stack trace.
    """
    if not isinstance(value, dict):
        raise ProtocolError(ERR_INVALID_PACKET, "packet must be a JSON object")
    if value.get("protocol") != PROTOCOL:
        raise ProtocolError(ERR_INVALID_PACKET, f"unsupported protocol: {value.get('protocol')!r}")

    session = value.get("session")
    if not isinstance(session, str) or not _SESSION_RE.match(session):
        raise ProtocolError(ERR_INVALID_PACKET, "session must be an opaque token, 8-128 chars")
    if expected_session is not None and session != expected_session:
        raise ProtocolError(ERR_SESSION_MISMATCH, "session does not match this connection")

    sender = value.get("sender")
    if not isinstance(sender, str) or not (0 < len(sender) <= MAX_SENDER_LEN):
        raise ProtocolError(ERR_INVALID_PACKET, "sender must be a short non-empty string")

    seq = value.get("senderSequence")
    if not isinstance(seq, int) or isinstance(seq, bool) or seq <= 0:
        raise ProtocolError(ERR_INVALID_PACKET, "senderSequence must be a positive integer")

    rpc = value.get("rpc")
    if not isinstance(rpc, dict):
        raise ProtocolError(ERR_INVALID_PACKET, "rpc must be a JSON object")
    if rpc.get("jsonrpc") != "2.0":
        raise ProtocolError(ERR_INVALID_PACKET, "rpc.jsonrpc must be '2.0'")

    method = rpc.get("method")
    has_method = method is not None
    has_result_or_error = "result" in rpc or "error" in rpc
    if has_method:
        if method not in METHODS:
            raise ProtocolError(ERR_UNKNOWN_METHOD, f"unknown method: {method!r}")
        params = rpc.get("params")
        if params is not None and not isinstance(params, dict):
            raise ProtocolError(ERR_INVALID_REQUEST, "rpc.params must be an object")
    elif not has_result_or_error:
        raise ProtocolError(ERR_INVALID_REQUEST, "rpc must carry a method, a result, or an error")

    return value


def is_notification(rpc: dict[str, Any]) -> bool:
    return "method" in rpc and "id" not in rpc


def is_request(rpc: dict[str, Any]) -> bool:
    return "method" in rpc and "id" in rpc
