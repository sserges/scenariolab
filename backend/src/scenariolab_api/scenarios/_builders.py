"""Terse constructors for declarative scenario data.

These helpers only build validated contract models. They contain no gameplay
logic, so every scenario remains plain ``ScenarioDefinition`` data.
"""

from scenariolab_api.domain.enums import (
    ComparisonOperator,
    ConditionReference,
    EffectOperator,
)
from scenariolab_api.domain.models import ActionEffect, ConditionClause

_OPERATORS = {
    "<": ComparisonOperator.LESS_THAN,
    "<=": ComparisonOperator.LESS_THAN_OR_EQUAL,
    "==": ComparisonOperator.EQUAL,
    ">=": ComparisonOperator.GREATER_THAN_OR_EQUAL,
    ">": ComparisonOperator.GREATER_THAN,
}


def metric_is(metric_id: str, operator: str, value: int) -> ConditionClause:
    return ConditionClause(
        reference=ConditionReference.METRIC,
        metric_id=metric_id,
        operator=_OPERATORS[operator],
        value=value,
    )


def turn_is(operator: str, value: int) -> ConditionClause:
    return ConditionClause(
        reference=ConditionReference.TURN,
        operator=_OPERATORS[operator],
        value=value,
    )


def action_count_is(action_id: str, operator: str, value: int) -> ConditionClause:
    return ConditionClause(
        reference=ConditionReference.ACTION_COUNT,
        action_id=action_id,
        operator=_OPERATORS[operator],
        value=value,
    )


def add(metric_id: str, value: int, description: str) -> ActionEffect:
    return ActionEffect(
        metric_id=metric_id,
        operator=EffectOperator.ADD,
        value=value,
        description=description,
    )


def subtract(metric_id: str, value: int, description: str) -> ActionEffect:
    return ActionEffect(
        metric_id=metric_id,
        operator=EffectOperator.SUBTRACT,
        value=value,
        description=description,
    )
