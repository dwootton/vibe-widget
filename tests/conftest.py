"""Shared test fixtures: no real API keys, no outbound network."""

from __future__ import annotations

from typing import Any

import pytest


@pytest.fixture(autouse=True)
def dummy_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Give every test a fake key so config resolution never reads a real one."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key-not-real")
    monkeypatch.delenv("VIBE_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail loudly instead of reaching the network from a unit test."""

    def _blocked(*args: Any, **kwargs: Any) -> Any:
        raise AssertionError("network access is not allowed in tests")

    import requests

    monkeypatch.setattr(requests, "get", _blocked)
    monkeypatch.setattr(requests, "post", _blocked)
    # Providers bind `from openai import OpenAI` at import time, so patching
    # openai.OpenAI would never fire. Patch the name each module actually calls.
    monkeypatch.setattr(
        "vibe_widget.llm.providers.openai_compat.OpenAI", _blocked, raising=False
    )
