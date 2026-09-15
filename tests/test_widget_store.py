"""Tests for the git-shareable widget store."""
from __future__ import annotations

import json
import threading
from pathlib import Path

import pytest

from vibe_widget.utils.widget_store import WidgetStore, build_data_signature


def _signature(columns, rows=100, kinds=None):
    kinds = kinds or ["int64"] * len(columns)
    return {
        "shape": [rows, len(columns)],
        "columns": [str(c) for c in columns],
        "dtypes": [[str(c), k] for c, k in zip(columns, kinds)],
    }


def test_duplicate_columns_keep_distinct_dtypes(tmp_path: Path) -> None:
    store = WidgetStore(tmp_path)
    _save(store, data_signature=_signature(["a", "a"], kinds=["int64", "object"]))

    assert _lookup(store, data_signature=_signature(["a", "a"], kinds=["int64", "object"])) is not None
    assert _lookup(store, data_signature=_signature(["a", "a"], kinds=["int64", "int64"])) is None


def test_build_data_signature_stringifies_columns() -> None:
    pd = pytest.importorskip("pandas")
    frame = pd.DataFrame([[1, 2.0, 3]], columns=[("x", "y"), 7, ("x", "y")])
    signature = build_data_signature(frame)

    assert signature["columns"] == ["('x', 'y')", "7", "('x', 'y')"]
    assert signature["dtypes"] == [
        ["('x', 'y')", "int64"], ["7", "float64"], ["('x', 'y')", "int64"],
    ]
    assert signature["shape"] == [1, 3]


def _save(store, **overrides):
    kwargs = {
        "widget_code": "export function App() {}",
        "description": "scatter plot of sales",
        "var_name": "scatter_plot",
        "data_signature": _signature(["a", "b"]),
        "model": "test-model",
        "exports": None,
        "imports_serialized": None,
    }
    kwargs.update(overrides)
    return store.save(**kwargs)


def _lookup(store, **overrides):
    kwargs = {
        "description": "scatter plot of sales",
        "var_name": "scatter_plot",
        "data_signature": _signature(["a", "b"]),
        "exports": None,
        "imports_serialized": None,
        "theme_description": None,
    }
    kwargs.update(overrides)
    return store.lookup(**kwargs)


def test_save_then_lookup_hits(tmp_path: Path) -> None:
    store = WidgetStore(tmp_path)
    saved = _save(store)

    found = _lookup(store)
    assert found is not None
    assert found["cache_key"] == saved["cache_key"]
    assert store.load_widget_code(found) == "export function App() {}"
    assert found["file_name"] == f"scatter_plot__{saved['cache_key'][:10]}.js"


def test_column_rename_with_same_shape_misses(tmp_path: Path) -> None:
    store = WidgetStore(tmp_path)
    _save(store)

    assert _lookup(store, data_signature=_signature(["a", "renamed"])) is None
    # Row count is deliberately not part of the key.
    assert _lookup(store, data_signature=_signature(["a", "b"], rows=999)) is not None


def test_lookup_follows_only_its_own_revision_chain(tmp_path: Path) -> None:
    store = WidgetStore(tmp_path)
    first = _save(store, description="scatter plot of sales")
    _save(store, description="bar chart of revenue", widget_code="export function Bar() {}")

    found = _lookup(store, description="scatter plot of sales")
    assert found is not None
    assert found["cache_key"] == first["cache_key"]

    revised = _save(
        store,
        description="scatter plot of sales, larger dots",
        widget_code="export function Revised() {}",
        revision_parent=first["cache_key"],
    )
    followed = _lookup(store, description="scatter plot of sales")
    assert followed is not None
    assert followed["cache_key"] == revised["cache_key"]
    assert followed["_original_cache_key"] == first["cache_key"]


def test_two_instances_do_not_lose_entries(tmp_path: Path) -> None:
    first = WidgetStore(tmp_path)
    second = WidgetStore(tmp_path)

    a = _save(first)
    b = _save(second)
    assert a["file_name"] == b["file_name"]

    _save(second, var_name="bar_chart", description="bar chart of revenue")

    third = WidgetStore(tmp_path)
    names = {e["var_name"] for e in third.all_entries()}
    assert names == {"scatter_plot", "bar_chart"}
    for entry in third.all_entries():
        assert third.load_widget_code(entry)


def test_concurrent_saves_from_separate_stores(tmp_path: Path) -> None:
    def worker(n: int) -> None:
        WidgetStore(tmp_path).save(
            widget_code=f"export const n = {n};",
            description=f"widget number {n}",
            var_name=f"widget_{n}",
            data_signature=_signature(["a"]),
            model="test-model",
            exports=None,
            imports_serialized=None,
        )

    threads = [threading.Thread(target=worker, args=(n,)) for n in (1, 2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    entries = WidgetStore(tmp_path).all_entries()
    assert len(entries) == 2
    assert {e["var_name"] for e in entries} == {"widget_1", "widget_2"}


def test_migration_from_v3_index(tmp_path: Path) -> None:
    widgets_dir = tmp_path / ".vibewidget" / "widgets"
    index_dir = tmp_path / ".vibewidget" / "index"
    widgets_dir.mkdir(parents=True)
    index_dir.mkdir(parents=True)
    (widgets_dir / "legacy_plot_20200101_000000_abcdef.js").write_text("legacy code", encoding="utf-8")
    (index_dir / "widgets.json").write_text(
        json.dumps({
            "schema_version": 3,
            "widgets": {
                "legacy_plot": [{
                    "created_at": "2020-01-01T00:00:00+00:00",
                    "file_name": "legacy_plot_20200101_000000_abcdef.js",
                    "cache_key": "0123456789abcdef",
                    "description": "legacy plot",
                    "data_shape": [10, 2],
                }],
                "missing_file": [{
                    "created_at": "2020-01-01T00:00:00+00:00",
                    "file_name": "gone.js",
                    "cache_key": "ffff",
                }],
            },
        }),
        encoding="utf-8",
    )

    store = WidgetStore(tmp_path)

    assert not (index_dir / "widgets.json").exists()
    assert not index_dir.exists()
    entries = store.all_entries()
    assert len(entries) == 1
    entry = entries[0]
    assert entry["file_name"] == "legacy_plot__0123456789.js"
    assert entry["data_signature"]["shape"] == [10, 2]
    assert "data_shape" not in entry
    assert store.load_widget_code(entry) == "legacy code"


def test_load_by_id(tmp_path: Path) -> None:
    store = WidgetStore(tmp_path)
    saved = _save(store)

    by_name = store.load_by_id("scatter_plot")
    assert by_name is not None and by_name[0]["cache_key"] == saved["cache_key"]

    by_prefix = store.load_by_id(saved["cache_key"][:8])
    assert by_prefix is not None and by_prefix[0]["cache_key"] == saved["cache_key"]

    assert store.load_by_id("abc") is None
    assert store.load_by_id("nope_not_here") is None


def test_load_by_id_ambiguous_prefix_returns_none(tmp_path: Path) -> None:
    store = WidgetStore(tmp_path)
    _save(store)
    entry = store.all_entries()[0]

    clone = dict(entry)
    clone.pop("_index")
    clone["cache_key"] = entry["cache_key"][:6] + "f" * 58
    clone["var_name"] = "other_plot"
    clone["file_name"] = "other_plot__" + clone["cache_key"][:10] + ".js"
    (store.widgets_dir / clone["file_name"]).write_text("code", encoding="utf-8")
    (store.widgets_dir / (Path(clone["file_name"]).stem + ".json")).write_text(
        json.dumps(clone), encoding="utf-8"
    )

    assert store.load_by_id(entry["cache_key"][:6]) is None


def test_find_entry_for_path(tmp_path: Path) -> None:
    store = WidgetStore(tmp_path)
    saved = _save(store)

    found = store.find_entry_for_path(store.widgets_dir / saved["file_name"])
    assert found is not None and found["cache_key"] == saved["cache_key"]
    assert store.find_entry_for_path(tmp_path / "elsewhere.js") is None


def test_clear_for_widget(tmp_path: Path) -> None:
    store = WidgetStore(tmp_path)
    saved = _save(store)
    _save(store, var_name="bar_chart", description="bar chart of revenue")

    assert store.clear_for_widget(cache_key=saved["cache_key"]) == 1
    assert store.list_var_names() == ["bar_chart"]
    assert store.clear_for_widget(var_name="bar_chart") == 1
    assert store.all_entries() == []
    assert store.clear_for_widget() == 0


def test_gitignore_written_once(tmp_path: Path) -> None:
    WidgetStore(tmp_path)
    gitignore = tmp_path / ".vibewidget" / ".gitignore"
    assert gitignore.read_text(encoding="utf-8") == "bundles/\npackages/\nsandbox/\naudits/\n"

    gitignore.write_text("custom/\n", encoding="utf-8")
    WidgetStore(tmp_path)
    assert gitignore.read_text(encoding="utf-8") == "custom/\n"


def test_provenance_records_version(tmp_path: Path) -> None:
    from vibe_widget import __version__

    store = WidgetStore(tmp_path)
    saved = _save(store, provenance={"base_url": "https://example.test/v1", "temperature": 0.5})

    assert saved["provenance"]["base_url"] == "https://example.test/v1"
    assert saved["provenance"]["temperature"] == 0.5
    assert saved["provenance"]["vibe_widget_version"] == __version__


def test_lookup_follows_revisions(tmp_path: Path) -> None:
    store = WidgetStore(tmp_path)
    original = _save(store)
    _save(
        store,
        widget_code="export function App2() {}",
        description="scatter plot of sales with tooltips",
        revision_parent=original["cache_key"],
    )

    followed = _lookup(store)
    assert followed is not None
    assert followed["_original_cache_key"] == original["cache_key"]
    assert followed["description"] == "scatter plot of sales with tooltips"

    exact = _lookup(store, follow_revisions=False)
    assert exact is not None and exact["cache_key"] == original["cache_key"]


def test_legacy_theme_dir_is_read(tmp_path: Path, monkeypatch) -> None:
    from vibe_widget.themes import ThemeRegistry

    legacy = tmp_path / ".vibewidgets" / "themes"
    legacy.mkdir(parents=True)
    (legacy / "oldtheme.json").write_text(
        json.dumps({"name": "oldtheme", "description": "a saved legacy theme", "prompt": ""}),
        encoding="utf-8",
    )
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    monkeypatch.setattr(ThemeRegistry, "_instance", None)

    registry = ThemeRegistry()
    assert registry.get("oldtheme").description == "a saved legacy theme"
