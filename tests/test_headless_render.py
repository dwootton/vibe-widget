"""Headless execution detection: Quarto render and nbclient leave no frontend to connect."""

from __future__ import annotations

import sys

import pytest

from vibe_widget.core.widget import html_script_safe, is_headless_render


def test_quarto_render_is_headless(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sys, "argv", ["ipykernel_launcher.py", "-f", "conn.json"])
    monkeypatch.setenv("QUARTO_DOCUMENT_PATH", "/tmp/doc.qmd")
    assert is_headless_render() is True


def test_nbclient_history_flag_is_headless(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("QUARTO_DOCUMENT_PATH", raising=False)
    monkeypatch.setattr(
        sys,
        "argv",
        ["ipykernel_launcher.py", "-f", "conn.json", "--HistoryManager.hist_file=:memory:"],
    )
    assert is_headless_render() is True


def test_interactive_kernel_is_not_headless(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("QUARTO_DOCUMENT_PATH", raising=False)
    monkeypatch.setattr(sys, "argv", ["ipykernel_launcher.py", "-f", "conn.json"])
    assert is_headless_render() is False


def test_html_comment_in_bundle_is_terminated() -> None:
    """A bundle that opens an HTML comment must close it after the last "<script"."""
    bundle = 'const a = /<!--/g; el.innerHTML = "<script><\\/script>";'
    guarded = html_script_safe(bundle)
    assert guarded.rindex("-->") > guarded.rindex("<script")
    assert guarded.endswith("/* --> --> */\n")


def test_html_script_safe_keeps_empty_code_empty() -> None:
    assert html_script_safe("") == ""
