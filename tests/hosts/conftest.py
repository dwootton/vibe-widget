import pandas as pd
import pytest

import vibe_widget as vw
from vibe_widget.hosts.bridge import HostSession


@pytest.fixture(autouse=True)
def _fake_provider(monkeypatch):
    """Every test in this directory uses the deterministic fake provider -
    see `vibe_widget.llm.fake`. Never the network, never an API key."""
    monkeypatch.setenv("VIBE_PROVIDER", "fake")


@pytest.fixture
def sample_df():
    return pd.DataFrame({"x": [1, 2, 3], "y": [4, 5, 6]})


def make_widget(df, **kwargs):
    """Construct a headless widget the way `session_api.create_session`
    does, without going through it - useful for bridge-only tests that
    don't want session_api's session-id/HostSession wiring."""
    kwargs.setdefault("display", False)
    kwargs.setdefault("cache", False)
    handle = vw.create("test widget", df, **kwargs)
    widget = getattr(handle, "_widget", None) or handle
    return widget


@pytest.fixture
def widget(sample_df):
    return make_widget(sample_df)


@pytest.fixture
def bridge(widget):
    session = HostSession(widget)
    yield session
    if not session.closed:
        session.close()
