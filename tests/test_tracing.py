"""Core trace hook (vibe_widget.tracing): silent by default, announces when a listener is set."""

from __future__ import annotations

import sys

import pandas as pd
import pytest

import vibe_widget as vw
from vibe_widget import tracing

pytestmark = pytest.mark.unit


@pytest.fixture
def headless(tmp_path, monkeypatch):
    monkeypatch.setenv("VIBE_PROVIDER", "fake")
    monkeypatch.setenv("QUARTO_DOCUMENT_PATH", str(tmp_path / "doc.qmd"))
    monkeypatch.chdir(tmp_path)


@pytest.fixture
def collected():
    events: list[tuple[str, dict]] = []
    tracing.set_listener(lambda kind, **fields: events.append((kind, fields)))
    try:
        yield events
    finally:
        tracing.set_listener(None)


def test_no_listener_by_default():
    assert tracing.get_listener() is None
    assert tracing.is_active() is False
    tracing.emit("intent.create", payload={"prompt": "x"})  # no-op, no error


def test_widget_announces_intents_and_versions(headless, collected):
    widget = vw.create("scatter of x vs y", pd.DataFrame({"x": [1, 2]}), display=False, cache=False)
    widget = getattr(widget, "_widget", widget)
    mine = [(k, f) for k, f in collected if f["lineage_id"] == widget._trace_lineage_id]
    kinds = [k for k, _ in mine]
    assert kinds[0] == "intent.create"
    assert "artifact.version" in kinds and "artifact.code" in kinds
    version = dict(mine)["artifact.version"]
    assert version["version_id"] == widget._trace_version_id
    assert version["payload"]["origin"] == "generated"


def test_listener_errors_never_reach_widgets(headless):
    def broken(kind, **fields):
        raise RuntimeError("listener down")

    tracing.set_listener(broken)
    try:
        widget = vw.create("bar chart", pd.DataFrame({"x": [1]}), display=False, cache=False)
        assert widget.code
    finally:
        tracing.set_listener(None)


def test_vw_study_points_at_the_separate_package(monkeypatch):
    monkeypatch.setitem(sys.modules, "vibe_widget_study", None)
    with pytest.raises(ImportError, match="pip install vibe-widget-study"):
        vw.study  # noqa: B018
