from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Annotated, Literal, Self

from pydantic import ConfigDict, Field, PositiveInt, StrictInt, StringConstraints, field_serializer, field_validator, model_validator

from scenariolab_api.domain.models import (
    FrozenModel,
    GameState,
    MetricChange,
    ScenarioVersion,
    StableId,
)
from scenariolab_api.domain.enums import GameStatus
from scenariolab_api.engine.models import TurnResult
from scenariolab_api.director.canonical import canonical_json_bytes

DirectorText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Digest = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{64}$")]
DirectorSeed = Annotated[StrictInt, Field(ge=0, le=9_007_199_254_740_991)]
MAX_TURN_RECORD_BYTES = 4_096
MAX_HISTORY_BYTES = 56_000


class DirectorEffect(FrozenModel):
    """Untrusted candidate effect after structural validation."""

    metric_id: StableId
    operator: Literal["add", "subtract"]
    value: StrictInt = Field(gt=0)


class DirectorChoiceCandidate(FrozenModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    effects: tuple[DirectorEffect, ...] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def unique_effect_targets(self) -> Self:
        metric_ids = [effect.metric_id for effect in self.effects]
        if len(metric_ids) != len(set(metric_ids)):
            raise ValueError("a choice may target each metric only once")
        return self


class DirectorSituation(FrozenModel):
    situation_id: StableId
    beat_id: Literal["acquisition", "supplier", "retention", "partnership"]
    headline: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class DirectorChoice(DirectorChoiceCandidate):
    choice_id: StableId


class DirectorContextSnapshot(FrozenModel):
    context_version: Literal["1"] = "1"
    scenario_id: StableId
    scenario_version: ScenarioVersion
    profile_id: StableId
    profile_version: ScenarioVersion
    seed: DirectorSeed
    turn: PositiveInt
    metric_values: Mapping[StableId, StrictInt]
    recent_action_ids: tuple[StableId, ...] = Field(max_length=3)
    recent_event_ids: tuple[StableId, ...] = Field(max_length=3)
    recent_beats: tuple[Literal["acquisition", "supplier", "retention", "partnership"], ...] = Field(max_length=3)
    recent_headline_digests: tuple[Digest, ...] = Field(max_length=12)

    model_config = ConfigDict(extra="forbid", frozen=True)

    @field_validator("metric_values", mode="after")
    @classmethod
    def freeze_metrics(cls, value: Mapping[str, int]) -> Mapping[str, int]:
        return MappingProxyType(dict(value))

    @field_serializer("metric_values")
    def serialize_metrics(self, value: Mapping[str, int]) -> dict[str, int]:
        return dict(value)


class DirectorProposalPayload(FrozenModel):
    record_format_version: Literal[1] = 1
    context_version: Literal["1"] = "1"
    profile_id: StableId
    profile_version: ScenarioVersion
    scenario_id: StableId
    scenario_version: ScenarioVersion
    seed: DirectorSeed
    turn: PositiveInt
    previous_state_digest: Digest
    previous_history_digest: Digest
    context_digest: Digest
    context_snapshot: DirectorContextSnapshot
    source: Literal["fallback"] = "fallback"
    situation: DirectorSituation
    choices: tuple[DirectorChoice, ...] = Field(min_length=2, max_length=4)

    @model_validator(mode="after")
    def validate_unique_choices(self) -> Self:
        context = self.context_snapshot
        if (
            context.profile_id != self.profile_id
            or context.profile_version != self.profile_version
            or context.scenario_id != self.scenario_id
            or context.scenario_version != self.scenario_version
            or context.seed != self.seed
            or context.turn != self.turn
        ):
            raise ValueError("proposal context must match the signed run identity")
        ids = [choice.choice_id for choice in self.choices]
        if len(ids) != len(set(ids)):
            raise ValueError("proposal choice IDs must be unique")
        return self


class HMACSignature(FrozenModel):
    algorithm: Literal["HMAC-SHA256"] = "HMAC-SHA256"
    key_id: StableId
    value: Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{43}$")]


class SignedDirectorProposal(FrozenModel):
    payload: DirectorProposalPayload
    signature: HMACSignature


class DirectorChoicePreview(FrozenModel):
    choice_id: StableId
    metric_changes: tuple[MetricChange, ...]
    projected_status: GameStatus
    outcome_reason: StableId
    scripted_event_id: StableId | None = None
    scripted_event_title: Annotated[str, StringConstraints(max_length=100)] | None = None


class DirectorReceiptPayload(FrozenModel):
    record_format_version: Literal[1] = 1
    profile_id: StableId
    profile_version: ScenarioVersion
    scenario_id: StableId
    scenario_version: ScenarioVersion
    seed: DirectorSeed
    turn: PositiveInt
    previous_state_digest: Digest
    previous_history_digest: Digest
    proposal_digest: Digest
    selected_choice_id: StableId
    resulting_state_digest: Digest
    result_digest: Digest


class SignedDirectorReceipt(FrozenModel):
    payload: DirectorReceiptPayload
    signature: HMACSignature


class DirectorTurnRecord(FrozenModel):
    proposal: SignedDirectorProposal
    selected_choice_id: StableId
    receipt: SignedDirectorReceipt

    @model_validator(mode="after")
    def selected_choice_matches_receipt(self) -> Self:
        if self.selected_choice_id != self.receipt.payload.selected_choice_id:
            raise ValueError("selected choice must match the signed receipt")
        if self.selected_choice_id not in {
            choice.choice_id for choice in self.proposal.payload.choices
        }:
            raise ValueError("selected choice must be part of the signed proposal")
        if len(canonical_json_bytes(self)) > MAX_TURN_RECORD_BYTES:
            raise ValueError("Director turn record exceeds the byte limit")
        return self


class DirectorReplayHistory(FrozenModel):
    format_version: Literal[2] = 2
    mode: Literal["director"] = "director"
    scenario_id: StableId
    scenario_version: ScenarioVersion
    seed: DirectorSeed
    profile_id: StableId
    profile_version: ScenarioVersion
    turn_records: tuple[DirectorTurnRecord, ...] = Field(max_length=12)

    @model_validator(mode="after")
    def enforce_history_size(self) -> Self:
        for turn, record in enumerate(self.turn_records, start=1):
            payload = record.proposal.payload
            receipt = record.receipt.payload
            if (
                payload.turn != turn
                or receipt.turn != turn
                or payload.scenario_id != self.scenario_id
                or payload.scenario_version != self.scenario_version
                or payload.seed != self.seed
                or payload.profile_id != self.profile_id
                or payload.profile_version != self.profile_version
            ):
                raise ValueError("Director records must match the ordered replay identity")
        if len(canonical_json_bytes(self)) > MAX_HISTORY_BYTES:
            raise ValueError("Director replay history exceeds the byte limit")
        return self


class DirectorProposalRequest(DirectorReplayHistory):
    pass


class DirectorReplayRequest(DirectorReplayHistory):
    pass


class DirectorTurnRequest(DirectorReplayHistory):
    proposal: SignedDirectorProposal
    selected_choice_id: StableId


class DirectorReplayResponse(FrozenModel):
    scenario_id: StableId
    scenario_version: ScenarioVersion
    seed: DirectorSeed
    state: GameState
    latest_turn_record: DirectorTurnRecord | None
    latest_turn_result: TurnResult | None


class DirectorProposalResponse(FrozenModel):
    scenario_id: StableId
    scenario_version: ScenarioVersion
    seed: DirectorSeed
    state: GameState
    proposal: SignedDirectorProposal
    previews: tuple[DirectorChoicePreview, ...]


class DirectorTurnResponse(FrozenModel):
    scenario_id: StableId
    scenario_version: ScenarioVersion
    seed: DirectorSeed
    state: GameState
    turn_result: TurnResult
    turn_record: DirectorTurnRecord
