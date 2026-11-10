"""Study tests never use a real key, the network, or a user's .env."""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def dummy_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key-not-real")
    monkeypatch.setenv("VIBE_NO_DOTENV", "1")
    monkeypatch.setenv("VIBE_PROVIDER", "fake")
