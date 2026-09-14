"""Core widget wiring: messages, approval gating, contract, and save/load."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from vibe_widget.core import widget as widget_mod
from vibe_widget.core.widget import VibeWidget
from vibe_widget.utils.widget_store import WidgetStore

CODE = "export default function App() { return null; }"


class StubProvider:
    """Stand-in for OpenRouterProvider that never touches the network."""

    def __init__(self, model: str, api_key: str, **kwargs: Any) -> None:
        self.model = model
        self.api_key = api_key
        self.base_url = kwargs.get("base_url") or "https://stub.invalid/v1"
        self.temperature = kwargs.get("temperature", 0.7)
        self.usage = {"prompt_tokens": 11, "completion_tokens": 22, "requests": 1}


@pytest.fixture(autouse=True)
def offline_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    """Swap the provider the widget builds during __init__."""
    monkeypatch.setattr(widget_mod, "OpenRouterProvider", StubProvider)


def make_widget(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, **kwargs: Any) -> VibeWidget:
    """Build a widget from existing code so no generation runs."""
    monkeypatch.chdir(tmp_path)
    params: dict[str, Any] = {
        "description": "test widget",
        "df": None,
        "existing_code": CODE,
        "display_widget": False,
    }
    params.update(kwargs)
    return VibeWidget._create_with_dynamic_traits(**params)


def test_unknown_custom_messages_are_ignored(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    widget = make_widget(tmp_path, monkeypatch)
    sent: list[dict[str, Any]] = []
    monkeypatch.setattr(widget, "send", lambda payload, *a, **k: sent.append(payload))

    widget._handle_custom_msg({"type": "remote_call", "id": "1", "name": "fs.read"}, [])
    widget._handle_custom_msg({"type": "request_editor_bundle"}, [])
    widget._handle_custom_msg("not a dict", [])

    assert sent == []


def test_save_widget_cannot_escape_the_exports_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    widget = make_widget(tmp_path, monkeypatch)
    sent: list[dict[str, Any]] = []
    monkeypatch.setattr(widget, "send", lambda payload, *a, **k: sent.append(payload))

    widget._handle_custom_msg({"type": "save_widget", "path": "../../etc/x.vw"}, [])

    assert sent[0]["success"] is True
    assert sent[0]["path"] == str(Path(".vibewidget") / "exports" / "x.vw")
    assert (tmp_path / ".vibewidget" / "exports" / "x.vw").exists()


def test_save_widget_caps_the_file_name(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    widget = make_widget(tmp_path, monkeypatch)
    sent: list[dict[str, Any]] = []
    monkeypatch.setattr(widget, "send", lambda payload, *a, **k: sent.append(payload))

    widget._handle_custom_msg({"type": "save_widget", "path": "n" * 400 + ".vw"}, [])

    name = Path(sent[0]["path"]).name
    assert len(name) == 100
    assert name.endswith(".vw")


def test_save_widget_refuses_a_symlinked_target(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    widget = make_widget(tmp_path, monkeypatch)
    exports = tmp_path / ".vibewidget" / "exports"
    exports.mkdir(parents=True, exist_ok=True)
    outside = tmp_path / "outside.vw"
    (exports / "link.vw").symlink_to(outside)
    sent: list[dict[str, Any]] = []
    monkeypatch.setattr(widget, "send", lambda payload, *a, **k: sent.append(payload))

    widget._handle_custom_msg({"type": "save_widget", "path": "link.vw"}, [])

    assert sent[0]["success"] is False
    assert "symlink" in sent[0]["error"]
    assert not outside.exists()


def test_repair_under_approval_does_not_claim_the_fix_is_live(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    widget = make_widget(tmp_path, monkeypatch, execution_mode="approve")
    widget.retry_count = 2

    assert widget._apply_code("export default function Fixed() { return null; }") is False
    assert widget.render_code == ""
    assert widget.retry_count == 2
    assert "approve" in widget._unrendered_reason()


def test_reserved_names_are_rejected(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValueError, match="usage"):
        make_widget(tmp_path, monkeypatch, exports={"usage": "token counts"})

    with pytest.raises(ValueError, match="data"):
        make_widget(tmp_path, monkeypatch, imports={"data": None})


def test_approve_mode_withholds_render_code_until_approved(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    widget = make_widget(tmp_path, monkeypatch, execution_mode="approve")

    assert widget.code == CODE
    assert widget.render_code == ""

    widget.execution_approved = True

    assert widget.render_code


def test_contract_lists_inputs_outputs_and_actions(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    widget = make_widget(
        tmp_path,
        monkeypatch,
        exports={"selection": "picked rows"},
        imports={"threshold": None},
        actions={"reset": "clear the selection"},
    )

    assert widget.contract == {
        "inputs": ["threshold"],
        "outputs": ["selection"],
        "actions": ["reset"],
    }


def test_usage_reports_the_provider_counters(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    widget = make_widget(tmp_path, monkeypatch)

    assert widget.usage == {"prompt_tokens": 11, "completion_tokens": 22, "requests": 1}


def test_vw_round_trip_preserves_outputs_inputs_and_actions(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    widget = make_widget(
        tmp_path,
        monkeypatch,
        exports={"selection": "picked rows"},
        imports={"threshold": None},
        actions={"reset": "clear the selection"},
    )
    target = widget.save(tmp_path / "bundle.vw")

    payload = json.loads(target.read_text(encoding="utf-8"))
    assert payload["outputs"] == {"selection": "picked rows"}
    assert set(payload["inputs"]) == {"threshold"}
    assert payload["actions"] == {"reset": "clear the selection"}
    assert payload["provenance"]["provider_usage"]["requests"] == 1

    loaded = widget_mod.load(target, approval=False, display=False).widget
    assert loaded.contract == {
        "inputs": ["threshold"],
        "outputs": ["selection"],
        "actions": ["reset"],
    }


def test_load_reads_version_1_0_bundles(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    legacy = tmp_path / "legacy.vw"
    legacy.write_text(
        json.dumps(
            {
                "version": "1.0",
                "description": "legacy widget",
                "code": CODE,
                "outputs": {"selection": "picked rows"},
                "inputs_signature": {"threshold": "<input>", "data": "<input>"},
                "theme": None,
                "save_inputs": {"embedded": False, "values": {}},
            }
        ),
        encoding="utf-8",
    )

    loaded = widget_mod.load(legacy, approval=False, display=False).widget

    assert loaded.contract["inputs"] == ["threshold"]
    assert loaded.contract["outputs"] == ["selection"]


def test_edit_resolves_a_source_by_var_name(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.chdir(tmp_path)
    store = WidgetStore()
    store.save(
        widget_code=CODE,
        description="a stored widget",
        var_name="stored_widget",
        data_signature=None,
        model="stub/model",
        exports=None,
        imports_serialized=None,
    )

    info = widget_mod._resolve_source("stored_widget", store)

    assert info.code == CODE
    assert info.metadata["var_name"] == "stored_widget"
