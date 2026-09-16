import threading
import time

import pytest

from vibe_widget.hosts.bridge import EXCLUDED_TRAITS, HostSession, HostSessionClosed


def test_snapshot_excludes_framework_traits_including_the_multi_mb_bundle(bridge):
    snapshot = bridge.snapshot()
    assert "_esm" not in snapshot, "the ~4MB bundle text must never appear in a state snapshot"
    for name in EXCLUDED_TRAITS:
        assert name not in snapshot
    # ...but ordinary widget state is present.
    assert "status" in snapshot
    assert "code" in snapshot
    assert "data" in snapshot


def test_trait_change_publishes_a_patch_event(bridge, widget):
    widget.logs = ["hello"]
    events = bridge.drain_events()
    patches = [e for e in events if e["kind"] == "patch"]
    assert any(e["changes"].get("logs") == ["hello"] for e in patches)


def test_drain_events_removes_what_it_returns(bridge, widget):
    widget.logs = ["one"]
    first = bridge.drain_events()
    assert len(first) >= 1
    second = bridge.drain_events()
    assert second == []


def test_events_carry_a_monotonically_increasing_sequence(bridge, widget):
    widget.logs = ["a"]
    widget.logs = ["a", "b"]
    widget.logs = ["a", "b", "c"]
    events = bridge.drain_events()
    seqs = [e["seq"] for e in events]
    assert seqs == sorted(seqs)
    assert len(set(seqs)) == len(seqs)


def test_outbound_custom_message_is_captured_not_dropped(bridge, widget):
    widget.send({"type": "ping", "value": 1})
    events = bridge.drain_events()
    custom = [e for e in events if e["kind"] == "custom"]
    assert len(custom) == 1
    assert custom[0]["content"] == {"type": "ping", "value": 1}


def test_apply_changes_rejects_unknown_trait(bridge):
    with pytest.raises(ValueError, match="Unknown or disallowed"):
        bridge.apply_changes({"not_a_real_trait": 1})


def test_apply_changes_rejects_esm_even_though_it_is_a_real_trait(bridge):
    # `_esm` is a real synced trait on the widget, but it is excluded from
    # `trait_names` precisely so a client can never overwrite the host's own
    # frontend bundle through this channel.
    with pytest.raises(ValueError, match="Unknown or disallowed"):
        bridge.apply_changes({"_esm": "malicious"})


def test_apply_changes_can_write_engine_traits_like_status_and_widget_logs(bridge, widget):
    # These are legitimately client-writable: the real frontend sets them
    # directly as part of its own runtime-error-capture -> repair-loop flow,
    # over a live Jupyter comm exactly as much as over this one.
    bridge.apply_changes({"status": "error", "widget_logs": [{"message": "boom", "level": "error"}]})
    assert widget.status == "error"
    assert widget.widget_logs == [{"message": "boom", "level": "error"}]


def test_apply_changes_runs_on_a_single_writer_thread(bridge):
    seen_threads = set()

    def _record(change):
        seen_threads.add(threading.current_thread().name)

    bridge.widget.observe(_record, names="logs")
    for i in range(20):
        bridge.apply_changes({"logs": [str(i)]})
    assert seen_threads == {"vibe-host-writer"}


def test_concurrent_apply_changes_do_not_corrupt_state(bridge):
    # Many callers racing to set different traits must all land correctly,
    # since the writer thread serializes them rather than letting traitlets
    # see concurrent mutation from multiple threads.
    errors = []

    def _writer(i):
        try:
            bridge.apply_changes({"logs": [f"from-{i}"]})
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=_writer, args=(i,)) for i in range(50)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=5)
    assert not errors
    assert bridge.widget.logs[0].startswith("from-")


def test_dispatch_custom_reaches_the_widgets_custom_message_handler(bridge):
    # `save_widget` is the one custom message type the engine still handles
    # (see `VibeWidget._handle_custom_msg`); every other type is ignored.
    bridge.dispatch_custom({"type": "save_widget", "request_id": "req-1", "path": "smoke.vw"})
    events = bridge.drain_events()
    custom = [e for e in events if e["kind"] == "custom"]
    assert len(custom) == 1
    assert custom[0]["content"]["type"] == "save_widget_result"
    assert custom[0]["content"]["request_id"] == "req-1"


def test_dispatch_custom_ignores_unknown_message_types(bridge):
    bridge.dispatch_custom({"type": "request_editor_bundle"})
    assert bridge.drain_events() == []


def test_invoke_runs_a_callable_on_the_writer_thread_and_returns_its_result(bridge):
    result = bridge.invoke(lambda: 1 + 1)
    assert result == 2


def test_wait_for_returns_true_once_predicate_holds(bridge, widget):
    def _set_ready_soon():
        time.sleep(0.05)
        widget.status = "ready"

    threading.Thread(target=_set_ready_soon).start()
    assert bridge.wait_for(lambda w: w.status == "ready", timeout=2.0)


def test_wait_for_times_out_and_returns_false(bridge):
    assert bridge.wait_for(lambda w: False, timeout=0.2) is False


def test_close_is_idempotent_and_rejects_further_writes(bridge):
    bridge.close("test done")
    bridge.close("test done again")  # must not raise
    with pytest.raises(HostSessionClosed):
        bridge.apply_changes({"logs": ["late"]})


def test_close_publishes_a_closed_event(bridge):
    bridge.close("goodbye")
    events = bridge.drain_events()
    closed = [e for e in events if e["kind"] == "closed"]
    assert len(closed) == 1
    assert closed[0]["reason"] == "goodbye"


def test_a_full_slow_queue_drops_events_instead_of_blocking_the_widget(widget):
    tiny = HostSession(widget, event_queue_size=2)
    try:
        # More trait changes than the queue can hold must not raise or hang
        # the caller (the generation/writer thread setting these traits).
        for i in range(10):
            widget.logs = [str(i)]
        events = tiny.drain_events()
        assert len(events) <= 2
    finally:
        tiny.close()
