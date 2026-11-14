"""Brick 9C: Cybersecurity Crisis and Space Colony on the shared engine."""

import asyncio
import random
from typing import Any

import httpx
import pytest
from pydantic import SecretStr

from scenariolab_api.config import Settings
from scenariolab_api.domain.enums import GameStatus, MetricKind
from scenariolab_api.domain.models import GameState, ScenarioDefinition
from scenariolab_api.engine import (
    EngineError,
    get_available_actions,
    initialize_game,
    resolve_turn,
)
from scenariolab_api.main import create_app
from scenariolab_api.scenarios import get_scenario_definition
from scenariolab_api.scenarios.cybersecurity_crisis import CYBERSECURITY_CRISIS
from scenariolab_api.scenarios.space_colony import SPACE_COLONY
from scenariolab_api.scenarios.startup_survival import STARTUP_SURVIVAL
from scenariolab_api.schemas import GameStartResponse, GameTurnResponse

NEW_SCENARIOS = (CYBERSECURITY_CRISIS, SPACE_COLONY)

CYBER_WIN_PATH = (
    "isolate-affected-systems",
    "isolate-affected-systems",
    "launch-threat-hunt",
    "engage-external-responders",
    "brief-stakeholders",
    "activate-backup-site",
    "engage-external-responders",
    "brief-stakeholders",
    "restore-services",
    "patch-and-harden",
    "brief-stakeholders",
    "restore-services",
)
CYBER_UNRESOLVED_PATH = (
    "brief-stakeholders",
    "brief-stakeholders",
    "isolate-affected-systems",
    "launch-threat-hunt",
    "restore-services",
    "brief-stakeholders",
    "brief-stakeholders",
    "launch-threat-hunt",
    "brief-stakeholders",
    "launch-threat-hunt",
    "engage-external-responders",
    "engage-external-responders",
)
CYBER_TAKEOVER_PATH = (
    "restore-services",
    *("engage-external-responders",) * 5,
)
SPACE_WIN_PATH = (
    "expand-hydroponics",
    "deploy-solar-arrays",
    "survey-expedition",
    "emergency-rationing",
    "crew-rest-rotation",
    "deploy-solar-arrays",
    "deploy-solar-arrays",
    "expand-hydroponics",
    "repair-oxygen-generators",
    "expand-hydroponics",
    "expand-hydroponics",
    "expand-hydroponics",
)
SPACE_UNSUSTAINABLE_PATH = (
    "crew-rest-rotation",
    "deploy-solar-arrays",
    "emergency-rationing",
    "deploy-solar-arrays",
    "survey-expedition",
    "emergency-rationing",
    "survey-expedition",
    "emergency-rationing",
    "emergency-rationing",
    "crew-rest-rotation",
    "repair-oxygen-generators",
    "habitat-maintenance",
)
SPACE_POWER_LOSS_PATH = (
    "survey-expedition",
    "survey-expedition",
    "habitat-maintenance",
    "habitat-maintenance",
    "repair-oxygen-generators",
    "repair-oxygen-generators",
)


def play(definition: ScenarioDefinition, seed: int, actions: tuple[str, ...]) -> GameState:
    state = initialize_game(definition, seed)
    for action_id in actions:
        state = resolve_turn(definition, state, action_id).new_state
    return state


# --- Definitions -----------------------------------------------------------


@pytest.mark.parametrize("definition", NEW_SCENARIOS, ids=lambda d: d.scenario_id)
def test_definitions_round_trip_and_are_registered(definition: ScenarioDefinition) -> None:
    restored = ScenarioDefinition.model_validate(definition.model_dump(mode="json"))

    assert restored == definition
    assert get_scenario_definition(definition.scenario_id) is definition
    assert definition.version == "1.0.0"
    assert definition.turn.max_turns == 12
    assert dict(definition.initial_state) == {
        metric.metric_id: metric.initial_value for metric in definition.metrics
    }


@pytest.mark.parametrize("definition", NEW_SCENARIOS, ids=lambda d: d.scenario_id)
def test_new_scenarios_use_no_financial_metrics_or_startup_content(
    definition: ScenarioDefinition,
) -> None:
    assert all(metric.kind is not MetricKind.MONEY for metric in definition.metrics)
    startup_ids = (
        {metric.metric_id for metric in STARTUP_SURVIVAL.metrics}
        | {action.action_id for action in STARTUP_SURVIVAL.actions}
        | {event.event_id for event in STARTUP_SURVIVAL.events}
    )
    own_ids = (
        {metric.metric_id for metric in definition.metrics}
        | {action.action_id for action in definition.actions}
        | {event.event_id for event in definition.events}
    )
    assert own_ids.isdisjoint(startup_ids)
    text = definition.model_dump_json().lower()
    for startup_term in ("startup", "revenue", "cash", "customer satisfaction", "monthly"):
        assert startup_term not in text


def test_scenarios_have_distinct_turn_labels_and_mechanics() -> None:
    assert STARTUP_SURVIVAL.turn.unit.value == "month"
    assert CYBERSECURITY_CRISIS.turn.unit.value == "round"
    assert SPACE_COLONY.turn.unit.value == "cycle"
    assert [rule.target_metric_id for rule in CYBERSECURITY_CRISIS.recurring_rules] == [
        "threat-level"
    ]
    assert [rule.target_metric_id for rule in SPACE_COLONY.recurring_rules] == [
        "oxygen",
        "food",
        "energy",
    ]


@pytest.mark.parametrize("definition", NEW_SCENARIOS, ids=lambda d: d.scenario_id)
def test_definitions_are_not_mutated_by_play(definition: ScenarioDefinition) -> None:
    before = definition.model_dump_json()
    state = initialize_game(definition, 7)
    state_before = state.model_dump_json()

    result = resolve_turn(definition, state, definition.actions[0].action_id)

    assert definition.model_dump_json() == before
    assert state.model_dump_json() == state_before
    assert result.previous_state is state
    with pytest.raises(TypeError):
        result.new_state.metric_values["oxygen"] = 0  # type: ignore[index]


# --- Exact authoritative calculations -------------------------------------


def test_cyber_first_round_applies_action_escalation_then_event() -> None:
    result = resolve_turn(
        CYBERSECURITY_CRISIS,
        initialize_game(CYBERSECURITY_CRISIS, 42),
        "isolate-affected-systems",
    )

    # Action: momentum 4->1, continuity 90->80, integrity 72->75, resources 140->120.
    # Recurring: threat 30 + momentum 1 = 31. Event: phishing adds 2 momentum, -3 integrity.
    assert result.triggered_event is not None
    assert result.triggered_event.event_id == "phishing-campaign"
    assert dict(result.new_state.metric_values) == {
        "system-integrity": 72,
        "threat-level": 31,
        "attacker-momentum": 3,
        "operational-continuity": 80,
        "stakeholder-trust": 70,
        "response-resources": 120,
    }
    assert result.new_state.current_turn == 2
    assert result.resulting_status is GameStatus.ACTIVE


def test_space_first_cycle_applies_balances_to_every_reserve() -> None:
    result = resolve_turn(
        SPACE_COLONY,
        initialize_game(SPACE_COLONY, 42),
        "expand-hydroponics",
    )

    # Action: energy 34->31, food balance -3->-1, oxygen balance -2->-1, energy balance -2->-3.
    # Recurring: oxygen 30-1, food 36-1, energy 31-3. No event is eligible in cycle 1.
    assert result.triggered_event is None
    assert dict(result.new_state.metric_values) == {
        "oxygen": 29,
        "oxygen-balance": -1,
        "food": 35,
        "food-balance": -1,
        "energy": 28,
        "energy-balance": -3,
        "crew-morale": 72,
        "colony-integrity": 80,
    }


def test_space_reserve_exhaustion_is_recorded_and_ends_the_run() -> None:
    state = play(SPACE_COLONY, 42, ("crew-rest-rotation",) * 2)
    depleted = state.model_copy(
        update={"metric_values": {**state.metric_values, "oxygen": 1, "oxygen-balance": -3}}
    )

    result = resolve_turn(SPACE_COLONY, depleted, "habitat-maintenance")

    oxygen_change = next(c for c in result.metric_changes if c.metric_id == "oxygen")
    assert oxygen_change.exhausted is True
    assert oxygen_change.attempted_value == -2
    assert oxygen_change.new_value == 0
    assert result.resulting_status is GameStatus.LOST
    assert result.outcome_reason == "life-support-failure"


# --- Victory, failure, and full-length runs --------------------------------


@pytest.mark.parametrize(
    ("definition", "path", "expected"),
    [
        (
            CYBERSECURITY_CRISIS,
            CYBER_WIN_PATH,
            {
                "system-integrity": 89,
                "threat-level": 27,
                "attacker-momentum": 3,
                "operational-continuity": 92,
                "stakeholder-trust": 82,
                "response-resources": 110,
            },
        ),
        (
            SPACE_COLONY,
            SPACE_WIN_PATH,
            {
                "oxygen": 41,
                "oxygen-balance": 5,
                "food": 62,
                "food-balance": 8,
                "energy": 25,
                "energy-balance": 1,
                "crew-morale": 65,
                "colony-integrity": 77,
            },
        ),
    ],
    ids=["cybersecurity-crisis", "space-colony"],
)
def test_twelve_turn_victory_is_exact_and_reproducible(
    definition: ScenarioDefinition,
    path: tuple[str, ...],
    expected: dict[str, int],
) -> None:
    first = play(definition, 42, path)
    second = play(definition, 42, path)

    assert first.status is GameStatus.WON
    assert first.decision_history[-1].outcome_reason == definition.win_conditions[0].condition_id
    assert len(first.decision_history) == 12
    assert first.current_turn == 12
    assert dict(first.metric_values) == expected
    assert first.model_dump_json() == second.model_dump_json()


@pytest.mark.parametrize(
    ("definition", "path", "reason", "turns"),
    [
        (CYBERSECURITY_CRISIS, CYBER_TAKEOVER_PATH, "network-takeover", 6),
        (CYBERSECURITY_CRISIS, CYBER_UNRESOLVED_PATH, "crisis-unresolved", 12),
        (SPACE_COLONY, SPACE_POWER_LOSS_PATH, "total-power-loss", 6),
        (SPACE_COLONY, ("emergency-rationing",) * 6, "crew-breakdown", 6),
        (SPACE_COLONY, SPACE_UNSUSTAINABLE_PATH, "colony-unsustainable", 12),
    ],
)
def test_failure_conditions_end_the_run(
    definition: ScenarioDefinition,
    path: tuple[str, ...],
    reason: str,
    turns: int,
) -> None:
    state = play(definition, 42, path)

    assert state.status is GameStatus.LOST
    assert state.decision_history[-1].outcome_reason == reason
    assert len(state.decision_history) == turns
    assert get_available_actions(definition, state) == []
    with pytest.raises(EngineError) as error:
        resolve_turn(definition, state, path[0])
    assert error.value.code == "game-already-complete"


@pytest.mark.parametrize("definition", NEW_SCENARIOS, ids=lambda d: d.scenario_id)
def test_randomized_runs_respect_bounds_terminate_and_never_dead_end(
    definition: ScenarioDefinition,
) -> None:
    metrics = {metric.metric_id: metric for metric in definition.metrics}
    outcomes: set[str] = set()
    for seed in range(300):
        rng = random.Random(seed)
        state = initialize_game(definition, seed)
        while state.status not in {GameStatus.WON, GameStatus.LOST}:
            actions = get_available_actions(definition, state)
            assert actions, f"seed {seed} reached a turn without any available decision"
            state = resolve_turn(definition, state, rng.choice(actions).action_id).new_state
            for metric_id, value in state.metric_values.items():
                assert metrics[metric_id].min_value <= value <= metrics[metric_id].max_value
        assert 1 <= len(state.decision_history) <= 12
        outcomes.add(state.decision_history[-1].outcome_reason)
    # Random play reaches both victory and several distinct failures.
    assert definition.win_conditions[0].condition_id in outcomes
    assert len(outcomes - {definition.win_conditions[0].condition_id}) >= 3


def test_seed_changes_event_draws_but_not_action_arithmetic() -> None:
    path = ("isolate-affected-systems", "launch-threat-hunt", "patch-and-harden")
    runs = {seed: play(CYBERSECURITY_CRISIS, seed, path) for seed in range(25)}
    event_sequences = {
        tuple(record.event_id for record in state.decision_history) for state in runs.values()
    }
    assert len(event_sequences) > 1
    for seed, state in runs.items():
        assert play(CYBERSECURITY_CRISIS, seed, path) == state


# --- Situational decisions -------------------------------------------------


def test_cyber_failover_only_becomes_available_after_continuity_drops() -> None:
    start = initialize_game(CYBERSECURITY_CRISIS, 42)
    start_ids = [action.action_id for action in get_available_actions(CYBERSECURITY_CRISIS, start)]
    assert "activate-backup-site" not in start_ids
    with pytest.raises(EngineError) as error:
        resolve_turn(CYBERSECURITY_CRISIS, start, "activate-backup-site")
    assert error.value.code == "action-not-eligible"

    degraded = start.model_copy(
        update={"metric_values": {**start.metric_values, "operational-continuity": 55}}
    )
    degraded_ids = [
        action.action_id for action in get_available_actions(CYBERSECURITY_CRISIS, degraded)
    ]
    assert "activate-backup-site" in degraded_ids


def test_space_expedition_is_limited_and_unlocks_ice_discovery() -> None:
    state = play(SPACE_COLONY, 42, ("survey-expedition", "survey-expedition"))
    ids = [action.action_id for action in get_available_actions(SPACE_COLONY, state)]

    assert "survey-expedition" not in ids
    assert "subsurface-ice-discovery" in [record.event_id for record in state.decision_history]


def test_unaffordable_decisions_are_hidden_and_rejected_atomically() -> None:
    start = initialize_game(SPACE_COLONY, 42)
    starved = start.model_copy(update={"metric_values": {**start.metric_values, "energy": 2}})
    ids = [action.action_id for action in get_available_actions(SPACE_COLONY, starved)]

    assert "expand-hydroponics" not in ids
    assert "emergency-rationing" in ids
    with pytest.raises(EngineError) as error:
        resolve_turn(SPACE_COLONY, starved, "expand-hydroponics")
    assert error.value.code == "insufficient-resource"
    assert starved.metric_values["energy"] == 2


# --- Stateless API ---------------------------------------------------------


async def _post(app: Any, path: str, body: dict[str, object]) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.post(path, json=body)


def _call(app: Any, path: str, body: dict[str, object]) -> httpx.Response:
    return asyncio.run(_post(app, path, body))


@pytest.mark.parametrize(
    ("definition", "path"),
    [(CYBERSECURITY_CRISIS, CYBER_WIN_PATH), (SPACE_COLONY, SPACE_WIN_PATH)],
    ids=["cybersecurity-crisis", "space-colony"],
)
def test_api_plays_full_run_with_replay_matching_engine(
    definition: ScenarioDefinition,
    path: tuple[str, ...],
) -> None:
    app = create_app(Settings(_env_file=None, ai_api_key=None))
    start = _call(app, "/api/games/start", {"scenario_id": definition.scenario_id, "seed": 42})
    assert start.status_code == 200
    started = GameStartResponse.model_validate(start.json())
    assert started.scenario.turn.unit == definition.turn.unit
    assert [metric.metric_id for metric in started.scenario.metrics] == [
        metric.metric_id for metric in definition.metrics
    ]

    history: list[str] = []
    response: GameTurnResponse | None = None
    for action_id in path:
        raw = _call(
            app,
            "/api/games/turn",
            {
                "scenario_id": definition.scenario_id,
                "scenario_version": definition.version,
                "seed": 42,
                "action_history": history,
                "action_id": action_id,
            },
        )
        assert raw.status_code == 200, raw.text
        response = GameTurnResponse.model_validate(raw.json())
        history = list(response.action_history)

    assert response is not None
    assert response.state == play(definition, 42, path)
    assert response.state.status is GameStatus.WON
    assert response.available_actions == ()


@pytest.mark.parametrize("definition", NEW_SCENARIOS, ids=lambda d: d.scenario_id)
def test_api_rejects_foreign_tampered_and_stale_requests(definition: ScenarioDefinition) -> None:
    app = create_app(Settings(_env_file=None, ai_api_key=None))
    base = {
        "scenario_id": definition.scenario_id,
        "scenario_version": definition.version,
        "seed": 42,
        "action_history": [],
    }

    foreign = _call(app, "/api/games/turn", {**base, "action_id": "invest-in-marketing"})
    tampered = _call(
        app,
        "/api/games/turn",
        {
            **base,
            "action_history": ["invest-in-marketing"],
            "action_id": definition.actions[0].action_id,
        },
    )
    stale = _call(
        app,
        "/api/games/turn",
        {**base, "scenario_version": "0.9.0", "action_id": definition.actions[0].action_id},
    )

    assert foreign.status_code == 422
    assert foreign.json()["detail"]["code"] == "invalid_action"
    assert tampered.status_code == 422
    assert tampered.json()["detail"]["code"] == "invalid_replay_history"
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "scenario_version_mismatch"


def test_completed_run_rejects_further_turns() -> None:
    app = create_app(Settings(_env_file=None, ai_api_key=None))
    response = _call(
        app,
        "/api/games/turn",
        {
            "scenario_id": "space-colony",
            "scenario_version": "1.0.0",
            "seed": 42,
            "action_history": list(SPACE_WIN_PATH),
            "action_id": "habitat-maintenance",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "game_already_complete"


@pytest.mark.parametrize("scenario_id", ["cybersecurity-crisis", "space-colony"])
@pytest.mark.parametrize("path", ["proposal", "replay"])
def test_director_stays_scoped_to_startup_survival(scenario_id: str, path: str) -> None:
    app = create_app(
        Settings(
            _env_file=None,
            director_enabled=True,
            director_active_signing_key_id="test-key",
            director_signing_keys={"test-key": SecretStr("brick-9c-test-only-signing-key-0001")},
        )
    )
    body = {
        "format_version": 2,
        "mode": "director",
        "scenario_id": scenario_id,
        "scenario_version": "1.0.0",
        "seed": 42,
        "profile_id": "startup-survival-director",
        "profile_version": "1.0.0",
        "turn_records": [],
    }

    response = _call(app, f"/api/ai/director/{path}", body)

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "unsupported_director_scenario"
