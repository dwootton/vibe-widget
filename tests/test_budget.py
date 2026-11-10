"""LLM spend ledger and budget guard (vw.config(budget_usd=...), vw.spend())."""

from __future__ import annotations

import warnings
from types import SimpleNamespace

import httpx
import openai
import pytest

import vibe_widget as vw
from vibe_widget import tracing
from vibe_widget.budget import BudgetExceeded, cost_from_usage, ledger
from vibe_widget.llm.providers.openai_compat import OpenAICompatProvider

pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def offline_client(monkeypatch):
    """Construct providers without a real client; each test installs a stub."""
    monkeypatch.setattr(
        "vibe_widget.llm.providers.openai_compat.OpenAI", lambda **kwargs: SimpleNamespace()
    )


@pytest.fixture(autouse=True)
def fresh_ledger():
    ledger.__init__()
    yield ledger
    ledger.__init__()


class StubCompletions:
    """Stands in for client.chat.completions; counts calls, returns a fixed cost."""

    def __init__(self, cost=0.4, error=None):
        self.calls = 0
        self.cost = cost
        self.error = error

    def create(self, **params):
        self.calls += 1
        if self.error is not None:
            raise self.error
        usage = SimpleNamespace(prompt_tokens=100, completion_tokens=50)
        if self.cost is not None:
            usage.cost = self.cost
        if params.get("stream"):
            return iter([
                SimpleNamespace(choices=[], usage=None),
                SimpleNamespace(choices=[], usage=usage),
            ])
        message = SimpleNamespace(content="ok")
        return SimpleNamespace(choices=[SimpleNamespace(message=message)], usage=usage)


def provider_with(stub: StubCompletions, base_url="https://openrouter.ai/api/v1"):
    provider = OpenAICompatProvider("openai/gpt-6-luna", api_key="test", base_url=base_url)
    provider.client = SimpleNamespace(chat=SimpleNamespace(completions=stub))
    return provider


def ask(provider):
    return provider._complete("hi", temperature=0.0, clean=False)


def test_cost_from_usage_variants():
    assert cost_from_usage(SimpleNamespace(cost=0.25)) == 0.25
    assert cost_from_usage(SimpleNamespace(model_extra={"cost": "0.5"})) == 0.5
    assert cost_from_usage({"cost": 1}) == 1.0
    assert cost_from_usage(SimpleNamespace(prompt_tokens=3)) is None
    assert cost_from_usage(None) is None


def test_requests_are_metered():
    provider = provider_with(StubCompletions(cost=0.4))
    ask(provider)
    ask(provider)
    status = vw.spend()
    assert status["spent_usd"] == pytest.approx(0.8)
    assert status["requests"] == 2
    assert status["limit_usd"] is None


def test_streamed_requests_are_metered():
    provider = provider_with(StubCompletions(cost=0.3))
    list(provider._create({"model": provider.model, "messages": []}, stream=True))
    assert vw.spend()["spent_usd"] == pytest.approx(0.3)


def test_budget_blocks_the_next_request_once_spent():
    stub = StubCompletions(cost=0.4)
    provider = provider_with(stub)
    vw.config(budget_usd=1.0)
    try:
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            for _ in range(3):  # 0.4, 0.8 (warns at 80%), 1.2 (in flight when it crossed)
                ask(provider)
        assert any("of the $1.00 budget" in str(w.message) for w in caught)
        with pytest.raises(BudgetExceeded) as info:
            ask(provider)
        assert info.value.kind == "budget"
        assert stub.calls == 3  # the blocked request never reached the API
        assert vw.spend()["remaining_usd"] == 0.0
    finally:
        vw.config(budget_usd=None)
    ask(provider)  # lifting the budget lets requests through again


def test_unpriced_hosts_warn_when_a_budget_is_set():
    provider = provider_with(StubCompletions(cost=None), base_url="http://localhost:11434/v1")
    vw.config(budget_usd=1.0)
    try:
        with pytest.warns(UserWarning, match="did not report a cost"):
            ask(provider)
        assert vw.spend()["unpriced_requests"] == 1
        assert vw.spend()["spent_usd"] == 0.0
    finally:
        vw.config(budget_usd=None)


@pytest.mark.parametrize("bad", [0, -1, "5", True])
def test_invalid_budgets_are_rejected(bad):
    with pytest.raises(ValueError):
        vw.config(budget_usd=bad)


def test_exhausted_key_limit_is_a_quota_error():
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    body = {"error": {"message": "Key limit exceeded", "metadata": {"limit_source": "openrouter_key_limit"}}}
    error = openai.APIStatusError(
        "Key limit exceeded", response=httpx.Response(402, request=request), body=body
    )
    provider = provider_with(StubCompletions(error=error))
    with pytest.raises(Exception) as info:
        ask(provider)
    assert getattr(info.value, "kind", None) == "quota"
    assert "credit limit on this openrouter.ai API key is used up" in str(info.value)


def test_each_request_is_announced_to_the_trace_hook():
    seen = []
    tracing.set_listener(lambda kind, **fields: seen.append((kind, fields["payload"])))
    try:
        ask(provider_with(StubCompletions(cost=0.1)))
    finally:
        tracing.set_listener(None)
    kind, payload = seen[-1]
    assert kind == "usage.request"
    assert payload["cost_usd"] == 0.1
    assert payload["model"] == "openai/gpt-6-luna"
    assert payload["prompt_tokens"] == 100
