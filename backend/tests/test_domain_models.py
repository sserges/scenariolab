from collections.abc import MutableMapping

import pytest
from pydantic import ValidationError

from scenariolab_api.domain.enums import GameStatus
from scenariolab_api.domain.models import ScenarioDefinition, initialize_game_state
from scenariolab_api.scenarios.startup_survival import STARTUP_SURVIVAL


def definition_data() -> dict[str, object]:
    return STARTUP_SURVIVAL.model_dump(mode="json")


def test_startup_survival_is_a_valid_complete_definition() -> None:
    definition = STARTUP_SURVIVAL

    assert definition.scenario_id == "startup-survival"
    assert definition.schema_version == "1.0"
    assert definition.version == "1.0.0"
    assert definition.turn.max_turns == 12
    assert definition.initial_state["cash"] == 15_000_000
    assert definition.initial_state["monthly-revenue"] == 1_500_000
    assert definition.initial_state["monthly-expenses"] == 4_500_000
    assert definition.initial_state["active-users"] == 2_000
    assert definition.initial_state["employees"] == 12
    assert definition.initial_state["customer-satisfaction"] == 82
    assert definition.initial_state["team-morale"] == 75
    assert len(definition.actions) >= 3
    assert len(definition.events) >= 1
    assert {action.title for action in definition.actions} >= {
        "Invest in Marketing",
        "Improve the Product",
        "Reduce Operating Expenses",
    }


def test_scenario_serialization_round_trip() -> None:
    serialized = STARTUP_SURVIVAL.model_dump_json()

    restored = ScenarioDefinition.model_validate_json(serialized)

    assert restored == STARTUP_SURVIVAL
    assert restored.model_dump(mode="json") == STARTUP_SURVIVAL.model_dump(mode="json")


def test_scenario_definition_exports_json_schema() -> None:
    schema = ScenarioDefinition.model_json_schema()

    assert schema["title"] == "ScenarioDefinition"
    assert "scenario_id" in schema["properties"]
    assert "actions" in schema["properties"]
    assert "win_conditions" in schema["properties"]


def test_scenario_definition_is_deeply_immutable() -> None:
    with pytest.raises(ValidationError, match="frozen"):
        STARTUP_SURVIVAL.title = "Changed"  # type: ignore[misc]

    assert not isinstance(STARTUP_SURVIVAL.initial_state, MutableMapping)
    with pytest.raises(TypeError):
        STARTUP_SURVIVAL.initial_state["cash"] = 0  # type: ignore[index]


def test_initial_game_state_is_valid_and_independent() -> None:
    state = initialize_game_state(STARTUP_SURVIVAL, seed=42)

    assert state.scenario_id == STARTUP_SURVIVAL.scenario_id
    assert state.scenario_version == STARTUP_SURVIVAL.version
    assert state.current_turn == 1
    assert state.max_turns == 12
    assert state.status is GameStatus.NOT_STARTED
    assert state.decision_history == ()
    assert state.seed.seed == 42
    assert state.metric_values == STARTUP_SURVIVAL.initial_state
    assert state.metric_values is not STARTUP_SURVIVAL.initial_state

    with pytest.raises(TypeError):
        state.metric_values["cash"] = 0  # type: ignore[index]
    assert STARTUP_SURVIVAL.initial_state["cash"] == 15_000_000


def test_all_initial_metrics_are_inside_declared_bounds() -> None:
    for metric in STARTUP_SURVIVAL.metrics:
        value = STARTUP_SURVIVAL.initial_state[metric.metric_id]
        assert metric.min_value <= value <= metric.max_value
        if metric.capacity is not None:
            assert metric.min_value <= metric.capacity <= metric.max_value


def test_invalid_initial_metric_value_is_rejected() -> None:
    data = definition_data()
    metrics = data["metrics"]
    assert isinstance(metrics, list)
    first_metric = metrics[0]
    assert isinstance(first_metric, dict)
    first_metric["initial_value"] = -1

    with pytest.raises(ValidationError, match="initial_value"):
        ScenarioDefinition.model_validate(data)


def test_duplicate_metric_ids_are_rejected() -> None:
    data = definition_data()
    metrics = data["metrics"]
    assert isinstance(metrics, list)
    metrics.append(metrics[0])

    with pytest.raises(ValidationError, match="duplicate metric IDs"):
        ScenarioDefinition.model_validate(data)


def test_unknown_metric_reference_is_rejected() -> None:
    data = definition_data()
    actions = data["actions"]
    assert isinstance(actions, list)
    first_action = actions[0]
    assert isinstance(first_action, dict)
    effects = first_action["effects"]
    assert isinstance(effects, list)
    first_effect = effects[0]
    assert isinstance(first_effect, dict)
    first_effect["metric_id"] = "missing-metric"

    with pytest.raises(ValidationError, match="unknown metric"):
        ScenarioDefinition.model_validate(data)


def test_invalid_effect_operator_is_rejected() -> None:
    data = definition_data()
    actions = data["actions"]
    assert isinstance(actions, list)
    first_action = actions[0]
    assert isinstance(first_action, dict)
    effects = first_action["effects"]
    assert isinstance(effects, list)
    first_effect = effects[0]
    assert isinstance(first_effect, dict)
    first_effect["operator"] = "divide"

    with pytest.raises(ValidationError, match="operator"):
        ScenarioDefinition.model_validate(data)


def test_unknown_action_reference_is_rejected() -> None:
    data = definition_data()
    events = data["events"]
    assert isinstance(events, list)
    first_event = events[0]
    assert isinstance(first_event, dict)
    trigger = first_event["trigger"]
    assert isinstance(trigger, dict)
    conditions = trigger["conditions"]
    assert isinstance(conditions, list)
    first_condition = conditions[0]
    assert isinstance(first_condition, dict)
    first_condition["action_id"] = "unknown-action"

    with pytest.raises(ValidationError, match="unknown action"):
        ScenarioDefinition.model_validate(data)
