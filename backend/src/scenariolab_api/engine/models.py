from pydantic import Field, StrictInt

from scenariolab_api.domain.enums import GameStatus
from scenariolab_api.domain.models import (
    DecisionRecord,
    FrozenModel,
    GameState,
    MetricChange,
    ScenarioAction,
    ScenarioEvent,
    StableId,
)


class TurnResult(FrozenModel):
    """The complete immutable record returned for one accepted decision."""

    previous_state: GameState
    new_state: GameState
    selected_action: ScenarioAction
    triggered_event: ScenarioEvent | None
    eligible_event_ids: tuple[StableId, ...]
    event_random_draw: StrictInt | None = Field(default=None, ge=0)
    metric_changes: tuple[MetricChange, ...]
    completed_turn_index: StrictInt = Field(ge=1)
    resulting_status: GameStatus
    outcome_reason: StableId
    decision_record: DecisionRecord

