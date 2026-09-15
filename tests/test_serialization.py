"""Tests for JSON cleaning and widget input preparation."""

from decimal import Decimal

import numpy as np
import pandas as pd
import pytest

from vibe_widget.utils.serialization import clean_for_json, prepare_input_for_widget


def test_numpy_scalars_become_python_scalars():
    cleaned = clean_for_json(
        {"i": np.int64(42), "f": np.float32(1.5), "b": np.bool_(True), "s": np.str_("x")}
    )
    assert cleaned == {"i": 42, "f": pytest.approx(1.5), "b": True, "s": "x"}
    assert type(cleaned["i"]) is int
    assert type(cleaned["b"]) is bool


def test_datetime_like_values_are_serialized():
    ts = pd.Timestamp("2024-01-02T03:04:05", tz="UTC")
    assert clean_for_json(ts) == ts.isoformat()
    assert clean_for_json(pd.NaT) is None
    assert clean_for_json(np.datetime64("2024-01-02")) == "2024-01-02"
    assert clean_for_json(np.datetime64("NaT", "s")) is None
    assert clean_for_json(pd.Timedelta(days=1)) == "P1DT0H0M0S"


def test_categorical_column_does_not_raise():
    df = pd.DataFrame({"c": pd.Categorical(["a", "b", "a"])})
    assert clean_for_json(df) == [{"c": "a"}, {"c": "b"}, {"c": "a"}]
    assert clean_for_json(pd.Categorical(["a", "b"])) == ["a", "b"]


def test_containers_and_exotic_scalars():
    cleaned = clean_for_json(
        {
            "dec": Decimal("1.25"),
            "raw": b"caf\xc3\xa9",
            "tup": (1, 2),
            "set": {"only"},
            "nested": [{"deep": np.int64(7)}],
            "nan": float("nan"),
            "inf": float("inf"),
        }
    )
    assert cleaned["dec"] == 1.25
    assert cleaned["raw"] == "café"
    assert cleaned["tup"] == [1, 2]
    assert cleaned["set"] == ["only"]
    assert cleaned["nested"] == [{"deep": 7}]
    assert cleaned["nan"] is None
    assert cleaned["inf"] is None


def test_large_int_keeps_precision():
    big = 2**53 + 1
    assert clean_for_json(big) == big


def test_string_with_brace_passes_through():
    text = "result: {a, b}"
    assert clean_for_json(text) == text
    assert prepare_input_for_widget(text, input_name="note") == text


def test_sampling_is_strided_and_keeps_first_and_last_row():
    df = pd.DataFrame({"i": range(100)})
    rows = prepare_input_for_widget(df, input_name="data", sample=True, max_rows=10)
    values = [row["i"] for row in rows]
    assert len(rows) == 10
    assert values[0] == 0
    assert values[-1] == 99
    assert values == sorted(values)
    assert rows == prepare_input_for_widget(df, input_name="data", sample=True, max_rows=10)


def test_sampling_is_a_no_op_below_the_limit():
    df = pd.DataFrame({"i": range(5)})
    assert len(prepare_input_for_widget(df, input_name="data", sample=True, max_rows=10)) == 5
    assert len(prepare_input_for_widget(df, input_name="data")) == 5


def test_max_rows_below_one_still_samples_one_row():
    df = pd.DataFrame({"i": range(50)})
    assert prepare_input_for_widget(df, input_name="data", sample=True, max_rows=0) == [{"i": 0}]


def test_unsampled_row_guard_names_the_input(monkeypatch):
    import vibe_widget.utils.serialization as serialization

    monkeypatch.setattr(serialization, "_is_pandas_object", lambda obj: (True, "DataFrame"))

    class HugeFrame:
        def __len__(self):
            return 100_001

    with pytest.raises(ValueError, match="input 'readings'"):
        prepare_input_for_widget(HugeFrame(), input_name="readings")
