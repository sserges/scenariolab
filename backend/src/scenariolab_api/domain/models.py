from collections.abc import Iterable, Mapping
from types import MappingProxyType
from typing import Annotated, Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PositiveInt,
    StrictInt,
    StringConstraints,
    field_serializer,
    field_validator,
    model_validator,
)

from scenariolab_api.domain.enums import (
    AvailabilityStatus,
    ComparisonOperator,
    ConditionReference,
    DisplayStyle,
    EffectOperator,
    FavorableDirection,
    GameStatus,
    MatchLogic,
    MetricKind,
    MetricUnit,
    ScenarioCategory,
    ScenarioSource,
    TurnUnit,
)

StableId = Annotated[
    str,
    StringConstraints(
        min_length=1,
        max_length=64,
        pattern=r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$",
    ),
]
SchemaVersion = Annotated[str, StringConstraints(pattern=r"^\d+\.\d+$")]
ScenarioVersion = Annotated[
    str,
    StringConstraints(pattern=r"^\d+\.\d+\.\d+$"),
]
BoundedText = Annotated[str, StringConstraints(min_length=1, max_length=500)]


class FrozenModel(BaseModel):
    """Base contract for immutable, strict domain values."""

    model_config = ConfigDict(extra="forbid", frozen=True)


class ScenarioMetadata(FrozenModel):
    objective: BoundedText
    author: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    content_locale: Annotated[str, StringConstraints(pattern=r"^[a-z]{2}-[A-Z]{2}$")]
    source: ScenarioSource
    tags: tuple[StableId, ...] = ()
    disclaimer: BoundedText
    source_references: tuple[Annotated[str, StringConstraints(max_length=500)], ...] = ()


class MetricFormat(FrozenModel):
    style: DisplayStyle
    decimals: StrictInt = Field(default=0, ge=0, le=4)
    currency_code: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")] | None = None
    suffix: Annotated[str, StringConstraints(max_length=16)] | None = None

    @model_validator(mode="after")
    def validate_currency_metadata(self) -> Self:
        if self.style is DisplayStyle.CURRENCY and self.currency_code is None:
            raise ValueError("currency formatting requires currency_code")
        if self.style is not DisplayStyle.CURRENCY and self.currency_code is not None:
            raise ValueError("currency_code is allowed only for currency formatting")
        return self


class MetricDefinition(FrozenModel):
    metric_id: StableId
    title: Annotated[str, StringConstraints(min_length=1, max_length=80)]
    description: BoundedText
    kind: MetricKind
    unit: MetricUnit
    format: MetricFormat
    initial_value: StrictInt
    min_value: StrictInt
    max_value: StrictInt
    capacity: StrictInt | None = None
    critical_threshold: StrictInt | None = None
    favorable_direction: FavorableDirection

    @model_validator(mode="after")
    def validate_numeric_contract(self) -> Self:
        if self.min_value > self.max_value:
            raise ValueError("metric min_value cannot exceed max_value")
        if not self.min_value <= self.initial_value <= self.max_value:
            raise ValueError("metric initial_value must be within its bounds")
        if self.capacity is not None and not self.min_value <= self.capacity <= self.max_value:
            raise ValueError("metric capacity must be within its bounds")
        if (
            self.critical_threshold is not None
            and not self.min_value <= self.critical_threshold <= self.max_value
        ):
            raise ValueError("metric critical_threshold must be within its bounds")
        if self.kind in {MetricKind.RESOURCE, MetricKind.MONEY} and self.min_value < 0:
            raise ValueError("resource and money metrics must be nonnegative")
        if self.kind in {MetricKind.SCORE, MetricKind.PERCENTAGE} and (
            self.min_value != 0 or self.max_value != 100
        ):
            raise ValueError("score and percentage metrics must use 0 through 100 bounds")
        if self.kind is MetricKind.MONEY and self.unit is not MetricUnit.CENTS:
            raise ValueError("money metrics must use integer cents")
        if self.unit is MetricUnit.CENTS and self.format.style is not DisplayStyle.CURRENCY:
            raise ValueError("cent-based metrics require currency formatting")
        if self.format.style is DisplayStyle.CURRENCY and self.unit is not MetricUnit.CENTS:
            raise ValueError("currency formatting requires cent units")
        return self


class ActionEffect(FrozenModel):
    metric_id: StableId
    operator: EffectOperator
    value: StrictInt = Field(ge=0)
    destination_metric_id: StableId | None = None
    description: BoundedText

    @model_validator(mode="after")
    def validate_operator_shape(self) -> Self:
        if self.operator is EffectOperator.TRANSFER:
            if self.destination_metric_id is None:
                raise ValueError("transfer effects require destination_metric_id")
            if self.destination_metric_id == self.metric_id:
                raise ValueError("transfer source and destination must differ")
        elif self.destination_metric_id is not None:
            raise ValueError("destination_metric_id is allowed only for transfer effects")
        return self


class RecurringRuleTerm(FrozenModel):
    """A declared metric contribution to a recurring calculation."""

    metric_id: StableId
    operator: Literal["add", "subtract"]


class RecurringRule(FrozenModel):
    """Update one metric from its current value and declared metric terms."""

    rule_id: StableId
    target_metric_id: StableId
    terms: tuple[RecurringRuleTerm, ...] = Field(min_length=1)
    underflow_behavior: Literal["reject", "exhaust-at-minimum"] = "reject"
    description: BoundedText

    @model_validator(mode="after")
    def validate_terms(self) -> Self:
        term_ids = [term.metric_id for term in self.terms]
        if len(term_ids) != len(set(term_ids)):
            raise ValueError("recurring rule term metric IDs must be unique")
        if self.target_metric_id in term_ids:
            raise ValueError("recurring rule target cannot also be a term")
        return self


class ConditionClause(FrozenModel):
    reference: ConditionReference
    operator: ComparisonOperator
    value: StrictInt
    metric_id: StableId | None = None
    action_id: StableId | None = None

    @model_validator(mode="after")
    def validate_reference_shape(self) -> Self:
        if self.reference is ConditionReference.METRIC:
            if self.metric_id is None or self.action_id is not None:
                raise ValueError("metric conditions require only metric_id")
        elif self.reference is ConditionReference.ACTION_COUNT:
            if self.action_id is None or self.metric_id is not None:
                raise ValueError("action-count conditions require only action_id")
            if self.value < 0:
                raise ValueError("action-count conditions cannot compare against negatives")
        elif self.metric_id is not None or self.action_id is not None:
            raise ValueError("turn conditions cannot reference metrics or actions")
        return self


class ScenarioAction(FrozenModel):
    action_id: StableId
    title: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    description: BoundedText
    preconditions: tuple[ConditionClause, ...] = ()
    effects: tuple[ActionEffect, ...] = Field(min_length=1)


class EventTrigger(FrozenModel):
    logic: MatchLogic = MatchLogic.ALL
    conditions: tuple[ConditionClause, ...] = Field(min_length=1)
    earliest_turn: PositiveInt = 1
    latest_turn: PositiveInt | None = None

    @model_validator(mode="after")
    def validate_turn_window(self) -> Self:
        if self.latest_turn is not None and self.latest_turn < self.earliest_turn:
            raise ValueError("event latest_turn cannot precede earliest_turn")
        return self


class ScenarioEvent(FrozenModel):
    event_id: StableId
    title: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    description: BoundedText
    trigger: EventTrigger
    effects: tuple[ActionEffect, ...] = Field(min_length=1)
    weight: PositiveInt = 1
    max_occurrences: PositiveInt = 1
    fallback_eligible: bool = True


class OutcomeCondition(FrozenModel):
    condition_id: StableId
    title: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    description: BoundedText
    logic: MatchLogic = MatchLogic.ALL
    conditions: tuple[ConditionClause, ...] = Field(min_length=1)
    priority: StrictInt = Field(default=0, ge=0, le=1000)


class TurnConfiguration(FrozenModel):
    duration: PositiveInt
    unit: TurnUnit
    max_turns: PositiveInt = Field(le=10_000)


class ScenarioCatalogEntry(FrozenModel):
    scenario_id: StableId
    title: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    description: BoundedText
    category: ScenarioCategory
    objective: BoundedText
    availability: AvailabilityStatus
    planned_key_metrics: tuple[
        Annotated[str, StringConstraints(min_length=1, max_length=80)],
        ...,
    ] = Field(min_length=1)


class CalculationParameters(FrozenModel):
    numeric_mode: Literal["strict-integer-v1"] = "strict-integer-v1"
    money_mode: Literal["integer-cents"] = "integer-cents"
    bound_violation: Literal["reject"] = "reject"
    unsupported_operator: Literal["reject"] = "reject"
    missing_reference: Literal["reject"] = "reject"
    effect_order: tuple[
        Literal[
            "action-effects",
            "recurring-rules",
            "event-effects",
            "outcome-evaluation",
        ],
        ...,
    ] = (
        "action-effects",
        "recurring-rules",
        "event-effects",
        "outcome-evaluation",
    )
    random_stream_version: Literal["scenario-seed-v1"] = "scenario-seed-v1"

    @model_validator(mode="after")
    def validate_effect_order(self) -> Self:
        legacy = ("action-effects", "event-effects", "outcome-evaluation")
        current = (
            "action-effects",
            "recurring-rules",
            "event-effects",
            "outcome-evaluation",
        )
        if self.effect_order not in {legacy, current}:
            raise ValueError("effect_order must use a supported deterministic phase order")
        return self


class FallbackPolicy(FrozenModel):
    event_ids: tuple[StableId, ...]
    no_event_allowed: bool


class ScenarioDefinition(FrozenModel):
    scenario_id: StableId
    schema_version: SchemaVersion
    version: ScenarioVersion
    title: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    description: BoundedText
    category: ScenarioCategory
    metadata: ScenarioMetadata
    initial_state: Mapping[StableId, StrictInt]
    metrics: tuple[MetricDefinition, ...] = Field(min_length=1)
    turn: TurnConfiguration
    actions: tuple[ScenarioAction, ...] = Field(min_length=1)
    recurring_rules: tuple[RecurringRule, ...] = ()
    events: tuple[ScenarioEvent, ...] = Field(min_length=1)
    win_conditions: tuple[OutcomeCondition, ...] = Field(min_length=1)
    loss_conditions: tuple[OutcomeCondition, ...] = Field(min_length=1)
    calculation: CalculationParameters
    fallback: FallbackPolicy

    @field_validator("initial_state", mode="after")
    @classmethod
    def freeze_initial_state(
        cls,
        value: Mapping[StableId, StrictInt],
    ) -> Mapping[StableId, StrictInt]:
        return MappingProxyType(dict(value))

    @field_serializer("initial_state")
    def serialize_initial_state(
        self,
        value: Mapping[StableId, StrictInt],
    ) -> dict[str, int]:
        return dict(value)

    @model_validator(mode="after")
    def validate_definition(self) -> Self:
        metrics_by_id = {metric.metric_id: metric for metric in self.metrics}
        metric_ids = self._require_unique(
            (metric.metric_id for metric in self.metrics),
            "metric",
        )
        action_ids = self._require_unique(
            (action.action_id for action in self.actions),
            "action",
        )
        event_ids = self._require_unique(
            (event.event_id for event in self.events),
            "event",
        )
        self._require_unique(
            (rule.rule_id for rule in self.recurring_rules),
            "recurring rule",
        )
        self._require_unique(
            (
                condition.condition_id
                for condition in (*self.win_conditions, *self.loss_conditions)
            ),
            "outcome condition",
        )

        initial_ids = set(self.initial_state)
        if initial_ids != metric_ids:
            missing = sorted(metric_ids - initial_ids)
            extra = sorted(initial_ids - metric_ids)
            raise ValueError(
                f"initial_state metric mismatch; missing={missing}, extra={extra}"
            )
        for metric in self.metrics:
            if self.initial_state[metric.metric_id] != metric.initial_value:
                raise ValueError(
                    f"initial_state value for '{metric.metric_id}' must match "
                    "MetricDefinition.initial_value"
                )

        for action in self.actions:
            self._validate_conditions(action.preconditions, metric_ids, action_ids)
            self._validate_effects(action.effects, metric_ids)
        for rule in self.recurring_rules:
            if rule.target_metric_id not in metric_ids:
                raise ValueError(
                    "recurring rule references unknown target metric "
                    f"'{rule.target_metric_id}'"
                )
            for term in rule.terms:
                if term.metric_id not in metric_ids:
                    raise ValueError(
                        "recurring rule references unknown term metric "
                        f"'{term.metric_id}'"
                    )
                if (
                    term.metric_id in metrics_by_id
                    and metrics_by_id[term.metric_id].unit
                    is not metrics_by_id[rule.target_metric_id].unit
                ):
                    raise ValueError(
                        f"recurring rule '{rule.rule_id}' metrics must share a unit"
                    )
            if (
                rule.underflow_behavior == "exhaust-at-minimum"
                and metrics_by_id[rule.target_metric_id].kind
                not in {MetricKind.MONEY, MetricKind.RESOURCE}
            ):
                raise ValueError(
                    "exhaust-at-minimum is allowed only for money and resource metrics"
                )
        if self.recurring_rules and "recurring-rules" not in self.calculation.effect_order:
            raise ValueError(
                "calculation effect_order must include recurring-rules when rules exist"
            )
        for event in self.events:
            if event.trigger.latest_turn is not None and event.trigger.latest_turn > self.turn.max_turns:
                raise ValueError(
                    f"event '{event.event_id}' latest_turn exceeds scenario turn limit"
                )
            self._validate_conditions(event.trigger.conditions, metric_ids, action_ids)
            self._validate_effects(event.effects, metric_ids)
        for effects in (
            *(action.effects for action in self.actions),
            *(event.effects for event in self.events),
        ):
            for effect in effects:
                if (
                    effect.operator is EffectOperator.TRANSFER
                    and effect.destination_metric_id is not None
                    and effect.destination_metric_id in metrics_by_id
                    and metrics_by_id[effect.metric_id].unit
                    is not metrics_by_id[effect.destination_metric_id].unit
                ):
                    raise ValueError("transfer source and destination must share a unit")
        for outcome in (*self.win_conditions, *self.loss_conditions):
            self._validate_conditions(outcome.conditions, metric_ids, action_ids)
        fallback_ids = set(self.fallback.event_ids)
        if len(fallback_ids) != len(self.fallback.event_ids):
            raise ValueError("duplicate fallback event IDs are not allowed")
        unknown_fallback_ids = fallback_ids - event_ids
        if unknown_fallback_ids:
            raise ValueError(
                f"fallback references unknown events {sorted(unknown_fallback_ids)}"
            )
        eligible_event_ids = {
            event.event_id for event in self.events if event.fallback_eligible
        }
        ineligible_fallback_ids = fallback_ids - eligible_event_ids
        if ineligible_fallback_ids:
            raise ValueError(
                "fallback references events that are not fallback eligible "
                f"{sorted(ineligible_fallback_ids)}"
            )
        if not self.fallback.event_ids and not self.fallback.no_event_allowed:
            raise ValueError(
                "fallback must provide events or explicitly allow no-event turns"
            )

        return self

    @staticmethod
    def _require_unique(values: Iterable[str], label: str) -> set[str]:
        identifiers = list(values)
        unique = set(identifiers)
        if len(unique) != len(identifiers):
            raise ValueError(f"duplicate {label} IDs are not allowed")
        return unique

    @staticmethod
    def _validate_effects(
        effects: tuple[ActionEffect, ...],
        metric_ids: set[str],
    ) -> None:
        for effect in effects:
            if effect.metric_id not in metric_ids:
                raise ValueError(
                    f"effect references unknown metric '{effect.metric_id}'"
                )
            if (
                effect.destination_metric_id is not None
                and effect.destination_metric_id not in metric_ids
            ):
                raise ValueError(
                    "effect references unknown destination metric "
                    f"'{effect.destination_metric_id}'"
                )

    @staticmethod
    def _validate_conditions(
        conditions: tuple[ConditionClause, ...],
        metric_ids: set[str],
        action_ids: set[str],
    ) -> None:
        for condition in conditions:
            if condition.metric_id is not None and condition.metric_id not in metric_ids:
                raise ValueError(
                    f"condition references unknown metric '{condition.metric_id}'"
                )
            if condition.action_id is not None and condition.action_id not in action_ids:
                raise ValueError(
                    f"condition references unknown action '{condition.action_id}'"
                )


class MetricChange(FrozenModel):
    metric_id: StableId
    previous_value: StrictInt
    new_value: StrictInt
    delta: StrictInt
    exhausted: bool = False
    attempted_value: StrictInt | None = None

    @model_validator(mode="after")
    def validate_delta(self) -> Self:
        if self.delta != self.new_value - self.previous_value:
            raise ValueError("metric change delta must equal new minus previous value")
        if self.exhausted != (self.attempted_value is not None):
            raise ValueError(
                "exhausted metric changes must record exactly one attempted value"
            )
        return self


class DecisionRecord(FrozenModel):
    action_id: StableId
    action_title: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    turn: PositiveInt
    sequence: PositiveInt
    event_id: StableId | None = None
    eligible_event_ids: tuple[StableId, ...] = ()
    event_random_draw: StrictInt | None = Field(default=None, ge=0)
    metric_changes: tuple[MetricChange, ...] = ()
    resulting_status: GameStatus = GameStatus.ACTIVE
    outcome_reason: StableId = "turn-completed"


class SeedMetadata(FrozenModel):
    seed: StrictInt = Field(ge=0, le=9_223_372_036_854_775_807)
    stream_version: Literal["scenario-seed-v1"] = "scenario-seed-v1"


class GameState(FrozenModel):
    scenario_id: StableId
    scenario_version: ScenarioVersion
    current_turn: PositiveInt
    max_turns: PositiveInt
    metric_values: Mapping[StableId, StrictInt]
    status: GameStatus
    decision_history: tuple[DecisionRecord, ...]
    seed: SeedMetadata

    @field_validator("metric_values", mode="after")
    @classmethod
    def freeze_metric_values(
        cls,
        value: Mapping[StableId, StrictInt],
    ) -> Mapping[StableId, StrictInt]:
        return MappingProxyType(dict(value))

    @field_serializer("metric_values")
    def serialize_metric_values(
        self,
        value: Mapping[StableId, StrictInt],
    ) -> dict[str, int]:
        return dict(value)

    @model_validator(mode="after")
    def validate_turn(self) -> Self:
        if self.current_turn > self.max_turns:
            raise ValueError("current_turn cannot exceed max_turns")
        history_count = len(self.decision_history)
        if history_count > self.max_turns:
            raise ValueError("decision history cannot exceed max_turns")
        if any(
            record.sequence != index or record.turn != index
            for index, record in enumerate(self.decision_history, start=1)
        ):
            raise ValueError("decision history turn and sequence values must be contiguous")
        if self.status is GameStatus.NOT_STARTED:
            if history_count != 0 or self.current_turn != 1:
                raise ValueError("not-started state cannot contain completed turns")
        elif self.status is GameStatus.ACTIVE:
            if history_count == 0 or history_count >= self.max_turns:
                raise ValueError("active state requires an unfinished decision history")
            if self.current_turn != history_count + 1:
                raise ValueError("active state current_turn must be the next turn")
        elif history_count == 0 or self.current_turn != history_count:
            raise ValueError("terminal state current_turn must be its last completed turn")
        return self


def initialize_game_state(
    definition: ScenarioDefinition,
    *,
    seed: int,
) -> GameState:
    """Create an untouched state snapshot without evaluating a turn."""

    return GameState(
        scenario_id=definition.scenario_id,
        scenario_version=definition.version,
        current_turn=1,
        max_turns=definition.turn.max_turns,
        metric_values=dict(definition.initial_state),
        status=GameStatus.NOT_STARTED,
        decision_history=(),
        seed=SeedMetadata(seed=seed),
    )
