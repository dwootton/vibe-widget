"""A loopback-only WebSocket + HTTP server that lets a browser tab drive a
:class:`~vibe_widget.hosts.bridge.HostSession`.

This is the "sidecar in Python threads, not in R" half of the architecture
in ``design/r-host-plan.md``: it runs its asyncio event loop on one daemon
thread per process, independent of whatever R (or any other caller) is
doing, so a slow or blocking R prompt never stalls a live generation stream
and a live generation stream never requires R to pump an event loop.

Security posture (this is a local development/authoring tool, but it does
bind a socket, so it is treated like one):

* Binds to ``127.0.0.1`` only - never ``0.0.0.0`` - so nothing outside the
  machine can reach it, regardless of firewall configuration.
* One random, unguessable token is minted at server start and required on
  every session's ``client.hello``; without it, a page from another origin
  that happens to guess a port cannot attach to a session.
* The WebSocket handshake's ``Origin`` header is checked against an
  allow-list (loopback origins, VS Code/Positron webview origins, and
  ``null`` for a ``file://`` static page) before the upgrade completes.
* Every inbound frame is size-capped and protocol-validated
  (:mod:`vibe_widget.hosts.protocol`) before it is allowed to touch a widget.
* Sessions are isolated: a connection is bound to exactly one session id at
  ``client.hello`` time and every subsequent packet's ``session`` field must
  match, so one compromised tab cannot address another session by guessing
  its id.
"""

from __future__ import annotations

import asyncio
import functools
import json
import logging
import secrets
import threading
from pathlib import Path
from typing import Any

from vibe_widget.hosts import protocol
from vibe_widget.hosts.bridge import HostSession, HostSessionClosed

logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).resolve().parent / "static"
HOST_BUNDLE_PATH = STATIC_DIR / "vibewidget-host.js"

# Origins allowed to complete the WebSocket upgrade. `null` covers a page
# opened from `file://` (a saved static export opened locally) and a
# sandboxed webview with an opaque origin; loopback covers a page served by
# this very server; VS Code/Positron webviews use a `vscode-webview://`
# scheme with a per-window random host, so that scheme is allowed broadly
# rather than by exact origin (still same-machine-only, since the server
# itself is loopback-bound).
_ALLOWED_ORIGIN_PREFIXES = (
    "http://127.0.0.1:",
    "http://localhost:",
    "vscode-webview://",
)
_ALLOWED_ORIGINS_EXACT = {"null"}


def _origin_allowed(origin: str | None) -> bool:
    if origin is None:
        # Some non-browser clients (a Python test client, `curl`) send no
        # Origin header at all; that's fine since Origin enforcement exists
        # to stop an *unrelated web page* from opening a cross-origin
        # WebSocket to this server, which requires a browser context.
        return True
    if origin in _ALLOWED_ORIGINS_EXACT:
        return True
    return any(origin.startswith(prefix) for prefix in _ALLOWED_ORIGIN_PREFIXES)


class LocalHostServer:
    """One process-wide loopback server multiplexing many sessions by path.

    Each :class:`HostSession` is registered under a random session id and
    reachable at ``ws://127.0.0.1:<port>/ws/<session_id>``. The server also
    serves the host JS bundle and a minimal HTML page per session, so a
    browser (or R via ``utils::browseURL``/the RStudio/Positron Viewer) can
    be pointed at ``http://127.0.0.1:<port>/w/<session_id>`` with nothing
    else required.
    """

    def __init__(self, *, host: str = "127.0.0.1", port: int = 0):
        self._host = host
        self._requested_port = port
        self._sessions: dict[str, HostSession] = {}
        self._tokens: dict[str, str] = {}
        self._lock = threading.RLock()

        self._loop: asyncio.AbstractEventLoop | None = None
        self._server = None
        self._started = threading.Event()
        self._actual_port: int | None = None
        self._thread = threading.Thread(target=self._run_loop, name="vibe-host-server", daemon=True)
        self._thread.start()
        if not self._started.wait(timeout=10.0):
            raise RuntimeError("LocalHostServer failed to start within 10s")

    # ---- lifecycle -----------------------------------------------------

    def _run_loop(self) -> None:
        import websockets

        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        async def _serve() -> None:
            self._server = await websockets.serve(
                self._handle_connection,
                self._host,
                self._requested_port,
                process_request=self._process_http_request,
                max_size=protocol.MAX_FRAME_BYTES,
                # Origin is enforced ourselves in `_process_http_request` (a
                # prefix-based allow-list, not the exact-match list
                # `origins=` supports), so it is deliberately left unset here.
            )
            sock = self._server.sockets[0]
            self._actual_port = sock.getsockname()[1]
            self._started.set()
            await self._server.wait_closed()

        try:
            self._loop.run_until_complete(_serve())
        except Exception:
            logger.exception("LocalHostServer event loop crashed")
            self._started.set()  # unblock the constructor with actual_port=None -> caller sees the failure
        finally:
            self._loop.close()

    def stop(self) -> None:
        if self._loop is None or self._server is None:
            return

        def _close() -> None:
            self._server.close()

        self._loop.call_soon_threadsafe(_close)

    @property
    def port(self) -> int:
        if self._actual_port is None:
            raise RuntimeError("LocalHostServer did not start successfully")
        return self._actual_port

    @property
    def url(self) -> str:
        return f"http://{self._host}:{self.port}"

    @property
    def ws_url(self) -> str:
        return f"ws://{self._host}:{self.port}"

    # ---- session registry ------------------------------------------------

    def register(self, session: HostSession, *, session_id: str) -> str:
        """Register `session` and return the per-session auth token."""
        token = secrets.token_urlsafe(24)
        with self._lock:
            self._sessions[session_id] = session
            self._tokens[session_id] = token
        return token

    def unregister(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)
            self._tokens.pop(session_id, None)

    def page_url(self, session_id: str) -> str:
        return f"{self.url}/w/{session_id}"

    # ---- HTTP (bundle + per-session page) ---------------------------------

    async def _process_http_request(self, connection, request):
        # websockets >=13 passes a `ServerConnection`/request pair; only
        # handle plain GETs here, anything else (or a WS upgrade request)
        # falls through by returning None.
        path = request.path
        is_upgrade = "Upgrade" in request.headers.get("Connection", "") or request.headers.get("Upgrade")
        if is_upgrade:
            # Origin is enforced here - during the HTTP upgrade, before any
            # WebSocket connection exists - rather than in `_handle_connection`
            # after the fact, so a disallowed origin never completes a
            # handshake at all (the client sees a rejected upgrade, not a
            # connection that opens and is then closed).
            origin = request.headers.get("Origin")
            if not _origin_allowed(origin):
                return self._http_response(403, b"origin not allowed", "text/plain")
            return None  # let it proceed to the WebSocket handler

        if path == "/health":
            return self._http_response(200, b"ok", "text/plain")
        if path == "/assets/vibewidget-host.js":
            if not HOST_BUNDLE_PATH.exists():
                return self._http_response(500, b"host bundle not built", "text/plain")
            body = HOST_BUNDLE_PATH.read_bytes()
            return self._http_response(200, body, "application/javascript")
        if path.startswith("/w/"):
            session_id = path[len("/w/") :]
            with self._lock:
                exists = session_id in self._sessions
                token = self._tokens.get(session_id)
            if not exists:
                return self._http_response(404, b"unknown session", "text/plain")
            from vibe_widget.hosts.static import live_page_html

            body = live_page_html(session_id=session_id, token=token, ws_url=self.ws_url).encode("utf-8")
            return self._http_response(200, body, "text/html; charset=utf-8")
        return self._http_response(404, b"not found", "text/plain")

    @staticmethod
    def _http_response(status: int, body: bytes, content_type: str):
        import websockets

        reason = {200: "OK", 403: "Forbidden", 404: "Not Found", 500: "Internal Server Error"}.get(status, "")
        headers = websockets.datastructures.Headers(
            [("Content-Type", content_type), ("Content-Length", str(len(body))), ("Cache-Control", "no-store")]
        )
        return websockets.http11.Response(status, reason, headers, body)

    # ---- WebSocket handling -------------------------------------------------

    async def _handle_connection(self, ws) -> None:
        # Origin is already enforced in `_process_http_request`, before the
        # handshake completes; a connection reaching here has an allowed
        # origin (or none, e.g. a non-browser test client) by construction.
        session_id: str | None = None
        host_seq = 0
        # Last `senderSequence` accepted from each sender on *this*
        # connection. A WebSocket connection preserves frame order, so this
        # is not reordering protection so much as a cheap, explicit guard
        # against a buggy or malicious client replaying/duplicating a frame:
        # `assert_packet` requires a positive integer, but does not by
        # itself require it to be new.
        last_seq_by_sender: dict[str, int] = {}
        drain_task: asyncio.Task | None = None

        try:
            async for raw in ws:
                if isinstance(raw, bytes) and len(raw) > protocol.MAX_FRAME_BYTES:
                    await ws.close(code=1009, reason="frame too large")
                    return
                try:
                    value = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    await self._send_error(ws, None, "?", protocol.ERR_INVALID_PACKET, "invalid JSON")
                    continue

                try:
                    packet = protocol.assert_packet(value, expected_session=session_id)
                except protocol.ProtocolError as exc:
                    await self._send_error(ws, session_id, value.get("session", "?") if isinstance(value, dict) else "?", exc.code, exc.message)
                    continue

                sender = packet["sender"]
                incoming_seq = packet["senderSequence"]
                last_seq = last_seq_by_sender.get(sender, 0)
                if incoming_seq <= last_seq:
                    await self._send_error(
                        ws, session_id, packet["session"], protocol.ERR_INVALID_PACKET,
                        f"senderSequence must increase per sender (got {incoming_seq}, last was {last_seq})",
                    )
                    continue
                last_seq_by_sender[sender] = incoming_seq

                rpc = packet["rpc"]
                method = rpc.get("method")
                params = rpc.get("params") or {}
                request_id = rpc.get("id")

                if method == protocol.HELLO:
                    session_id = packet["session"]
                    with self._lock:
                        bridge = self._sessions.get(session_id)
                        expected_token = self._tokens.get(session_id)
                    if bridge is None:
                        await self._send_error(ws, session_id, session_id, protocol.ERR_SESSION_MISMATCH, "unknown session")
                        return
                    if not expected_token or params.get("token") != expected_token:
                        await self._send_error(ws, session_id, session_id, protocol.ERR_UNAUTHORIZED, "invalid token")
                        await ws.close(code=4401, reason="unauthorized")
                        return

                    host_seq += 1
                    await ws.send(json.dumps(protocol.packet(
                        session=session_id, sender="host", sender_sequence=host_seq,
                        rpc=protocol.response(request_id, {
                            "session": session_id,
                            "capabilities": ["query", "inputs", "outputs", "actions", "revision"],
                        }),
                    )))
                    host_seq += 1
                    await ws.send(json.dumps(protocol.packet(
                        session=session_id, sender="host", sender_sequence=host_seq,
                        rpc=protocol.notification(protocol.SNAPSHOT, {"state": bridge.snapshot()}),
                    )))
                    drain_task = asyncio.create_task(self._drain_loop(ws, bridge, session_id))
                    continue

                if session_id is None:
                    await self._send_error(ws, "?", "?", protocol.ERR_INVALID_REQUEST, "client.hello required first")
                    continue

                with self._lock:
                    bridge = self._sessions.get(session_id)
                if bridge is None:
                    await ws.close(code=4404, reason="session no longer exists")
                    return

                if method == protocol.SET:
                    changes = params.get("changes") or {}
                    try:
                        await asyncio.get_running_loop().run_in_executor(None, bridge.apply_changes, changes)
                    except HostSessionClosed:
                        await ws.close(code=4410, reason="session closed")
                        return
                    except Exception as exc:  # noqa: BLE001
                        await self._send_error(ws, session_id, session_id, protocol.ERR_INVALID_REQUEST, str(exc), request_id)
                elif method == protocol.CUSTOM_SEND:
                    content = params.get("content") or {}
                    try:
                        await asyncio.get_running_loop().run_in_executor(None, bridge.dispatch_custom, content)
                    except HostSessionClosed:
                        await ws.close(code=4410, reason="session closed")
                        return
                elif method == protocol.CLOSE:
                    await ws.close(code=1000, reason="client closed")
                    return
                else:
                    await self._send_error(ws, session_id, session_id, protocol.ERR_UNKNOWN_METHOD, f"unexpected method: {method}", request_id)
        except Exception:
            logger.exception("LocalHostServer connection handler crashed")
        finally:
            if drain_task is not None:
                drain_task.cancel()

    async def _drain_loop(self, ws, bridge: HostSession, session_id: str) -> None:
        seq = 0
        loop = asyncio.get_running_loop()
        try:
            while True:
                # `drain_events`'s `block`/`timeout` are keyword-only, so
                # `run_in_executor` (which only forwards positional args)
                # needs a `partial` rather than being passed them directly.
                events = await loop.run_in_executor(
                    None, functools.partial(bridge.drain_events, block=True, timeout=30.0)
                )
                for event in events:
                    seq += 1
                    kind = event["kind"]
                    if kind == "patch":
                        rpc = protocol.notification(protocol.PATCH, {"changes": event["changes"], "seq": event["seq"]})
                    elif kind == "custom":
                        rpc = protocol.notification(protocol.CUSTOM_MSG, {"content": event["content"]})
                    elif kind == "closed":
                        rpc = protocol.notification(protocol.DISCONNECTED, {"reason": event.get("reason", "")})
                    else:
                        continue
                    await ws.send(json.dumps(protocol.packet(session=session_id, sender="host", sender_sequence=seq, rpc=rpc)))
                    if kind == "closed":
                        return
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("LocalHostServer drain loop failed for session %s", session_id)

    async def _send_error(self, ws, session_id, sender_session, code, message, request_id=None) -> None:
        try:
            await ws.send(json.dumps(protocol.packet(
                session=sender_session or "unknown-",
                sender="host", sender_sequence=1,
                rpc=protocol.error_response(request_id, code, message),
            )))
        except Exception:
            pass


_shared_server: LocalHostServer | None = None
_shared_lock = threading.Lock()


def get_shared_server() -> LocalHostServer:
    """One lazily-created server per process, reused across sessions so a
    host with many widgets does not open a socket per widget."""
    global _shared_server
    with _shared_lock:
        if _shared_server is None:
            _shared_server = LocalHostServer()
        return _shared_server
