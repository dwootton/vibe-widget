"""Intent artifact trace recording (vw.study): local log, streams, widget hooks."""

from __future__ import annotations

import json
from collections.abc import Iterator

import pandas as pd
import pytest
from vibe_widget_study import MemorySink, TraceRecorder, stream_for_kind
from vibe_widget_study.recorder import recorder

import vibe_widget as vw

pytestmark = pytest.mark.unit


@pytest.fixture
def recording(tmp_path, monkeypatch) -> Iterator[MemorySink]:
    """Record into tmp_path with the fake provider; always stop afterwards."""
    monkeypatch.setenv("VIBE_PROVIDER", "fake")
    # Headless render => generation runs synchronously inside vw.create().
    monkeypatch.setenv("QUARTO_DOCUMENT_PATH", str(tmp_path / "doc.qmd"))
    monkeypatch.chdir(tmp_path)
    sink = MemorySink()
    recorder.start(tmp_path / "traces", sinks=[sink])
    try:
        yield sink
    finally:
        recorder.stop()


def _kinds(sink: MemorySink) -> list[str]:
    return [e["kind"] for e in sink.events]


def _for(sink: MemorySink, widget) -> list[dict]:
    """Events of one widget's lineage (other tests' background widgets may also emit)."""
    lineage = getattr(widget, "_widget", widget)._trace_lineage_id
    return [e for e in sink.events if e["lineage_id"] == lineage]


def test_stream_for_kind():
    assert stream_for_kind("intent.grab_edit") == "intents"
    assert stream_for_kind("artifact.version") == "intents"
    assert stream_for_kind("artifact.code") == "code"
    assert stream_for_kind("error.runtime") == "errors"
    assert stream_for_kind("context.schema") == "schema"
    with pytest.raises(ValueError):
        stream_for_kind("bogus.kind")


def test_recorder_is_off_by_default():
    fresh = TraceRecorder()
    assert fresh.emit("intent.create", payload={"prompt": "x"}) is None
    assert fresh.status()["recording"] is False


def test_start_writes_jsonl_and_gitignore(tmp_path):
    rec = TraceRecorder()
    path = rec.start(tmp_path)
    rec.emit("intent.create", payload={"prompt": "scatter"}, lineage_id="L1")
    rec.stop()

    lines = [json.loads(line) for line in path.read_text().splitlines()]
    assert [e["kind"] for e in lines] == ["session.start", "intent.create", "session.stop"]
    assert lines[1]["payload"] == {"prompt": "scatter"}
    assert lines[1]["lineage_id"] == "L1"
    assert lines[1]["stream"] == "intents"
    assert (tmp_path / ".gitignore").read_text().strip().endswith("*")
    assert rec.read_events() == lines


def test_unconsented_streams_are_dropped(tmp_path):
    rec = TraceRecorder()
    rec.start(tmp_path, streams=["intents"])
    assert rec.emit("artifact.code", payload={"code": "secret"}) is None
    assert rec.emit("intent.create", payload={"prompt": "ok"}) is not None
    rec.stop()
    assert all(e["stream"] == "intents" for e in rec.read_events())


def test_intents_stream_is_required(tmp_path):
    with pytest.raises(ValueError):
        TraceRecorder().start(tmp_path, streams=["code"])
    with pytest.raises(ValueError):
        TraceRecorder().start(tmp_path, streams=["intents", "telepathy"])


def test_failing_sink_never_raises(tmp_path):
    class Broken:
        def write(self, event):
            raise RuntimeError("disk on fire")

        def close(self):
            pass

    rec = TraceRecorder()
    rec.start(tmp_path, sinks=[Broken()])
    assert rec.emit("intent.create", payload={"prompt": "x"}) is not None
    rec.stop()


def test_create_records_intent_context_and_artifact(recording):
    df = pd.DataFrame({"x": [1, 2], "y": [3, 4]})
    widget = vw.create(
        "scatter of x vs y",
        df,
        outputs=vw.outputs(selection="selected rows"),
        display=False,
        cache=False,
    )
    events = _for(recording, widget)
    kinds = [e["kind"] for e in events]
    assert kinds[:5] == [
        "intent.create",
        "context.contract",
        "context.schema",
        "artifact.version",
        "artifact.code",
    ]

    lineages = {e["lineage_id"] for e in events}
    assert len(lineages) == 1 and None not in lineages

    create, contract, schema, version, code = events[:5]
    assert create["payload"]["prompt"] == "scatter of x vs y"
    assert contract["payload"]["outputs"] == {"selection": "selected rows"}
    assert schema["payload"]["data"]["columns"] == ["x", "y"]
    assert "1" not in json.dumps(schema["payload"]["data"]["columns"])  # names, not values
    assert version["payload"]["origin"] == "generated"
    assert version["parent_version_id"] is None
    assert code["payload"]["code"] == widget.code
    assert code["version_id"] == version["version_id"]
    assert widget._provenance()["lineage_id"] == create["lineage_id"]


def test_edit_continues_the_lineage(recording, monkeypatch):
    from vibe_widget.services.generation import GenerationService

    df = pd.DataFrame({"x": [1, 2]})
    base = vw.create("base chart", df, display=False, cache=False)
    base_version = base._trace_version_id
    recording.events.clear()

    # The fake provider returns identical code for an edit; make the edit real.
    original = GenerationService.generate

    def edited_generate(self, *args, **kwargs):
        code, extra = original(self, *args, **kwargs)
        return code + "\n// tooltip added\n", extra

    monkeypatch.setattr(GenerationService, "generate", edited_generate)
    edited = base.edit("add tooltip", display=False, cache=False)
    edited_widget = getattr(edited, "_widget", edited)

    intent = next(e for e in _for(recording, base) if e["kind"] == "intent.edit")
    version = next(e for e in _for(recording, base) if e["kind"] == "artifact.version")
    assert intent["payload"]["prompt"] == "add tooltip"
    assert intent["lineage_id"] == base._trace_lineage_id
    assert version["parent_version_id"] == base_version
    assert version["version_id"] == edited_widget._trace_version_id


def test_manual_code_edit_is_a_new_version(recording):
    df = pd.DataFrame({"x": [1, 2]})
    widget = vw.create("bar chart", df, display=False, cache=False)
    before = widget._trace_version_id
    recording.events.clear()

    widget.code = widget.code + "\n// tweak\n"

    version = next(e for e in _for(recording, widget) if e["kind"] == "artifact.version")
    assert version["payload"]["origin"] == "manual_edit"
    assert version["parent_version_id"] == before


def test_runtime_error_is_recorded(recording):
    df = pd.DataFrame({"x": [1, 2]})
    widget = vw.create("line chart", df, display=False, cache=False)
    recording.events.clear()
    widget._repair_in_progress = True  # keep the repair loop out of this test
    widget.error_message = "TypeError: x is undefined"
    assert "error.runtime" in _kinds(recording)


def test_events_frame_reads_local_log(recording):
    df = pd.DataFrame({"x": [1, 2]})
    vw.create("histogram", df, display=False, cache=False)
    frame = vw.study.events()
    assert {"intent.create", "artifact.version"} <= set(frame["kind"])
    assert vw.study.status()["recording"] is True
