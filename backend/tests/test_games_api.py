import asyncio

import httpx
import pytest

from scenariolab_api.main import app
from scenariolab_api.scenarios.startup_survival import STARTUP_SURVIVAL
from scenariolab_api.schemas import GameStartResponse, GameTurnResponse


async def post(path: str, body: dict[str, object]) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.post(path, json=body)


def start_body(seed: int | None = 42) -> dict[str, object]:
    body: dict[str, object] = {"scenario_id": "startup-survival"}
    if seed is not None:
        body["seed"] = seed
    return body


def turn_body(
    action_id: str,
    history: list[str] | None = None,
    *,
    seed: int = 42,
) -> dict[str, object]:
    return {
        "scenario_id": "startup-survival",
        "scenario_version": STARTUP_SURVIVAL.version,
        "seed": seed,
        "action_history": history or [],
        "action_id": action_id,
    }


def test_start_game_returns_initial_state_actions_and_display_metadata() -> None:
    response = asyncio.run(post("/api/games/start", start_body()))

    assert response.status_code == 200
    result = GameStartResponse.model_validate(response.json())
    assert result.scenario_id == "startup-survival"
    assert result.scenario_version == "1.0.0"
    assert result.seed == 42
    assert result.state.metric_values["cash"] == 15_000_000
    assert result.state.metric_values["monthly-revenue"] == 1_500_000
    assert result.state.metric_values["monthly-expenses"] == 4_500_000
    assert result.state.decision_history == ()
    assert {action.action_id for action in result.available_actions} == {
        "invest-in-marketing",
        "improve-the-product",
        "reduce-operating-expenses",
    }
    assert result.scenario.objective == STARTUP_SURVIVAL.metadata.objective
    assert [metric.metric_id for metric in result.scenario.metrics] == [
        metric.metric_id for metric in STARTUP_SURVIVAL.metrics
    ]


def test_start_game_generates_seed_when_omitted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("scenariolab_api.routes.games.secrets.randbits", lambda _: 987_654)

    response = asyncio.run(post("/api/games/start", start_body(seed=None)))

    assert response.status_code == 200
    assert response.json()["seed"] == 987_654
    assert response.json()["state"]["seed"]["seed"] == 987_654


def test_turn_executes_engine_and_returns_authoritative_history() -> None:
    response = asyncio.run(
        post(
            "/api/games/turn",
            turn_body("reduce-operating-expenses"),
        )
    )

    assert response.status_code == 200
    result = GameTurnResponse.model_validate(response.json())
    assert result.state.current_turn == 2
    assert result.state.metric_values["cash"] == 12_750_000
    assert result.state.metric_values["monthly-expenses"] == 3_750_000
    assert result.action_history == ("reduce-operating-expenses",)
    assert result.turn_result.completed_turn_index == 1
    assert result.turn_result.selected_action.action_id == "reduce-operating-expenses"
    assert result.turn_result.previous_state.metric_values["cash"] == 15_000_000
    assert len(result.state.decision_history) == 1


def test_seeded_requests_are_reproducible() -> None:
    body = turn_body(
        "reduce-operating-expenses",
        ["improve-the-product", "reduce-operating-expenses"],
        seed=2026,
    )

    first = asyncio.run(post("/api/games/turn", body))
    second = asyncio.run(post("/api/games/turn", body))

    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()


def test_three_turn_progression_returns_expected_metrics_and_event() -> None:
    history: list[str] = []
    results: list[GameTurnResponse] = []
    for _ in range(3):
        response = asyncio.run(
            post(
                "/api/games/turn",
                turn_body("reduce-operating-expenses", history),
            )
        )
        assert response.status_code == 200
        result = GameTurnResponse.model_validate(response.json())
        results.append(result)
        history = list(result.action_history)

    assert [result.state.metric_values["cash"] for result in results] == [
        12_750_000,
        11_250_000,
        10_500_000,
    ]
    assert history == ["reduce-operating-expenses"] * 3
    assert results[2].turn_result.triggered_event is not None
    assert results[2].turn_result.triggered_event.event_id == "competitor-price-cut"
    assert results[2].state.metric_values["monthly-revenue"] == 1_250_000


def test_unknown_and_planned_scenarios_are_rejected() -> None:
    unknown = asyncio.run(
        post("/api/games/start", {"scenario_id": "not-registered", "seed": 1})
    )
    planned = asyncio.run(
        post("/api/games/start", {"scenario_id": "space-colony", "seed": 1})
    )

    assert unknown.status_code == 404
    assert unknown.json()["detail"]["code"] == "scenario_not_found"
    assert planned.status_code == 409
    assert planned.json()["detail"]["code"] == "scenario_not_available"


def test_unknown_new_action_is_rejected_with_structured_error() -> None:
    response = asyncio.run(
        post("/api/games/turn", turn_body("unknown-action"))
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_action"


@pytest.mark.parametrize(
    "history",
    [
        ["unknown-action"],
        ["reduce-operating-expenses"] * 5,
        ["invest-in-marketing"] * 13,
    ],
)
def test_invalid_replay_history_is_rejected(history: list[str]) -> None:
    response = asyncio.run(
        post(
            "/api/games/turn",
            turn_body("invest-in-marketing", history),
        )
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_replay_history"


def test_scenario_version_mismatch_is_rejected() -> None:
    body = turn_body("invest-in-marketing")
    body["scenario_version"] = "9.9.9"

    response = asyncio.run(post("/api/games/turn", body))

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "scenario_version_mismatch"


def test_terminal_game_rejects_thirteenth_turn() -> None:
    winning_history = [
        *(["reduce-operating-expenses"] * 4),
        *(["invest-in-marketing"] * 8),
    ]

    response = asyncio.run(
        post(
            "/api/games/turn",
            turn_body("invest-in-marketing", winning_history),
        )
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "game_already_complete"


def test_game_requests_do_not_mutate_scenario_definition() -> None:
    before = STARTUP_SURVIVAL.model_dump(mode="json")

    start_response = asyncio.run(post("/api/games/start", start_body()))
    turn_response = asyncio.run(
        post(
            "/api/games/turn",
            turn_body("reduce-operating-expenses"),
        )
    )

    assert start_response.status_code == turn_response.status_code == 200
    assert STARTUP_SURVIVAL.model_dump(mode="json") == before


def test_malformed_game_request_uses_structured_error_contract() -> None:
    response = asyncio.run(
        post(
            "/api/games/start",
            {"scenario_id": "startup-survival", "seed": "not-an-integer"},
        )
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": {
            "code": "invalid_request",
            "message": "Request data did not match the expected contract.",
        }
    }
