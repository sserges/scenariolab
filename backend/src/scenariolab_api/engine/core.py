from __future__ import annotations

from collections.abc import Mapping, Sequence
from hashlib import sha256

from scenariolab_api.domain.enums import (
    ComparisonOperator,
    ConditionReference,
    EffectOperator,
    GameStatus,
    MatchLogic,
)
from scenariolab_api.domain.models import (
    ActionEffect,
    ConditionClause,
    DecisionRecord,
    GameState,
    MetricChange,
    MetricDefinition,
    OutcomeCondition,
    RecurringRule,
    ScenarioAction,
    ScenarioDefinition,
    ScenarioEvent,
    initialize_game_state,
)
from scenariolab_api.engine.errors import EngineError
from scenariolab_api.engine.models import TurnResult


def initialize_game(definition: ScenarioDefinition, seed: int) -> GameState:
    """Return a new untouched state pinned to a validated scenario and seed."""

    _validate_definition_policy(definition)
    return initialize_game_state(definition, seed=seed)


def get_available_actions(
    definition: ScenarioDefinition,
    state: GameState,
) -> list[ScenarioAction]:
    """Return actions whose preconditions and immediate effects are valid now."""

    _validate_definition_policy(definition)
    _validate_state_consistency(definition, state)
    if state.status in {GameStatus.WON, GameStatus.LOST}:
        return []

    metric_definitions = _metric_definitions(definition)
    available: list[ScenarioAction] = []
    for action in definition.actions:
        if not _conditions_match(
            action.preconditions,
            MatchLogic.ALL,
            state.metric_values,
            state.current_turn,
            state.decision_history,
        ):
            continue
        candidate_values = dict(state.metric_values)
        try:
            _apply_effects(candidate_values, metric_definitions, action.effects)
        except EngineError:
            continue
        available.append(action)
    return available


def resolve_turn(
    definition: ScenarioDefinition,
    state: GameState,
    action_id: str,
) -> TurnResult:
    """Resolve exactly one turn without mutating the definition or prior state."""

    _validate_definition_policy(definition)
    _validate_state_consistency(definition, state)
    if state.status in {GameStatus.WON, GameStatus.LOST}:
        raise EngineError("game-already-complete", "completed games cannot accept actions")

    action = next(
        (candidate for candidate in definition.actions if candidate.action_id == action_id),
        None,
    )
    if action is None:
        raise EngineError("invalid-action", f"unknown action '{action_id}'")

    completed_turn = len(state.decision_history) + 1
    if completed_turn != state.current_turn or completed_turn > state.max_turns:
        raise EngineError("invalid-state", "state does not identify a playable turn")
    if not _conditions_match(
        action.preconditions,
        MatchLogic.ALL,
        state.metric_values,
        completed_turn,
        state.decision_history,
    ):
        raise EngineError(
            "action-not-eligible",
            f"action '{action.action_id}' does not satisfy its preconditions",
        )

    metric_definitions = _metric_definitions(definition)
    values = dict(state.metric_values)
    exhausted_attempts: dict[str, int] = {}

    # The local copy makes all failure modes transactional.
    _apply_effects(values, metric_definitions, action.effects)
    for rule in definition.recurring_rules:
        _apply_recurring_rule(
            values,
            metric_definitions,
            rule,
            exhausted_attempts,
        )

    provisional_history = (*state.decision_history, _provisional_record(action, completed_turn))
    eligible_events = _eligible_events(
        definition,
        values,
        completed_turn,
        provisional_history,
        metric_definitions,
    )
    event, random_draw = _select_event(
        definition,
        state,
        completed_turn,
        eligible_events,
    )
    if event is not None:
        _apply_effects(values, metric_definitions, event.effects)

    status, outcome_reason = _evaluate_outcome(
        definition,
        values,
        completed_turn,
        provisional_history,
    )
    metric_changes = _metric_changes(
        definition,
        state.metric_values,
        values,
        exhausted_attempts,
    )
    decision_record = DecisionRecord(
        action_id=action.action_id,
        action_title=action.title,
        turn=completed_turn,
        sequence=completed_turn,
        event_id=event.event_id if event is not None else None,
        eligible_event_ids=tuple(candidate.event_id for candidate in eligible_events),
        event_random_draw=random_draw,
        metric_changes=metric_changes,
        resulting_status=status,
        outcome_reason=outcome_reason,
    )
    new_state = GameState(
        scenario_id=state.scenario_id,
        scenario_version=state.scenario_version,
        current_turn=(
            completed_turn
            if status in {GameStatus.WON, GameStatus.LOST}
            else completed_turn + 1
        ),
        max_turns=state.max_turns,
        metric_values=values,
        status=status,
        decision_history=(*state.decision_history, decision_record),
        seed=state.seed,
    )
    return TurnResult(
        previous_state=state,
        new_state=new_state,
        selected_action=action,
        triggered_event=event,
        eligible_event_ids=decision_record.eligible_event_ids,
        event_random_draw=random_draw,
        metric_changes=metric_changes,
        completed_turn_index=completed_turn,
        resulting_status=status,
        outcome_reason=outcome_reason,
        decision_record=decision_record,
    )


def _validate_definition_policy(definition: ScenarioDefinition) -> None:
    expected = ["action-effects"]
    if definition.recurring_rules:
        expected.append("recurring-rules")
    expected.extend(("event-effects", "outcome-evaluation"))
    declared = [
        phase
        for phase in definition.calculation.effect_order
        if phase != "recurring-rules" or definition.recurring_rules
    ]
    if declared != expected:
        raise EngineError(
            "unsupported-calculation-order",
            f"engine requires calculation order {expected!r}",
        )


def _validate_state_consistency(
    definition: ScenarioDefinition,
    state: GameState,
) -> None:
    if (
        state.scenario_id != definition.scenario_id
        or state.scenario_version != definition.version
        or state.max_turns != definition.turn.max_turns
    ):
        raise EngineError(
            "scenario-state-mismatch",
            "state scenario identity, version, or turn limit does not match definition",
        )
    if state.seed.stream_version != definition.calculation.random_stream_version:
        raise EngineError("scenario-state-mismatch", "random stream versions do not match")

    metric_definitions = _metric_definitions(definition)
    if set(state.metric_values) != set(metric_definitions):
        raise EngineError("invalid-state", "state metric IDs do not match definition")
    for metric_id, value in state.metric_values.items():
        metric = metric_definitions[metric_id]
        if isinstance(value, bool) or not isinstance(value, int):
            raise EngineError("invalid-state", f"metric '{metric_id}' is not an integer")
        if value < metric.min_value or value > metric.max_value:
            raise EngineError("invalid-state", f"metric '{metric_id}' is outside its bounds")

    history_count = len(state.decision_history)
    expected_current_turn = (
        history_count
        if state.status in {GameStatus.WON, GameStatus.LOST}
        else history_count + 1
    )
    if expected_current_turn < 1:
        expected_current_turn = 1
    if (
        state.current_turn != expected_current_turn
        or history_count > state.max_turns
        or (state.status is GameStatus.NOT_STARTED and history_count != 0)
        or (state.status is GameStatus.ACTIVE and not 0 < history_count < state.max_turns)
        or (state.status in {GameStatus.WON, GameStatus.LOST} and history_count == 0)
    ):
        raise EngineError("invalid-state", "state turn, status, and history are inconsistent")

    action_ids = {action.action_id for action in definition.actions}
    event_ids = {event.event_id for event in definition.events}
    for index, record in enumerate(state.decision_history, start=1):
        if (
            record.turn != index
            or record.sequence != index
            or record.action_id not in action_ids
            or (record.event_id is not None and record.event_id not in event_ids)
        ):
            raise EngineError("invalid-state", "state history is inconsistent with definition")


def _metric_definitions(
    definition: ScenarioDefinition,
) -> dict[str, MetricDefinition]:
    return {metric.metric_id: metric for metric in definition.metrics}


def _provisional_record(action: ScenarioAction, turn: int) -> DecisionRecord:
    return DecisionRecord(
        action_id=action.action_id,
        action_title=action.title,
        turn=turn,
        sequence=turn,
    )


def _apply_effects(
    values: dict[str, int],
    metrics: Mapping[str, MetricDefinition],
    effects: Sequence[ActionEffect],
) -> None:
    for effect in effects:
        metric = metrics[effect.metric_id]
        current = values[effect.metric_id]
        if effect.operator is EffectOperator.ADD:
            candidate = current + effect.value
        elif effect.operator is EffectOperator.SUBTRACT:
            candidate = current - effect.value
        elif effect.operator is EffectOperator.MULTIPLY:
            candidate = current * effect.value
        elif effect.operator is EffectOperator.SET:
            candidate = effect.value
        else:
            _apply_transfer(values, metrics, effect)
            continue
        _require_in_bounds(metric, candidate, effect.operator)
        values[effect.metric_id] = candidate


def _apply_transfer(
    values: dict[str, int],
    metrics: Mapping[str, MetricDefinition],
    effect: ActionEffect,
) -> None:
    destination_id = effect.destination_metric_id
    if destination_id is None:  # Defensive; Pydantic already rejects this shape.
        raise EngineError("invalid-effect", "transfer has no destination metric")
    source_metric = metrics[effect.metric_id]
    destination_metric = metrics[destination_id]
    if source_metric.unit is not destination_metric.unit:
        raise EngineError(
            "invalid-effect",
            "contract v1 transfers require source and destination to share a unit",
        )
    source_value = values[effect.metric_id] - effect.value
    destination_value = values[destination_id] + effect.value
    _require_in_bounds(source_metric, source_value, EffectOperator.TRANSFER)
    _require_in_bounds(destination_metric, destination_value, EffectOperator.TRANSFER)
    values[effect.metric_id] = source_value
    values[destination_id] = destination_value


def _require_in_bounds(
    metric: MetricDefinition,
    value: int,
    operator: EffectOperator,
) -> None:
    if value < metric.min_value:
        code = (
            "insufficient-resource"
            if operator in {EffectOperator.SUBTRACT, EffectOperator.TRANSFER}
            else "metric-bound-violation"
        )
        raise EngineError(code, f"effect would put '{metric.metric_id}' below its minimum")
    if value > metric.max_value:
        raise EngineError(
            "metric-bound-violation",
            f"effect would put '{metric.metric_id}' above its maximum",
        )


def _apply_recurring_rule(
    values: dict[str, int],
    metrics: Mapping[str, MetricDefinition],
    rule: RecurringRule,
    exhausted_attempts: dict[str, int],
) -> None:
    metric = metrics[rule.target_metric_id]
    candidate = values[rule.target_metric_id]
    for term in rule.terms:
        if term.operator == "add":
            candidate += values[term.metric_id]
        else:
            candidate -= values[term.metric_id]
    if candidate < metric.min_value and rule.underflow_behavior == "exhaust-at-minimum":
        exhausted_attempts[rule.target_metric_id] = candidate
        values[rule.target_metric_id] = metric.min_value
        return
    if candidate < metric.min_value or candidate > metric.max_value:
        raise EngineError(
            "recurring-bound-violation",
            f"recurring rule '{rule.rule_id}' would violate '{metric.metric_id}' bounds",
        )
    values[rule.target_metric_id] = candidate


def _eligible_events(
    definition: ScenarioDefinition,
    values: Mapping[str, int],
    turn: int,
    history: Sequence[DecisionRecord],
    metrics: Mapping[str, MetricDefinition],
) -> list[ScenarioEvent]:
    occurrence_counts: dict[str, int] = {}
    for record in history[:-1]:
        if record.event_id is not None:
            occurrence_counts[record.event_id] = occurrence_counts.get(record.event_id, 0) + 1

    eligible: list[ScenarioEvent] = []
    for event in definition.events:
        trigger = event.trigger
        if turn < trigger.earliest_turn:
            continue
        if trigger.latest_turn is not None and turn > trigger.latest_turn:
            continue
        if occurrence_counts.get(event.event_id, 0) >= event.max_occurrences:
            continue
        if not _conditions_match(
            trigger.conditions,
            trigger.logic,
            values,
            turn,
            history,
        ):
            continue
        candidate_values = dict(values)
        try:
            _apply_effects(candidate_values, metrics, event.effects)
        except EngineError:
            continue
        eligible.append(event)
    return eligible


def _select_event(
    definition: ScenarioDefinition,
    state: GameState,
    turn: int,
    eligible: Sequence[ScenarioEvent],
) -> tuple[ScenarioEvent | None, int | None]:
    if not eligible:
        return None, None
    total_weight = sum(event.weight for event in eligible)
    payload = "\x1f".join(
        (
            definition.calculation.random_stream_version,
            str(state.seed.seed),
            definition.scenario_id,
            definition.version,
            str(turn),
            *(event.event_id for event in eligible),
        )
    ).encode("utf-8")
    draw = int.from_bytes(sha256(payload).digest()[:8], "big") % total_weight
    cursor = draw
    for event in eligible:
        if cursor < event.weight:
            return event, draw
        cursor -= event.weight
    raise AssertionError("weighted event selection did not resolve")


def _evaluate_outcome(
    definition: ScenarioDefinition,
    values: Mapping[str, int],
    turn: int,
    history: Sequence[DecisionRecord],
) -> tuple[GameStatus, str]:
    matched_losses = _matched_outcomes(
        definition.loss_conditions,
        values,
        turn,
        history,
    )
    hard_losses = [
        outcome
        for outcome in matched_losses
        if any(
            condition.reference is not ConditionReference.TURN
            for condition in outcome.conditions
        )
    ]
    loss = _highest_priority(hard_losses)
    if loss is not None:
        return GameStatus.LOST, loss.condition_id

    win = _highest_priority_match(definition.win_conditions, values, turn, history)
    turn_limit_loss = _highest_priority(
        [outcome for outcome in matched_losses if outcome not in hard_losses]
    )
    if turn_limit_loss is not None and (
        win is None or turn_limit_loss.priority >= win.priority
    ):
        return GameStatus.LOST, turn_limit_loss.condition_id
    if win is not None:
        return GameStatus.WON, win.condition_id
    if turn >= definition.turn.max_turns:
        return GameStatus.LOST, "turn-limit-reached"
    return GameStatus.ACTIVE, "turn-completed"


def _highest_priority_match(
    outcomes: Sequence[OutcomeCondition],
    values: Mapping[str, int],
    turn: int,
    history: Sequence[DecisionRecord],
) -> OutcomeCondition | None:
    return _highest_priority(_matched_outcomes(outcomes, values, turn, history))


def _matched_outcomes(
    outcomes: Sequence[OutcomeCondition],
    values: Mapping[str, int],
    turn: int,
    history: Sequence[DecisionRecord],
) -> list[OutcomeCondition]:
    return [
        outcome
        for outcome in outcomes
        if _conditions_match(outcome.conditions, outcome.logic, values, turn, history)
    ]


def _highest_priority(
    outcomes: Sequence[OutcomeCondition],
) -> OutcomeCondition | None:
    if not outcomes:
        return None
    return max(enumerate(outcomes), key=lambda item: (item[1].priority, -item[0]))[1]


def _conditions_match(
    conditions: Sequence[ConditionClause],
    logic: MatchLogic,
    values: Mapping[str, int],
    turn: int,
    history: Sequence[DecisionRecord],
) -> bool:
    if not conditions:
        return True
    matches = (
        _condition_matches(condition, values, turn, history)
        for condition in conditions
    )
    return all(matches) if logic is MatchLogic.ALL else any(matches)


def _condition_matches(
    condition: ConditionClause,
    values: Mapping[str, int],
    turn: int,
    history: Sequence[DecisionRecord],
) -> bool:
    if condition.reference is ConditionReference.METRIC:
        assert condition.metric_id is not None
        actual = values[condition.metric_id]
    elif condition.reference is ConditionReference.TURN:
        actual = turn
    else:
        assert condition.action_id is not None
        actual = sum(record.action_id == condition.action_id for record in history)
    return _compare(actual, condition.operator, condition.value)


def _compare(actual: int, operator: ComparisonOperator, expected: int) -> bool:
    if operator is ComparisonOperator.LESS_THAN:
        return actual < expected
    if operator is ComparisonOperator.LESS_THAN_OR_EQUAL:
        return actual <= expected
    if operator is ComparisonOperator.EQUAL:
        return actual == expected
    if operator is ComparisonOperator.GREATER_THAN_OR_EQUAL:
        return actual >= expected
    return actual > expected


def _metric_changes(
    definition: ScenarioDefinition,
    previous: Mapping[str, int],
    current: Mapping[str, int],
    exhausted_attempts: Mapping[str, int],
) -> tuple[MetricChange, ...]:
    changes: list[MetricChange] = []
    for metric in definition.metrics:
        metric_id = metric.metric_id
        if previous[metric_id] == current[metric_id] and metric_id not in exhausted_attempts:
            continue
        changes.append(
            MetricChange(
                metric_id=metric_id,
                previous_value=previous[metric_id],
                new_value=current[metric_id],
                delta=current[metric_id] - previous[metric_id],
                exhausted=metric_id in exhausted_attempts,
                attempted_value=exhausted_attempts.get(metric_id),
            )
        )
    return tuple(changes)

