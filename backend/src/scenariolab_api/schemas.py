from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StringConstraints

from scenariolab_api.domain.models import (
    GameState,
    MetricDefinition,
    ScenarioAction,
    ScenarioVersion,
    StableId,
    TurnConfiguration,
)
from scenariolab_api.engine.models import TurnResult

# JSON/JavaScript clients can round larger integers, which would break replay identity.
SeedValue = Annotated[StrictInt, Field(ge=0, le=9_007_199_254_740_991)]


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    status: Literal["ok"] = "ok"
    service: str


class ErrorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    code: str
    message: str


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    detail: ErrorDetail


class GameStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    scenario_id: StableId
    seed: SeedValue | None = None


class GameTurnRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    scenario_id: StableId
    scenario_version: ScenarioVersion
    seed: SeedValue
    action_history: tuple[StableId, ...] = Field(default=(), max_length=10_000)
    action_id: StableId


class ScenarioDisplayMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    title: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    description: Annotated[str, StringConstraints(min_length=1, max_length=500)]
    objective: Annotated[str, StringConstraints(min_length=1, max_length=500)]
    turn: TurnConfiguration
    metrics: tuple[MetricDefinition, ...]


class GameStartResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    scenario_id: StableId
    scenario_version: ScenarioVersion
    seed: SeedValue
    state: GameState
    available_actions: tuple[ScenarioAction, ...]
    scenario: ScenarioDisplayMetadata


class GameTurnResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    scenario_id: StableId
    scenario_version: ScenarioVersion
    seed: SeedValue
    state: GameState
    turn_result: TurnResult
    available_actions: tuple[ScenarioAction, ...]
    action_history: tuple[StableId, ...]
