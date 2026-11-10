"""Study budgets persist across sessions; participant keys are minted with a credit limit."""

from __future__ import annotations

import json

import pytest
from vibe_widget_study import TraceRecorder, keys
from vibe_widget_study.budget import SPEND_FILE

from vibe_widget.budget import BudgetExceeded, ledger

pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def fresh_ledger():
    ledger.__init__()
    yield
    ledger.__init__()


def spend(usd: float) -> None:
    ledger.record(model="openai/gpt-6-luna", host="openrouter.ai", cost_usd=usd)


def test_budget_survives_a_kernel_restart(tmp_path):
    first = TraceRecorder()
    first.start(tmp_path, budget_usd=1.0)
    spend(0.6)
    assert first.budget.status()["remaining_usd"] == pytest.approx(0.4)
    first.stop()
    assert ledger.limit_usd is None  # stopping lifts the study's limit

    saved = json.loads((tmp_path / SPEND_FILE).read_text())
    assert saved["budget_usd"] == 1.0
    assert saved["total_usd"] == pytest.approx(0.6)

    ledger.__init__()  # a new kernel: nothing in memory
    second = TraceRecorder()
    second.start(tmp_path)  # no budget passed: the saved one applies
    try:
        assert second.budget.budget_usd == 1.0
        assert ledger.total_usd == pytest.approx(0.6)
        spend(0.5)
        with pytest.raises(BudgetExceeded):
            ledger.check()
        status = second.budget.status()
        assert status["spent_usd"] == pytest.approx(1.1)
        assert status["this_session_usd"] == pytest.approx(0.5)
    finally:
        second.stop()


def test_spend_before_the_study_does_not_count(tmp_path):
    spend(0.9)  # earlier in the same kernel, before the study started
    rec = TraceRecorder()
    rec.start(tmp_path, budget_usd=1.0)
    try:
        ledger.check()  # still under budget
        spend(0.2)
        assert rec.budget.status()["spent_usd"] == pytest.approx(0.2)
    finally:
        rec.stop()


def test_usage_events_follow_stream_consent(tmp_path):
    rec = TraceRecorder()
    rec.start(tmp_path / "with")
    spend(0.1)
    rec.stop()
    assert any(e["kind"] == "usage.request" for e in rec.read_events())

    rec = TraceRecorder()
    rec.start(tmp_path / "without", streams=["intents"])
    spend(0.1)
    rec.stop()
    assert not any(e["kind"] == "usage.request" for e in rec.read_events())
    # the spend ledger is kept either way, so the budget still holds
    assert json.loads((tmp_path / "without" / SPEND_FILE).read_text())["total_usd"] == pytest.approx(0.1)


def test_invalid_study_budget(tmp_path):
    with pytest.raises(ValueError):
        TraceRecorder().start(tmp_path, budget_usd=-2)
    assert not (tmp_path / SPEND_FILE).exists()


class FakeResponse:
    def __init__(self, status, body):
        self.status_code = status
        self._body = body

    def json(self):
        return self._body


def test_create_participant_key(monkeypatch):
    sent = {}

    def fake_post(url, headers, json, timeout):
        sent.update(url=url, headers=headers, json=json)
        return FakeResponse(201, {"key": "sk-or-v1-secret", "data": {"hash": "abc123", "name": json["name"], "limit": 5.0}})

    monkeypatch.setattr(keys.requests, "post", fake_post)
    created = keys.create_participant_key("mgmt-key", "P07", limit_usd=5, limit_reset="monthly")
    assert created == {"key": "sk-or-v1-secret", "hash": "abc123", "name": "P07", "limit_usd": 5.0}
    assert sent["url"].endswith("/api/v1/keys")
    assert sent["headers"]["Authorization"] == "Bearer mgmt-key"
    assert sent["json"] == {"name": "P07", "limit": 5.0, "limit_reset": "monthly"}


def test_key_errors_and_validation(monkeypatch):
    monkeypatch.setattr(
        keys.requests, "post",
        lambda *a, **k: FakeResponse(401, {"error": {"message": "Invalid management key"}}),
    )
    with pytest.raises(keys.KeyManagementError, match="HTTP 401: Invalid management key"):
        keys.create_participant_key("bad", "P01", limit_usd=5)
    with pytest.raises(ValueError):
        keys.create_participant_key("mgmt", "P01", limit_usd=0)


def test_key_status_and_revoke(monkeypatch):
    monkeypatch.setattr(
        keys.requests, "get",
        lambda url, headers, timeout: FakeResponse(200, {"data": {"usage": 1.25, "limit": 5, "limit_remaining": 3.75}}),
    )
    assert keys.key_status("sk-or-v1-secret") == {"usage_usd": 1.25, "limit_usd": 5, "remaining_usd": 3.75}

    patched = {}

    def fake_patch(url, headers, json, timeout):
        patched.update(url=url, json=json)
        return FakeResponse(200, {"data": {"hash": "abc123", "disabled": True}})

    monkeypatch.setattr(keys.requests, "patch", fake_patch)
    keys.disable_key("mgmt", "abc123")
    assert patched == {"url": "https://openrouter.ai/api/v1/keys/abc123", "json": {"disabled": True}}
