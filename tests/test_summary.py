"""Tests for the prompt summary builder and its privacy modes."""

import pandas as pd
import pytest

from vibe_widget.utils.util import summarize_for_prompt

SENTINEL = "SENTINEL_SSN_123-45-6789"


def _frame():
    return pd.DataFrame({"ssn": [SENTINEL, "other", "third"], "score": [1.0, 2.0, 3.0]})


def test_schema_mode_never_leaks_cell_values():
    summary = summarize_for_prompt(_frame(), privacy="schema")
    assert SENTINEL not in summary
    assert "other" not in summary
    assert "ssn" in summary
    assert "nunique 3" in summary
    assert "min 1.0" in summary and "max 3.0" in summary and "mean 2.0" in summary


def test_sample_mode_emits_exactly_the_requested_rows():
    summary = summarize_for_prompt(_frame(), privacy="sample", sample_rows=1)
    assert summary.count(SENTINEL) == 1
    assert "third" not in summary


def test_unknown_privacy_value_falls_back_to_schema():
    assert SENTINEL not in summarize_for_prompt(_frame(), privacy="anything-else")


def test_defaults_come_from_global_config(monkeypatch):
    import importlib

    config_module = importlib.import_module("vibe_widget.config")

    class FakeConfig:
        data_privacy = "schema"
        sample_rows = 3

    monkeypatch.setattr(config_module, "get_global_config", lambda: FakeConfig())
    assert SENTINEL not in summarize_for_prompt(_frame())


def test_series_and_null_counts():
    series = pd.Series([1.0, None, 3.0], name="values")
    summary = summarize_for_prompt(series, privacy="schema")
    assert "pandas.Series: 3 rows x 1 columns" in summary
    assert "nulls 1" in summary


def test_non_tabular_values_are_type_and_length_only():
    payload = {"secret": SENTINEL}
    schema = summarize_for_prompt(payload, privacy="schema")
    assert schema == "dict, len 1"

    sample = summarize_for_prompt(payload, privacy="sample")
    assert sample.startswith("dict, len 1, value ")
    assert SENTINEL in sample

    assert summarize_for_prompt(3.5, privacy="schema") == "float"


def test_long_reprs_are_truncated():
    summary = summarize_for_prompt("x" * 5000, privacy="sample")
    assert summary.endswith("...")
    assert len(summary) < 300


def test_result_is_always_a_string():
    assert isinstance(summarize_for_prompt(_frame(), privacy="sample"), str)
    assert isinstance(summarize_for_prompt(object(), privacy="sample"), str)


@pytest.mark.parametrize(
    "frame",
    [
        pd.DataFrame(),
        pd.DataFrame([[1, 2]], columns=["dup", "dup"]),
        pd.DataFrame([[1, 2]], columns=[0, 1]),
        pd.DataFrame([[1, 2]], columns=pd.MultiIndex.from_tuples([("a", "x"), ("a", "y")])),
        pd.DataFrame({"obj": [[1, 2], {"k": "v"}]}),
    ],
)
@pytest.mark.parametrize("privacy", ["schema", "sample"])
def test_awkward_frames_still_summarize(frame, privacy):
    assert isinstance(summarize_for_prompt(frame, privacy=privacy), str)
