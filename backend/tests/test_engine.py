from collections.abc import MutableMapping

import pytest
from pydantic import ValidationError

from scenariolab_api.domain.enums import (
    ComparisonOperator,
    ConditionReference,
    DisplayStyle,
    EffectOperator,
    FavorableDirection,
    GameStatus,
    MetricKind,
    MetricUnit,
    ScenarioCategory,
    ScenarioSource,
    TurnUnit,
)
from scenariolab_api.domain.models import (
    ActionEffect,
    CalculationParameters,
    ConditionClause,
    EventTrigger,
    FallbackPolicy,
    MetricDefinition,
    MetricFormat,
    OutcomeCondition,
    RecurringRule,
    RecurringRuleTerm,
    ScenarioAction,
    ScenarioDefinition,
    ScenarioEvent,
    ScenarioMetadata,
    TurnConfiguration,
)
from scenariolab_api.engine import (
    EngineError,
    get_available_actions,
    initialize_game,
    resolve_turn,
)
from scenariolab_api.scenarios.startup_survival import STARTUP_SURVIVAL


def _startup_without_eligible_events() -> ScenarioDefinition:
    data = STARTUP_SURVIVAL.model_dump(mode="json")
    for event in data["events"]:
        event["trigger"]["logic"] = "all"
        event["trigger"]["conditions"] = [
            {
                "reference": "turn",
                "operator": "eq",
                "value": 999,
                "metric_id": None,
                "action_id": None,
            }
        ]
    return ScenarioDefinition.model_validate(data)


def _resource_scenario() -> ScenarioDefinition:
    number = MetricFormat(style=DisplayStyle.NUMBER)

    def resource(metric_id: str, initial: int, maximum: int = 30) -> MetricDefinition:
        return MetricDefinition(
            metric_id=metric_id,
            title=metric_id.replace("-", " ").title(),
            description=f"Synthetic {metric_id} resource for engine tests.",
            kind=MetricKind.RESOURCE,
            unit=MetricUnit.UNITS,
            format=number,
            initial_value=initial,
            min_value=0,
            max_value=maximum,
            critical_threshold=0,
            favorable_direction=FavorableDirection.HIGHER,
        )

    return ScenarioDefinition(
        scenario_id="orbital-outpost",
        schema_version="1.0",
        version="1.0.0",
        title="Orbital Outpost",
        description="Keep generic nonfinancial resources available for two shifts.",
        category=ScenarioCategory.CUSTOM,
        metadata=ScenarioMetadata(
            objective="Keep oxygen available through the second shift.",
            author="ScenarioLab tests",
            content_locale="en-US",
            source=ScenarioSource.PREDEFINED,
            tags=("synthetic",),
            disclaimer="Synthetic engine fixture.",
        ),
        initial_state={
            "oxygen": 12,
            "energy": 6,
            "food": 10,
            "oxygen-use": 3,
        },
        metrics=(
            resource("oxygen", 12),
            resource("energy", 6),
            resource("food", 10),
            resource("oxygen-use", 3),
        ),
        turn=TurnConfiguration(duration=1, unit=TurnUnit.DAY, max_turns=2),
        actions=(
            ScenarioAction(
                action_id="cycle-supplies",
                title="Cycle Supplies",
                description="Exercise all allowlisted integer effect operations.",
                effects=(
                    ActionEffect(
                        metric_id="oxygen",
                        operator=EffectOperator.MULTIPLY,
                        value=2,
                        description="Double the oxygen reserve.",
                    ),
                    ActionEffect(
                        metric_id="oxygen",
                        operator=EffectOperator.SUBTRACT,
                        value=2,
                        description="Consume two oxygen units.",
                    ),
                    ActionEffect(
                        metric_id="energy",
                        operator=EffectOperator.SET,
                        value=8,
                        description="Set the prepared energy reserve.",
                    ),
                    ActionEffect(
                        metric_id="food",
                        operator=EffectOperator.ADD,
                        value=2,
                        description="Add two food units.",
                    ),
                    ActionEffect(
                        metric_id="food",
                        operator=EffectOperator.SUBTRACT,
                        value=1,
                        description="Consume one food unit.",
                    ),
                    ActionEffect(
                        metric_id="oxygen",
                        destination_metric_id="energy",
                        operator=EffectOperator.TRANSFER,
                        value=5,
                        description="Transfer five generic units to energy.",
                    ),
                ),
            ),
        ),
        recurring_rules=(
            RecurringRule(
                rule_id="crew-oxygen-use",
                target_metric_id="oxygen",
                terms=(
                    RecurringRuleTerm(metric_id="oxygen-use", operator="subtract"),
                ),
                underflow_behavior="exhaust-at-minimum",
                description="Consume the declared oxygen-use amount each shift.",
            ),
        ),
        events=(
            ScenarioEvent(
                event_id="solar-flare",
                title="Solar Flare",
                description="A predefined flare drains stored energy.",
                trigger=EventTrigger(
                    conditions=(
                        ConditionClause(
                            reference=ConditionReference.TURN,
                            operator=ComparisonOperator.EQUAL,
                            value=1,
                        ),
                    ),
                ),
                effects=(
                    ActionEffect(
                        metric_id="energy",
                        operator=EffectOperator.SUBTRACT,
                        value=2,
                        description="Drain two energy units.",
                    ),
                ),
            ),
        ),
        win_conditions=(
            OutcomeCondition(
                condition_id="outpost-stable",
                title="Outpost Stable",
                description="The outpost completes two shifts with oxygen remaining.",
                priority=50,
                conditions=(
                    ConditionClause(
                        reference=ConditionReference.TURN,
                        operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                        value=2,
                    ),
                    ConditionClause(
                        reference=ConditionReference.METRIC,
                        metric_id="oxygen",
                        operator=ComparisonOperator.GREATER_THAN,
                        value=0,
                    ),
                ),
            ),
        ),
        loss_conditions=(
            OutcomeCondition(
                condition_id="oxygen-exhausted",
                title="Oxygen Exhausted",
                description="The outpost fails if oxygen is exhausted.",
                priority=100,
                conditions=(
                    ConditionClause(
                        reference=ConditionReference.METRIC,
                        metric_id="oxygen",
                        operator=ComparisonOperator.LESS_THAN_OR_EQUAL,
                        value=0,
                    ),
                ),
            ),
            OutcomeCondition(
                condition_id="mission-objectives-missed",
                title="Mission Objectives Missed",
                description="The run ends unsuccessfully if success is not reached.",
                priority=0,
                conditions=(
                    ConditionClause(
                        reference=ConditionReference.TURN,
                        operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                        value=2,
                    ),
                ),
            ),
        ),
        calculation=CalculationParameters(),
        fallback=FallbackPolicy(event_ids=("solar-flare",), no_event_allowed=True),
    )


def test_initialize_game_copies_definition_and_seed_metadata() -> None:
    state = initialize_game(STARTUP_SURVIVAL, seed=42)

    assert state.status is GameStatus.NOT_STARTED
    assert state.current_turn == 1
    assert state.metric_values == STARTUP_SURVIVAL.initial_state
    assert state.metric_values is not STARTUP_SURVIVAL.initial_state
    assert state.seed.seed == 42
    assert state.seed.stream_version == "scenario-seed-v1"
    assert state.decision_history == ()


def test_startup_action_then_monthly_cash_flow_uses_post_action_metrics() -> None:
    state = initialize_game(STARTUP_SURVIVAL, seed=42)

    result = resolve_turn(STARTUP_SURVIVAL, state, "reduce-operating-expenses")

    assert result.previous_state is state
    assert result.completed_turn_index == 1
    assert result.new_state.metric_values["monthly-expenses"] == 3_750_000
    assert result.new_state.metric_values["cash"] == 12_750_000
    assert result.new_state.metric_values["team-morale"] == 67
    assert result.new_state.metric_values["customer-satisfaction"] == 79
    assert result.new_state.current_turn == 2
    assert result.new_state.status is GameStatus.ACTIVE


def test_three_turn_startup_example_has_exact_financial_results() -> None:
    state = initialize_game(STARTUP_SURVIVAL, seed=42)
    results = []
    for _ in range(3):
        result = resolve_turn(STARTUP_SURVIVAL, state, "reduce-operating-expenses")
        results.append(result)
        state = result.new_state

    assert [result.new_state.metric_values["cash"] for result in results] == [
        12_750_000,
        11_250_000,
        10_500_000,
    ]
    assert [result.new_state.metric_values["monthly-expenses"] for result in results] == [
        3_750_000,
        3_000_000,
        2_250_000,
    ]
    assert state.metric_values["monthly-revenue"] == 1_250_000
    assert results[2].triggered_event is not None
    assert results[2].triggered_event.event_id == "competitor-price-cut"


def test_action_preconditions_and_insufficient_resources_reject_atomically() -> None:
    state = initialize_game(STARTUP_SURVIVAL, seed=9).model_copy(
        update={
            "metric_values": {
                **STARTUP_SURVIVAL.initial_state,
                "cash": 1_000_000,
            }
        }
    )
    before = dict(state.metric_values)

    with pytest.raises(EngineError) as unavailable:
        resolve_turn(STARTUP_SURVIVAL, state, "invest-in-marketing")
    assert unavailable.value.code == "action-not-eligible"
    assert dict(state.metric_values) == before

    data = STARTUP_SURVIVAL.model_dump(mode="json")
    data["actions"][0]["preconditions"] = []
    definition = ScenarioDefinition.model_validate(data)
    with pytest.raises(EngineError) as insufficient:
        resolve_turn(definition, state, "invest-in-marketing")
    assert insufficient.value.code == "insufficient-resource"
    assert dict(state.metric_values) == before


def test_invalid_action_and_scenario_state_mismatch_are_rejected() -> None:
    state = initialize_game(STARTUP_SURVIVAL, seed=4)

    with pytest.raises(EngineError) as invalid_action:
        resolve_turn(STARTUP_SURVIVAL, state, "not-an-action")
    assert invalid_action.value.code == "invalid-action"

    mismatched = state.model_copy(update={"scenario_version": "9.9.9"})
    with pytest.raises(EngineError) as mismatch:
        resolve_turn(STARTUP_SURVIVAL, mismatched, "invest-in-marketing")
    assert mismatch.value.code == "scenario-state-mismatch"

    malformed = state.model_copy(
        update={"metric_values": {**state.metric_values, "undeclared": 1}}
    )
    with pytest.raises(EngineError) as invalid_state:
        get_available_actions(STARTUP_SURVIVAL, malformed)
    assert invalid_state.value.code == "invalid-state"


def test_resolved_snapshots_are_deeply_immutable_and_independent() -> None:
    state = initialize_game(STARTUP_SURVIVAL, seed=42)
    result = resolve_turn(STARTUP_SURVIVAL, state, "reduce-operating-expenses")

    assert not isinstance(result.new_state.metric_values, MutableMapping)
    assert state.metric_values["cash"] == 15_000_000
    assert result.new_state.metric_values["cash"] == 12_750_000
    with pytest.raises(TypeError):
        result.new_state.metric_values["cash"] = 1  # type: ignore[index]
    with pytest.raises(ValidationError, match="frozen"):
        result.new_state.status = GameStatus.LOST  # type: ignore[misc]


def test_repeated_simulations_and_event_selection_are_identical() -> None:
    def run() -> list[object]:
        state = initialize_game(STARTUP_SURVIVAL, seed=42)
        records = []
        for action_id in (
            "improve-the-product",
            "reduce-operating-expenses",
            "invest-in-marketing",
        ):
            result = resolve_turn(STARTUP_SURVIVAL, state, action_id)
            records.append(result.model_dump(mode="json"))
            state = result.new_state
        return records

    assert run() == run()


def test_no_eligible_event_is_recorded_as_none() -> None:
    definition = _startup_without_eligible_events()
    state = initialize_game(definition, seed=42)

    result = resolve_turn(definition, state, "reduce-operating-expenses")

    assert result.triggered_event is None
    assert result.eligible_event_ids == ()
    assert result.event_random_draw is None
    assert result.decision_record.event_id is None


def test_bound_violation_hides_action_and_rejects_without_partial_mutation() -> None:
    state = initialize_game(STARTUP_SURVIVAL, seed=2).model_copy(
        update={
            "metric_values": {
                **STARTUP_SURVIVAL.initial_state,
                "customer-satisfaction": 99,
            }
        }
    )
    before = dict(state.metric_values)

    assert "improve-the-product" not in {
        action.action_id for action in get_available_actions(STARTUP_SURVIVAL, state)
    }
    with pytest.raises(EngineError) as error:
        resolve_turn(STARTUP_SURVIVAL, state, "improve-the-product")
    assert error.value.code == "metric-bound-violation"
    assert dict(state.metric_values) == before
    assert state.decision_history == ()


def test_recurring_exhaustion_records_attempt_and_causes_bankruptcy() -> None:
    definition = _startup_without_eligible_events()
    state = initialize_game(definition, seed=7)
    for action_id in (
        "invest-in-marketing",
        "invest-in-marketing",
        "invest-in-marketing",
        "reduce-operating-expenses",
    ):
        result = resolve_turn(definition, state, action_id)
        state = result.new_state

    cash_change = next(
        change for change in result.metric_changes if change.metric_id == "cash"
    )
    assert result.resulting_status is GameStatus.LOST
    assert result.outcome_reason == "bankruptcy"
    assert state.metric_values["cash"] == 0
    assert cash_change.exhausted is True
    assert cash_change.attempted_value == -1_050_000


def test_configured_nonbankruptcy_loss_has_priority() -> None:
    state = initialize_game(STARTUP_SURVIVAL, seed=1).model_copy(
        update={
            "metric_values": {
                **STARTUP_SURVIVAL.initial_state,
                "team-morale": 11,
            }
        }
    )

    result = resolve_turn(STARTUP_SURVIVAL, state, "reduce-operating-expenses")

    assert result.resulting_status is GameStatus.LOST
    assert result.outcome_reason == "team-collapse"


def test_hard_failure_cannot_be_overridden_by_a_higher_priority_win() -> None:
    data = _resource_scenario().model_dump(mode="json")
    data["turn"]["max_turns"] = 1
    data["events"][0]["effects"][0].update(
        {"metric_id": "oxygen", "operator": "set", "value": 0}
    )
    data["win_conditions"][0]["priority"] = 1_000
    data["win_conditions"][0]["conditions"] = [
        {
            "reference": "turn",
            "operator": "gte",
            "value": 1,
            "metric_id": None,
            "action_id": None,
        }
    ]
    definition = ScenarioDefinition.model_validate(data)

    result = resolve_turn(
        definition,
        initialize_game(definition, seed=5),
        "cycle-supplies",
    )

    assert result.resulting_status is GameStatus.LOST
    assert result.outcome_reason == "oxygen-exhausted"


def test_startup_can_win_on_turn_twelve_without_exposing_turn_thirteen() -> None:
    actions = (
        *("reduce-operating-expenses" for _ in range(4)),
        *("invest-in-marketing" for _ in range(8)),
    )
    state = initialize_game(STARTUP_SURVIVAL, seed=42)
    for action_id in actions:
        result = resolve_turn(STARTUP_SURVIVAL, state, action_id)
        state = result.new_state

    assert result.completed_turn_index == 12
    assert result.resulting_status is GameStatus.WON
    assert result.outcome_reason == "survived-the-year"
    assert state.current_turn == 12
    assert len(state.decision_history) == 12
    assert state.metric_values["cash"] == 2_050_000


def test_unsuccessful_turn_limit_completion_and_terminal_rejection() -> None:
    data = _resource_scenario().model_dump(mode="json")
    data["win_conditions"][0]["conditions"][1]["value"] = 999
    definition = ScenarioDefinition.model_validate(data)
    state = initialize_game(definition, seed=11)
    state = resolve_turn(definition, state, "cycle-supplies").new_state
    final = resolve_turn(definition, state, "cycle-supplies")

    assert final.resulting_status is GameStatus.LOST
    assert final.outcome_reason == "mission-objectives-missed"
    assert final.new_state.current_turn == 2
    before = final.new_state
    with pytest.raises(EngineError) as complete:
        resolve_turn(definition, before, "cycle-supplies")
    assert complete.value.code == "game-already-complete"
    assert final.new_state == before
    assert get_available_actions(definition, before) == []


def test_every_successful_turn_adds_exactly_one_complete_history_record() -> None:
    state = initialize_game(STARTUP_SURVIVAL, seed=42)
    for turn in range(1, 4):
        result = resolve_turn(STARTUP_SURVIVAL, state, "reduce-operating-expenses")
        assert len(result.new_state.decision_history) == turn
        assert result.decision_record is result.new_state.decision_history[-1]
        assert result.decision_record.turn == turn
        assert result.decision_record.sequence == turn
        assert result.decision_record.metric_changes == result.metric_changes
        state = result.new_state


def test_generic_nonfinancial_scenario_uses_all_effects_recurring_and_event_rules() -> None:
    definition = _resource_scenario()
    state = initialize_game(definition, seed=123)

    first = resolve_turn(definition, state, "cycle-supplies")

    assert first.triggered_event is not None
    assert first.triggered_event.event_id == "solar-flare"
    assert first.new_state.metric_values == {
        "oxygen": 14,
        "energy": 11,
        "food": 11,
        "oxygen-use": 3,
    }
    second = resolve_turn(definition, first.new_state, "cycle-supplies")
    assert second.triggered_event is None
    assert second.resulting_status is GameStatus.WON
    assert second.outcome_reason == "outpost-stable"
    assert second.new_state.metric_values["oxygen"] == 18


def test_recurring_rules_reject_unknown_or_incompatible_metric_references() -> None:
    data = _resource_scenario().model_dump(mode="json")
    data["recurring_rules"][0]["terms"][0]["metric_id"] = "unknown-resource"
    with pytest.raises(ValidationError, match="unknown term metric"):
        ScenarioDefinition.model_validate(data)

    data = STARTUP_SURVIVAL.model_dump(mode="json")
    data["recurring_rules"][0]["terms"][0]["metric_id"] = "employees"
    with pytest.raises(ValidationError, match="must share a unit"):
        ScenarioDefinition.model_validate(data)

