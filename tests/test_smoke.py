"""Import smoke test: the package loads and its entry points answer offline."""

from __future__ import annotations

import pytest

import vibe_widget as vw
from vibe_widget.llm.providers.openai_compat import OpenAICompatProvider


def test_conftest_blocks_the_openai_client() -> None:
    with pytest.raises(AssertionError, match="network access is not allowed"):
        OpenAICompatProvider("some/model", api_key="test-key-not-real")


def test_public_api_is_importable() -> None:
    assert vw.__version__
    for name in vw.__all__:
        assert hasattr(vw, name), name


def test_config_returns_a_config() -> None:
    cfg = vw.config(model="google/gemini-3-flash-preview", temperature=0.5)
    assert isinstance(cfg, vw.Config)
    assert cfg.model == "google/gemini-3-flash-preview"
    assert cfg.temperature == 0.5


def test_themes_namespace_lists_themes() -> None:
    catalog = vw.themes()
    assert isinstance(catalog, dict)
    assert catalog
    name = sorted(catalog)[0]
    assert getattr(vw.themes, name).name == name


def test_version_matches_the_installed_distribution():
    """A hardcoded __version__ silently went stale at 0.3.2 while the wheel said 0.3.3."""
    from importlib.metadata import version

    import vibe_widget

    assert vibe_widget.__version__ == version("vibe-widget")
