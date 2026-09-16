import asyncio
import json

import pytest
import websockets

from vibe_widget.hosts import protocol
from vibe_widget.hosts.bridge import HostSession
from vibe_widget.hosts.server import LocalHostServer

pytestmark = pytest.mark.asyncio


@pytest.fixture
def server():
    srv = LocalHostServer()
    yield srv
    srv.stop()


@pytest.fixture
def registered(server, widget):
    session_id = "session-" + "a" * 20
    bridge = HostSession(widget)
    token = server.register(bridge, session_id=session_id)
    yield server, bridge, session_id, token
    if not bridge.closed:
        bridge.close()
    server.unregister(session_id)


async def _hello(ws, session_id, token):
    await ws.send(json.dumps(protocol.packet(
        session=session_id, sender="frontend", sender_sequence=1,
        rpc=protocol.request(protocol.HELLO, {"clientId": "test", "token": token}, "hello"),
    )))
    hello_reply = json.loads(await ws.recv())
    snapshot_msg = json.loads(await ws.recv())
    return hello_reply, snapshot_msg


async def test_health_endpoint(server):
    import aiohttp

    async with aiohttp.ClientSession() as http:
        async with http.get(f"{server.url}/health") as resp:
            assert resp.status == 200
            assert await resp.text() == "ok"


async def test_bundle_asset_is_served(server):
    import aiohttp

    async with aiohttp.ClientSession() as http:
        async with http.get(f"{server.url}/assets/vibewidget-host.js") as resp:
            assert resp.status == 200
            body = await resp.text()
            assert "VibeWidgetHost" in body


async def test_unknown_session_page_returns_404(server):
    import aiohttp

    async with aiohttp.ClientSession() as http:
        async with http.get(f"{server.url}/w/does-not-exist") as resp:
            assert resp.status == 404


async def test_session_page_is_served_once_registered(registered):
    server, bridge, session_id, token = registered
    import aiohttp

    async with aiohttp.ClientSession() as http:
        async with http.get(server.page_url(session_id)) as resp:
            assert resp.status == 200
            body = await resp.text()
            assert token in body
            assert session_id in body


async def test_hello_with_correct_token_returns_session_and_snapshot(registered):
    server, bridge, session_id, token = registered
    async with websockets.connect(f"{server.ws_url}/ws/{session_id}") as ws:
        hello_reply, snapshot_msg = await _hello(ws, session_id, token)
        assert hello_reply["rpc"]["result"]["session"] == session_id
        assert "query" in hello_reply["rpc"]["result"]["capabilities"]
        assert snapshot_msg["rpc"]["method"] == protocol.SNAPSHOT
        assert "_esm" not in snapshot_msg["rpc"]["params"]["state"]


async def test_hello_with_wrong_token_is_rejected(registered):
    server, bridge, session_id, token = registered
    async with websockets.connect(f"{server.ws_url}/ws/{session_id}") as ws:
        await ws.send(json.dumps(protocol.packet(
            session=session_id, sender="frontend", sender_sequence=1,
            rpc=protocol.request(protocol.HELLO, {"clientId": "x", "token": "wrong-token"}, "hello"),
        )))
        reply = json.loads(await ws.recv())
        assert reply["rpc"]["error"]["code"] == protocol.ERR_UNAUTHORIZED
        with pytest.raises(websockets.exceptions.ConnectionClosed):
            await ws.recv()


async def test_hello_for_unknown_session_is_rejected(server):
    async with websockets.connect(f"{server.ws_url}/ws/nonexistent-session-id") as ws:
        await ws.send(json.dumps(protocol.packet(
            session="nonexistent-session-id", sender="frontend", sender_sequence=1,
            rpc=protocol.request(protocol.HELLO, {"clientId": "x", "token": "whatever"}, "hello"),
        )))
        reply = json.loads(await ws.recv())
        assert reply["rpc"]["error"]["code"] == protocol.ERR_SESSION_MISMATCH


async def test_state_set_reaches_the_widget_and_state_patch_comes_back(registered):
    server, bridge, session_id, token = registered
    async with websockets.connect(f"{server.ws_url}/ws/{session_id}") as ws:
        await _hello(ws, session_id, token)
        await ws.send(json.dumps(protocol.packet(
            session=session_id, sender="frontend", sender_sequence=2,
            rpc=protocol.notification(protocol.SET, {"changes": {"logs": ["hi from the client"]}}),
        )))
        # Poll a few incoming messages for the patch (interleaved with any
        # other host-generated events is fine; this is what a real client
        # does too).
        for _ in range(10):
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            rpc = msg["rpc"]
            if rpc.get("method") == protocol.PATCH and "logs" in rpc["params"]["changes"]:
                assert rpc["params"]["changes"]["logs"] == ["hi from the client"]
                break
        else:
            pytest.fail("did not receive the expected state.patch for `logs`")
        assert bridge.widget.logs == ["hi from the client"]


async def test_custom_send_round_trips_through_dispatch(registered):
    server, bridge, session_id, token = registered
    async with websockets.connect(f"{server.ws_url}/ws/{session_id}") as ws:
        await _hello(ws, session_id, token)
        # `save_widget` is the one custom message type the engine still
        # handles (see `VibeWidget._handle_custom_msg`).
        await ws.send(json.dumps(protocol.packet(
            session=session_id, sender="frontend", sender_sequence=2,
            rpc=protocol.notification(
                protocol.CUSTOM_SEND,
                {"content": {"type": "save_widget", "request_id": "req-1", "path": "smoke.vw"}},
            ),
        )))
        for _ in range(10):
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            rpc = msg["rpc"]
            if rpc.get("method") == protocol.CUSTOM_MSG:
                assert rpc["params"]["content"]["type"] == "save_widget_result"
                break
        else:
            pytest.fail("did not receive the expected custom.msg reply")


async def test_malformed_json_gets_a_structured_error_not_a_crash(registered):
    server, bridge, session_id, token = registered
    async with websockets.connect(f"{server.ws_url}/ws/{session_id}") as ws:
        await ws.send("{not valid json")
        reply = json.loads(await ws.recv())
        assert reply["rpc"]["error"]["code"] == protocol.ERR_INVALID_PACKET
        # connection must still be usable afterward
        hello_reply, _ = await _hello(ws, session_id, token)
        assert hello_reply["rpc"]["result"]["session"] == session_id


async def test_unknown_method_before_hello_is_rejected(registered):
    server, bridge, session_id, token = registered
    async with websockets.connect(f"{server.ws_url}/ws/{session_id}") as ws:
        await ws.send(json.dumps(protocol.packet(
            session=session_id, sender="frontend", sender_sequence=1,
            rpc=protocol.notification(protocol.SET, {"changes": {}}),
        )))
        reply = json.loads(await ws.recv())
        assert reply["rpc"]["error"]["code"] == protocol.ERR_INVALID_REQUEST


async def test_disallowed_origin_is_rejected_at_handshake(registered):
    server, bridge, session_id, token = registered
    with pytest.raises(websockets.exceptions.InvalidStatus):
        async with websockets.connect(
            f"{server.ws_url}/ws/{session_id}",
            additional_headers={"Origin": "https://evil.example.com"},
        ):
            pass


async def test_allowed_loopback_origin_is_accepted(registered):
    server, bridge, session_id, token = registered
    async with websockets.connect(
        f"{server.ws_url}/ws/{session_id}",
        additional_headers={"Origin": "http://127.0.0.1:9999"},
    ) as ws:
        hello_reply, _ = await _hello(ws, session_id, token)
        assert hello_reply["rpc"]["result"]["session"] == session_id


async def test_two_sessions_on_one_server_are_isolated(server, sample_df):
    import vibe_widget as vw

    handle_a = vw.create("widget a", sample_df, display=False, cache=False)
    handle_b = vw.create("widget b", sample_df, display=False, cache=False)
    widget_a = getattr(handle_a, "_widget", None) or handle_a
    widget_b = getattr(handle_b, "_widget", None) or handle_b
    bridge_a = HostSession(widget_a)
    bridge_b = HostSession(widget_b)
    session_a = "session-a-" + "1" * 16
    session_b = "session-b-" + "2" * 16
    token_a = server.register(bridge_a, session_id=session_a)
    token_b = server.register(bridge_b, session_id=session_b)
    try:
        async with websockets.connect(f"{server.ws_url}/ws/{session_a}") as ws_a:
            await _hello(ws_a, session_a, token_a)
            await ws_a.send(json.dumps(protocol.packet(
                session=session_a, sender="frontend", sender_sequence=2,
                rpc=protocol.notification(protocol.SET, {"changes": {"logs": ["only widget a"]}}),
            )))
            await asyncio.sleep(0.3)
        assert widget_a.logs == ["only widget a"]
        assert widget_b.logs != ["only widget a"]
    finally:
        bridge_a.close()
        bridge_b.close()
        server.unregister(session_a)
        server.unregister(session_b)
