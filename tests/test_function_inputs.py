"""Python functions passed as inputs: descriptor, prompt, contract, and the call round trip."""

from __future__ import annotations

import functools
from pathlib import Path
from typing import Any

import numpy as np
import pytest

import vibe_widget as vw
from vibe_widget.core import widget as widget_mod
from vibe_widget.core.widget import VibeWidget, _serialize_inputs, _summarize_inputs_for_prompt
from vibe_widget.llm.providers.base import LLMProvider
from vibe_widget.utils.function_inputs import (
    FUNCTION_SUMMARY_PREFIX,
    function_descriptor,
    is_function_input,
    run_function_call,
)

CODE = "export default function App() { return null; }"


def erode(heightmap, num_stages=7):
    """Hydraulic erosion returning intermediate stages.

    Second paragraph that should not reach the prompt.
    """
    h = np.asarray(heightmap, dtype=np.float32)
    return [(h * (1 - 0.1 * i)).tolist() for i in range(num_stages)]


class StubProvider:
    def __init__(self, model: str, api_key: str, **kwargs: Any) -> None:
        self.model = model
        self.api_key = api_key
        self.base_url = "https://stub.invalid/v1"
        self.temperature = 0.7
        self.usage = {}


@pytest.fixture(autouse=True)
def offline_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(widget_mod, "OpenRouterProvider", StubProvider)


def make_widget(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, imports: dict[str, Any]) -> VibeWidget:
    monkeypatch.chdir(tmp_path)
    return VibeWidget._create_with_dynamic_traits(
        description="terrain", df=None, existing_code=CODE, display_widget=False, imports=imports
    )


def test_is_function_input_accepts_routines_but_not_other_callables() -> None:
    class Holder:
        def method(self) -> None: ...

    assert is_function_input(erode)
    assert is_function_input(lambda x: x)
    assert is_function_input(len)
    assert is_function_input(Holder().method)
    assert is_function_input(functools.partial(erode, num_stages=3))
    # widgets, export handles and classes are callable but are not function inputs
    assert not is_function_input(Holder)
    assert not is_function_input(object())
    assert not is_function_input(3)


def test_descriptor_and_summary_describe_the_signature_and_first_doc_paragraph() -> None:
    desc = function_descriptor("run_erosion", erode)
    assert desc == {
        "__vibe_function__": True,
        "name": "run_erosion",
        "signature": "erode(heightmap, num_stages=7)",
        "doc": "Hydraulic erosion returning intermediate stages.",
    }
    summary = _summarize_inputs_for_prompt({"run_erosion": erode})["run_erosion"]
    assert summary.startswith(FUNCTION_SUMMARY_PREFIX + "erode(heightmap, num_stages=7)")
    assert "Second paragraph" not in summary


def test_widget_syncs_a_descriptor_and_lists_the_function_in_the_contract(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    widget = make_widget(tmp_path, monkeypatch, {"run_erosion": erode, "threshold": 0.2})

    assert widget.run_erosion["__vibe_function__"] is True
    assert widget.threshold == 0.2
    assert widget.contract["functions"] == ["run_erosion"]
    assert set(widget.contract["inputs"]) == {"run_erosion", "threshold"}
    assert widget._functions == {"run_erosion": erode}


def test_call_function_message_runs_the_function_and_replies(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    widget = make_widget(tmp_path, monkeypatch, {"run_erosion": erode})
    sent: list[dict[str, Any]] = []
    monkeypatch.setattr(widget, "send", lambda payload, *a, **k: sent.append(payload))

    widget._handle_custom_msg(
        {"type": "call_function", "call_id": "c1", "name": "run_erosion", "args": [[[1.0, 0.5]], 2]}, []
    )

    assert sent == [
        {"type": "function_result", "call_id": "c1", "name": "run_erosion", "ok": True,
         "result": [[[1.0, 0.5]], [[0.8999999761581421, 0.44999998807907104]]]}
    ]


def test_call_function_reports_python_errors_and_unknown_names(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom(x):
        raise ValueError("bad terrain")

    widget = make_widget(tmp_path, monkeypatch, {"boom": boom})
    sent: list[dict[str, Any]] = []
    monkeypatch.setattr(widget, "send", lambda payload, *a, **k: sent.append(payload))

    widget._handle_custom_msg({"type": "call_function", "call_id": "a", "name": "boom", "args": [1]}, [])
    widget._handle_custom_msg({"type": "call_function", "call_id": "b", "name": "os.system", "args": ["ls"]}, [])

    assert sent[0]["ok"] is False and sent[0]["error"] == "ValueError: bad terrain"
    assert sent[1]["ok"] is False and "not a function input" in sent[1]["error"]


def test_run_function_call_rejects_malformed_arguments() -> None:
    reply = run_function_call({"f": erode}, {"call_id": "x", "name": "f", "args": "nope"})
    assert reply["ok"] is False and "must be a list" in reply["error"]


def test_function_inputs_are_never_linked_or_bundled(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    widget = make_widget(tmp_path, monkeypatch, {"run_erosion": erode})
    widget_mod._link_imports(widget, widget._imports)  # must not raise or overwrite the descriptor
    assert widget.run_erosion["signature"] == "erode(heightmap, num_stages=7)"

    values = _serialize_inputs(widget)["values"]
    assert values["run_erosion"]["type"] == "function"
    assert values["run_erosion"]["signature"] == "erode(heightmap, num_stages=7)"


def test_prompt_lists_functions_separately_with_the_call_pattern() -> None:
    inputs = _summarize_inputs_for_prompt({"run_erosion": erode, "threshold": 0.2})
    # The section builder reads no provider state, so call it unbound.
    section = LLMProvider._build_outputs_inputs_section(None, {}, inputs, {}, None)  # type: ignore[arg-type]

    assert "FUNCTIONS (Python functions" in section
    assert "- run_erosion: erode(heightmap, num_stages=7)" in section
    assert 'await model.call("run_erosion", arg1, arg2, ...)' in section
    inputs_block = section.split("INPUTS (State from other widgets):", 1)[1].split("FUNCTIONS", 1)[0]
    assert "threshold" in inputs_block and "run_erosion" not in inputs_block


def test_vw_inputs_keeps_a_function_by_name() -> None:
    bundle = vw.inputs(run_erosion=erode)
    assert bundle.inputs == {"run_erosion": erode}
