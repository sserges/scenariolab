from scenariolab_api.ai.models import (
    BriefingContext,
    CurrentMetricFact,
    EventFact,
    MetricChangeFact,
)
from scenariolab_api.domain.models import ScenarioDefinition
from scenariolab_api.engine.models import TurnResult


def build_briefing_context(
    definition: ScenarioDefinition,
    result: TurnResult,
) -> BriefingContext:
    metrics = {metric.metric_id: metric for metric in definition.metrics}
    changes = tuple(
        MetricChangeFact(
            metric_id=change.metric_id,
            title=metrics[change.metric_id].title,
            unit=metrics[change.metric_id].unit.value,
            previous_value=change.previous_value,
            new_value=change.new_value,
            delta=change.delta,
            favorable_direction=metrics[change.metric_id].favorable_direction,
        )
        for change in result.metric_changes
    )
    current_metrics = tuple(
        CurrentMetricFact(
            metric_id=metric.metric_id,
            title=metric.title,
            unit=metric.unit.value,
            value=result.new_state.metric_values[metric.metric_id],
            critical_threshold=metric.critical_threshold,
            favorable_direction=metric.favorable_direction,
        )
        for metric in definition.metrics
    )
    event = result.triggered_event
    return BriefingContext(
        scenario_id=definition.scenario_id,
        scenario_version=definition.version,
        scenario_title=definition.title,
        scenario_objective=definition.metadata.objective,
        completed_turn=result.completed_turn_index,
        current_turn=result.new_state.current_turn,
        selected_action_id=result.selected_action.action_id,
        selected_action_title=result.selected_action.title,
        selected_action_description=result.selected_action.description,
        triggered_event=(
            EventFact(
                event_id=event.event_id,
                title=event.title,
                description=event.description,
            )
            if event is not None
            else None
        ),
        metric_changes=changes,
        current_metrics=current_metrics,
        game_status=result.resulting_status,
        outcome_reason=result.outcome_reason,
    )
