"""Tests for the OpenAI-compatible provider. No network access."""

from types import SimpleNamespace

try:
    import httpx
except ModuleNotFoundError:  # openai >= 3 depends on httpx2
    import httpx2 as httpx
import openai
import pytest

from vibe_widget.llm.providers import openai_compat
from vibe_widget.llm.providers.base import ProviderError
from vibe_widget.llm.providers.openai_compat import OpenAICompatProvider
from vibe_widget.llm.providers.openrouter_provider import OpenRouterProvider


class _Completions:
    def __init__(self, outbox):
        self.outbox = list(outbox)
        self.calls = []

    def create(self, **params):
        self.calls.append(params)
        item = self.outbox.pop(0) if self.outbox else _message("")
        if isinstance(item, Exception):
            raise item
        return item


class _StubClient:
    """Stand-in for openai.OpenAI that records constructor and request kwargs."""

    instances = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.completions = _Completions([])
        self.chat = SimpleNamespace(completions=self.completions)
        _StubClient.instances.append(self)


def _message(content, usage=None, tool_calls=None):
    choice = SimpleNamespace(
        message=SimpleNamespace(role="assistant", content=content, tool_calls=tool_calls),
        finish_reason="stop",
    )
    return SimpleNamespace(choices=[choice], usage=usage)


def _usage(prompt_tokens, completion_tokens):
    return SimpleNamespace(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens)


def _chunk(text=None, usage=None):
    if text is None:
        return SimpleNamespace(choices=[], usage=usage)
    delta = SimpleNamespace(content=text, role="assistant", tool_calls=None)
    return SimpleNamespace(
        choices=[SimpleNamespace(delta=delta, finish_reason=None)], usage=usage
    )


def _status_error(cls, status):
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    return cls("boom", response=httpx.Response(status, request=request), body=None)


@pytest.fixture
def stub(monkeypatch):
    """Patch the openai client and return a factory that queues canned responses."""
    _StubClient.instances.clear()
    monkeypatch.setattr(openai_compat, "OpenAI", _StubClient)
    for name in ("VIBE_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "VIBE_BASE_URL"):
        monkeypatch.delenv(name, raising=False)

    def make(outbox, **kwargs):
        provider = OpenAICompatProvider("m", "key", **kwargs)
        provider.client.completions.outbox = list(outbox)
        return provider

    return make


def test_base_url_and_timeout_reach_the_client(stub):
    provider = stub([], base_url="https://example.test/v1", timeout=7.5)

    assert provider.client.kwargs["base_url"] == "https://example.test/v1"
    assert provider.client.kwargs["timeout"] == 7.5
    assert provider.host == "example.test"


def test_openrouter_preset_keeps_positional_signature(stub):
    provider = OpenRouterProvider("model-id", "key")

    assert provider.base_url == openai_compat.OPENROUTER_BASE_URL
    assert provider.client.kwargs["api_key"] == "key"


def test_missing_api_key_raises_auth_provider_error(stub):
    with pytest.raises(ProviderError) as excinfo:
        OpenAICompatProvider("m")

    assert excinfo.value.kind == "auth"
    assert "VIBE_API_KEY" in str(excinfo.value)


def test_usage_accumulates_across_two_calls(stub):
    provider = stub([_message("a", _usage(10, 2)), _message("b", _usage(5, 3))])

    provider.generate_text("one")
    provider.generate_text("two")

    assert provider.usage == {"prompt_tokens": 15, "completion_tokens": 5, "requests": 2}


def test_streaming_requests_usage_and_records_it(stub):
    provider = stub([[_chunk("hel"), _chunk("lo"), _chunk(usage=_usage(11, 4))]])
    seen = []

    text = provider.generate_text("prompt", progress_callback=seen.append)

    assert text == "hello"
    assert seen == ["hel", "lo"]
    params = provider.client.completions.calls[0]
    assert params["stream"] is True
    assert params["stream_options"] == {"include_usage": True}
    assert provider.usage == {"prompt_tokens": 11, "completion_tokens": 4, "requests": 1}


def test_streaming_retries_once_without_stream_options(stub):
    provider = stub([_status_error(openai.BadRequestError, 400), [_chunk("ok")]])

    assert provider.generate_text("p", progress_callback=lambda _t: None) == "ok"
    assert "stream_options" in provider.client.completions.calls[0]
    assert "stream_options" not in provider.client.completions.calls[1]


def test_no_progress_callback_takes_the_non_streaming_path(stub):
    provider = stub([_message("code")])

    provider.generate_text("p")

    assert "stream" not in provider.client.completions.calls[0]


def test_temperature_passthrough(stub):
    provider = stub([_message("x"), _message("y")], temperature=0.15)

    provider.generate_widget_code("d", {})
    provider.fix_code_error("code", "err", {})

    assert provider.client.completions.calls[0]["temperature"] == 0.15
    assert provider.client.completions.calls[1]["temperature"] == 0.3


def test_chat_completion_defaults_to_provider_temperature(stub):
    provider = stub([_message("x"), _message("y")], temperature=0.15)

    provider.chat_completion(messages=[])
    provider.chat_completion(messages=[], temperature=0.9)

    assert provider.client.completions.calls[0]["temperature"] == 0.15
    assert provider.client.completions.calls[1]["temperature"] == 0.9


@pytest.mark.parametrize(
    "exc, kind, expected",
    [
        (_status_error(openai.AuthenticationError, 401), "auth", "rejected the API key"),
        (_status_error(openai.NotFoundError, 404), "not_found", "has no model named"),
        (_status_error(openai.RateLimitError, 429), "rate_limit", "rate limiting"),
        (
            openai.APIConnectionError(
                request=httpx.Request("POST", "https://openrouter.ai/api/v1/x")
            ),
            "connection",
            "Could not reach",
        ),
        (
            openai.APITimeoutError(
                request=httpx.Request("POST", "https://openrouter.ai/api/v1/x")
            ),
            "timeout",
            "did not respond within",
        ),
        (RuntimeError("odd"), "other", "failed"),
    ],
)
def test_sdk_errors_become_provider_errors(stub, exc, kind, expected):
    provider = stub([exc])

    with pytest.raises(ProviderError) as excinfo:
        provider.generate_text("p")

    assert excinfo.value.kind == kind
    assert expected in str(excinfo.value)
    assert "openrouter.ai" in str(excinfo.value)


@pytest.mark.parametrize(
    "message, code",
    [
        ("This model's maximum context length is 8192 tokens", None),
        ("too many tokens", "context_length_exceeded"),
    ],
)
def test_context_length_overflow_is_its_own_kind(stub, message, code):
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    exc = openai.BadRequestError(
        message,
        response=httpx.Response(400, request=request),
        body={"error": {"code": code}} if code else None,
    )
    provider = stub([exc])

    with pytest.raises(ProviderError) as excinfo:
        provider.generate_text("p")

    assert excinfo.value.kind == "context_length"
    assert "simplify the request" in str(excinfo.value)
    assert "data_privacy='schema'" in str(excinfo.value)


def test_context_length_overflow_skips_the_stream_options_retry(stub):
    request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
    exc = openai.BadRequestError(
        "maximum context length exceeded",
        response=httpx.Response(400, request=request),
        body=None,
    )
    provider = stub([exc, _message("never reached")])

    with pytest.raises(ProviderError) as excinfo:
        provider.generate_text("p", progress_callback=lambda _t: None)

    assert excinfo.value.kind == "context_length"
    assert len(provider.client.completions.calls) == 1


def test_generation_service_honors_stream_false(stub):
    from vibe_widget.services.generation import GenerationService

    provider = stub([])
    service = GenerationService(provider, stream=False)

    assert service.stream is False
    assert service.orchestrator.stream is False


def test_agent_loop_uses_provider_temperature_and_skips_streaming(stub):
    from vibe_widget.llm.agentic_agents import AgentSdkOrchestrator
    from vibe_widget.llm.agents.config import resolve_agent_run_config

    provider = stub([_message("final code")], temperature=0.25)
    orchestrator = AgentSdkOrchestrator(provider, stream=False)
    run_config = resolve_agent_run_config(preset="safe", overrides=None)

    code = orchestrator._run_agent_loop(
        prompt="hi",
        progress_callback=None,
        run_config=run_config,
        context=orchestrator._build_context(run_config),
    )

    assert code == "final code"
    params = provider.client.completions.calls[0]
    assert params["temperature"] == 0.25
    assert "stream" not in params
