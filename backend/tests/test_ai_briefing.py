import asyncio
import json
from typing import Any

import httpx
import pytest
from pydantic import SecretStr, ValidationError

from scenariolab_api.ai.grounding import build_briefing_context
from scenariolab_api.ai.models import BriefingContent, BriefingContext, BriefingResponse
from scenariolab_api.ai.provider import OpenAICompatibleProvider, ProviderError
from scenariolab_api.ai.service import BriefingService, create_briefing_service
from scenariolab_api.config import Settings
from scenariolab_api.engine import initialize_game, resolve_turn
from scenariolab_api.main import create_app
from scenariolab_api.scenarios.startup_survival import STARTUP_SURVIVAL

LIVE_CONTENT = {
    "headline": "Lean Operations Meet a Competitive Shock",
    "situation_summary": "The company tightened spending as market pressure intensified.",
    "consequence_explanation": (
        "Cash and operating expenses decreased while team sentiment softened."
    ),
    "strategic_insight": (
        "Protect morale and customer trust while preserving the improved cost structure."
    ),
    "next_turn_teaser": (
        "A future turn may test whether the leaner plan can support renewed growth."
    ),
}


def briefing_body(history: list[str] | None = None) -> dict[str, object]:
    return {
        "scenario_id": "startup-survival",
        "scenario_version": STARTUP_SURVIVAL.version,
        "seed": 42,
        "action_history": (
            ["reduce-operating-expenses"] if history is None else history
        ),
    }


async def post(
    path: str,
    body: dict[str, object],
    *,
    application: Any | None = None,
) -> httpx.Response:
    if application is None:
        application = create_app(Settings(_env_file=None, ai_api_key=None))
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.post(path, json=body)


def context_for_first_turn() -> BriefingContext:
    state = initialize_game(STARTUP_SURVIVAL, 42)
    result = resolve_turn(
        STARTUP_SURVIVAL,
        state,
        "reduce-operating-expenses",
    )
    return build_briefing_context(STARTUP_SURVIVAL, result)


def context_for_third_turn() -> BriefingContext:
    state = initialize_game(STARTUP_SURVIVAL, 42)
    result = None
    for _ in range(3):
        result = resolve_turn(
            STARTUP_SURVIVAL,
            state,
            "reduce-operating-expenses",
        )
        state = result.new_state
    assert result is not None
    return build_briefing_context(STARTUP_SURVIVAL, result)


def provider_with_transport(
    transport: httpx.BaseTransport,
) -> OpenAICompatibleProvider:
    return OpenAICompatibleProvider(
        api_key="test-secret",
        model="test-model",
        base_url="https://provider.example/v1",
        timeout_seconds=1,
        max_response_tokens=300,
        transport=transport,
    )


def provider_response(content: object = LIVE_CONTENT) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "id": "completion-id",
            "choices": [{"message": {"role": "assistant", "content": json.dumps(content)}}],
        },
    )


class FakeProvider:
    def __init__(self, result: BriefingContent | None = None) -> None:
        self.result = result or BriefingContent.model_validate(LIVE_CONTENT)
        self.calls = 0
        self.contexts: list[BriefingContext] = []

    def generate_briefing(self, context: BriefingContext) -> BriefingContent:
        self.calls += 1
        self.contexts.append(context)
        return self.result


class FailingProvider:
    def generate_briefing(self, _context: BriefingContext) -> BriefingContent:
        raise ProviderError("sanitized failure")


def test_briefing_content_requires_exact_bounded_structured_fields() -> None:
    assert BriefingContent.model_validate(LIVE_CONTENT).headline == LIVE_CONTENT["headline"]

    with pytest.raises(ValidationError):
        BriefingContent.model_validate({"headline": "Incomplete"})
    with pytest.raises(ValidationError):
        BriefingContent.model_validate({**LIVE_CONTENT, "unexpected": "field"})
    with pytest.raises(ValidationError):
        BriefingContent.model_validate({**LIVE_CONTENT, "headline": "x" * 141})


def test_provider_prompt_is_grounded_in_authoritative_turn_result() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        return provider_response()

    briefing = provider_with_transport(
        httpx.MockTransport(handler),
    ).generate_briefing(context_for_third_turn())

    assert briefing.headline == LIVE_CONTENT["headline"]
    messages = captured["messages"]
    assert isinstance(messages, list)
    prompt = messages[1]["content"]
    assert "Startup Survival" in prompt
    assert "Keep the startup alive" in prompt
    assert '"completed_turn":3' in prompt
    assert '"selected_action_id":"reduce-operating-expenses"' in prompt
    assert '"event_id":"competitor-price-cut"' in prompt
    assert '"metric_id":"cash"' in prompt
    assert '"metric_id":"monthly-revenue"' in prompt
    assert '"game_status":"active"' in prompt
    assert "HYPOTHETICAL_FUTURE" in prompt
    assert captured["max_tokens"] == 300


def test_successful_mocked_provider_response_is_returned_and_cached() -> None:
    provider = FakeProvider()
    service = BriefingService(provider)
    context = context_for_first_turn()

    first = service.generate(context, caller_key="tester")
    second = service.generate(context, caller_key="tester")

    assert first.source == second.source == "live"
    assert first.headline == LIVE_CONTENT["headline"]
    assert provider.calls == 1


def test_provider_call_limit_falls_back_without_an_extra_provider_call() -> None:
    provider = FakeProvider()
    service = BriefingService(provider, calls_per_minute=1)

    first = service.generate(context_for_first_turn(), caller_key="tester")
    second = service.generate(context_for_third_turn(), caller_key="tester")

    assert first.source == "live"
    assert second.source == "fallback"
    assert provider.calls == 1


def test_missing_provider_configuration_returns_deterministic_fallback() -> None:
    service = create_briefing_service(Settings(_env_file=None, ai_api_key=None))

    result = service.generate(context_for_first_turn())

    assert result.source == "fallback"
    assert "Reduce Operating Expenses" in result.headline
    assert "Cash decreased" in result.consequence_explanation


def test_provider_timeout_returns_fallback() -> None:
    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    service = BriefingService(
        provider_with_transport(httpx.MockTransport(timeout)),
    )

    assert service.generate(context_for_first_turn()).source == "fallback"


def test_provider_http_failure_returns_fallback() -> None:
    transport = httpx.MockTransport(lambda _request: httpx.Response(429, json={"error": "rate"}))
    service = BriefingService(provider_with_transport(transport))

    assert service.generate(context_for_first_turn()).source == "fallback"


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, content=b"not-json"),
        httpx.Response(
            200,
            json={"choices": [{"message": {"content": "not-json"}}]},
        ),
        provider_response({"headline": "missing required fields"}),
        provider_response({**LIVE_CONTENT, "headline": "Unexpected claim 999999"}),
    ],
)
def test_invalid_provider_json_or_content_returns_fallback(
    response: httpx.Response,
) -> None:
    service = BriefingService(
        provider_with_transport(httpx.MockTransport(lambda _request: response)),
    )

    assert service.generate(context_for_first_turn()).source == "fallback"


def test_briefing_endpoint_returns_mocked_live_response(
) -> None:
    provider = FakeProvider()
    application = create_app(Settings(_env_file=None, ai_api_key=None))
    application.state.briefing_service = BriefingService(provider)

    response = asyncio.run(
        post("/api/ai/briefing", briefing_body(), application=application)
    )

    assert response.status_code == 200
    result = BriefingResponse.model_validate(response.json())
    assert result.source == "live"
    assert provider.calls == 1
    context = provider.contexts[0]
    assert context.completed_turn == 1
    assert context.selected_action_id == "reduce-operating-expenses"
    assert context.current_metrics[0].value == 12_750_000


def test_briefing_endpoint_rejects_unsupported_scenario() -> None:
    body = briefing_body()
    body["scenario_id"] = "space-colony"

    response = asyncio.run(post("/api/ai/briefing", body))

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "scenario_not_available"


def test_briefing_endpoint_rejects_invalid_replay_before_provider_call(
) -> None:
    provider = FakeProvider()
    application = create_app(Settings(_env_file=None, ai_api_key=None))
    application.state.briefing_service = BriefingService(provider)

    response = asyncio.run(
        post(
            "/api/ai/briefing",
            briefing_body(["unknown-action"]),
            application=application,
        )
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_replay_history"
    assert provider.calls == 0


def test_briefing_endpoint_rejects_history_without_completed_turns() -> None:
    response = asyncio.run(post("/api/ai/briefing", briefing_body([])))

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "no_completed_turns"


def test_briefing_replay_does_not_mutate_definition_or_engine_state() -> None:
    before_definition = STARTUP_SURVIVAL.model_dump(mode="json")
    initial_state = initialize_game(STARTUP_SURVIVAL, 42)
    before_state = initial_state.model_dump(mode="json")

    response = asyncio.run(post("/api/ai/briefing", briefing_body()))

    assert response.status_code == 200
    assert response.json()["source"] == "fallback"
    assert STARTUP_SURVIVAL.model_dump(mode="json") == before_definition
    assert initial_state.model_dump(mode="json") == before_state


def test_provider_failure_fallback_does_not_expose_secrets(
) -> None:
    secret = "sk-test-never-return-this"
    configured_app = create_app(
        Settings(
            _env_file=None,
            ai_api_key=SecretStr(secret),
            ai_model="test-model",
            ai_base_url="https://provider.example/v1",
        )
    )
    configured_app.state.briefing_service = BriefingService(FailingProvider())

    response = asyncio.run(
        post("/api/ai/briefing", briefing_body(), application=configured_app)
    )

    assert response.status_code == 200
    assert response.json()["source"] == "fallback"
    assert secret not in response.text
    assert "sanitized failure" not in response.text
