import pytest

from vibe_widget.hosts import protocol


def _valid_packet(**overrides):
    base = protocol.packet(
        session="a" * 16,
        sender="frontend",
        sender_sequence=1,
        rpc=protocol.request(protocol.SET, {"changes": {"code": "x"}}, "req-1"),
    )
    base.update(overrides)
    return base


def test_packet_round_trip_is_valid():
    value = _valid_packet()
    validated = protocol.assert_packet(value)
    assert validated is value


def test_assert_packet_enforces_expected_session():
    value = _valid_packet()
    with pytest.raises(protocol.ProtocolError) as exc_info:
        protocol.assert_packet(value, expected_session="different-session-id")
    assert exc_info.value.code == protocol.ERR_SESSION_MISMATCH


@pytest.mark.parametrize(
    "mutate,expected_code",
    [
        (lambda v: v.__setitem__("protocol", "vibe.transport/1"), protocol.ERR_INVALID_PACKET),
        (lambda v: v.__setitem__("session", "short"), protocol.ERR_INVALID_PACKET),
        (lambda v: v.__setitem__("session", "a" * 200), protocol.ERR_INVALID_PACKET),
        (lambda v: v.__setitem__("sender", ""), protocol.ERR_INVALID_PACKET),
        (lambda v: v.__setitem__("senderSequence", 0), protocol.ERR_INVALID_PACKET),
        (lambda v: v.__setitem__("senderSequence", -1), protocol.ERR_INVALID_PACKET),
        (lambda v: v.__setitem__("senderSequence", 1.5), protocol.ERR_INVALID_PACKET),
        (lambda v: v.__setitem__("rpc", {"jsonrpc": "1.0", "method": protocol.SET}), protocol.ERR_INVALID_PACKET),
        (lambda v: v["rpc"].__setitem__("method", "not.a.real.method"), protocol.ERR_UNKNOWN_METHOD),
        (lambda v: v["rpc"].__setitem__("params", "not-an-object"), protocol.ERR_INVALID_REQUEST),
    ],
)
def test_assert_packet_rejects_malformed_input(mutate, expected_code):
    value = _valid_packet()
    mutate(value)
    with pytest.raises(protocol.ProtocolError) as exc_info:
        protocol.assert_packet(value)
    assert exc_info.value.code == expected_code


def test_assert_packet_rejects_non_dict():
    with pytest.raises(protocol.ProtocolError) as exc_info:
        protocol.assert_packet("not a dict")
    assert exc_info.value.code == protocol.ERR_INVALID_PACKET


def test_assert_packet_requires_method_or_result_or_error():
    value = _valid_packet()
    value["rpc"] = {"jsonrpc": "2.0"}
    with pytest.raises(protocol.ProtocolError) as exc_info:
        protocol.assert_packet(value)
    assert exc_info.value.code == protocol.ERR_INVALID_REQUEST


def test_assert_packet_accepts_a_bare_result_with_no_method():
    value = _valid_packet()
    value["rpc"] = {"jsonrpc": "2.0", "id": "req-1", "result": {"ok": True}}
    protocol.assert_packet(value)  # does not raise


def test_notification_has_no_id_request_has_one():
    notif = protocol.notification(protocol.SET, {"changes": {}})
    req = protocol.request(protocol.SET, {"changes": {}}, "id-1")
    assert protocol.is_notification(notif) and not protocol.is_request(notif)
    assert protocol.is_request(req) and not protocol.is_notification(req)


def test_error_response_shape():
    err = protocol.error_response("id-1", protocol.ERR_UNAUTHORIZED, "nope")
    assert err == {"jsonrpc": "2.0", "id": "id-1", "error": {"code": "UNAUTHORIZED", "message": "nope"}}
