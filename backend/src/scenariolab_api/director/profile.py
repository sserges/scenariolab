from typing import Literal

from pydantic import Field, StrictInt, model_validator
from typing import Self

from scenariolab_api.domain.models import FrozenModel, ScenarioVersion, StableId


class DirectorMetricRule(FrozenModel):
    metric_id: StableId
    operators: tuple[Literal["add", "subtract"], ...] = Field(min_length=1)
    max_effect_value: StrictInt = Field(gt=0)
    max_turn_total: StrictInt = Field(gt=0)


class DirectorProfile(FrozenModel):
    profile_id: StableId
    version: ScenarioVersion
    scenario_id: StableId
    scenario_version: ScenarioVersion
    minimum_choices: StrictInt = Field(ge=2, le=4)
    maximum_choices: StrictInt = Field(ge=2, le=4)
    maximum_effects_per_choice: StrictInt = Field(ge=1, le=3)
    maximum_effects_per_turn: StrictInt = Field(ge=1, le=3)
    maximum_cash_debit_per_turn: StrictInt = Field(gt=0)
    metrics: tuple[DirectorMetricRule, ...]

    @model_validator(mode="after")
    def validate_limits(self) -> Self:
        if self.minimum_choices > self.maximum_choices:
            raise ValueError("minimum choices cannot exceed maximum choices")
        metric_ids = [rule.metric_id for rule in self.metrics]
        if len(metric_ids) != len(set(metric_ids)):
            raise ValueError("Director profile metric IDs must be unique")
        if self.maximum_effects_per_turn > self.maximum_effects_per_choice:
            raise ValueError("per-turn effects cannot exceed per-choice effects")
        return self


STARTUP_SURVIVAL_DIRECTOR_PROFILE = DirectorProfile(
    profile_id="startup-survival-director",
    version="1.0.0",
    scenario_id="startup-survival",
    scenario_version="1.0.0",
    minimum_choices=2,
    maximum_choices=4,
    maximum_effects_per_choice=3,
    maximum_effects_per_turn=3,
    maximum_cash_debit_per_turn=2_000_000,
    metrics=(
        DirectorMetricRule(
            metric_id="cash",
            operators=("subtract",),
            max_effect_value=2_000_000,
            max_turn_total=2_000_000,
        ),
        DirectorMetricRule(
            metric_id="monthly-revenue",
            operators=("subtract",),
            max_effect_value=250_000,
            max_turn_total=250_000,
        ),
        DirectorMetricRule(
            metric_id="monthly-expenses",
            operators=("add", "subtract"),
            max_effect_value=400_000,
            max_turn_total=400_000,
        ),
        DirectorMetricRule(
            metric_id="active-users",
            operators=("add", "subtract"),
            max_effect_value=1_000,
            max_turn_total=1_000,
        ),
        DirectorMetricRule(
            metric_id="employees",
            operators=("add", "subtract"),
            max_effect_value=2,
            max_turn_total=2,
        ),
        DirectorMetricRule(
            metric_id="customer-satisfaction",
            operators=("add", "subtract"),
            max_effect_value=8,
            max_turn_total=8,
        ),
        DirectorMetricRule(
            metric_id="team-morale",
            operators=("add", "subtract"),
            max_effect_value=8,
            max_turn_total=8,
        ),
    ),
)
