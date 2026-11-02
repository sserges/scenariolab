from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from scenariolab_api.domain.enums import FavorableDirection, GameStatus
from scenariolab_api.domain.models import StableId

NarrativeText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=500),
]
HeadlineText = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=140),
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class BriefingContent(StrictModel):
    headline: HeadlineText
    situation_summary: NarrativeText
    consequence_explanation: NarrativeText
    strategic_insight: NarrativeText
    next_turn_teaser: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=240),
    ]

    @field_validator("*")
    @classmethod
    def reject_control_characters(cls, value: str) -> str:
        if any(ord(character) < 32 and character not in {"\n", "\t"} for character in value):
            raise ValueError("briefing text cannot contain control characters")
        return value


class BriefingResponse(BriefingContent):
    source: Literal["live", "fallback"]


class MetricChangeFact(StrictModel):
    metric_id: StableId
    title: str
    unit: str
    previous_value: int
    new_value: int
    delta: int
    favorable_direction: FavorableDirection


class CurrentMetricFact(StrictModel):
    metric_id: StableId
    title: str
    unit: str
    value: int
    critical_threshold: int | None
    favorable_direction: FavorableDirection


class EventFact(StrictModel):
    event_id: StableId
    title: str
    description: str


class BriefingContext(StrictModel):
    scenario_id: StableId
    scenario_version: str
    scenario_title: str
    scenario_objective: str
    completed_turn: int = Field(ge=1)
    current_turn: int = Field(ge=1)
    selected_action_id: StableId
    selected_action_title: str
    selected_action_description: str
    triggered_event: EventFact | None
    metric_changes: tuple[MetricChangeFact, ...]
    current_metrics: tuple[CurrentMetricFact, ...]
    game_status: GameStatus
    outcome_reason: StableId
