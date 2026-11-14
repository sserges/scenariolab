from fastapi import APIRouter, HTTPException, Request, status

from scenariolab_api.ai.grounding import build_briefing_context
from scenariolab_api.ai.models import BriefingResponse
from scenariolab_api.ai.service import BriefingService
from scenariolab_api.domain.enums import ScenarioAIFeature
from scenariolab_api.routes.games import _get_playable_definition, replay_history
from scenariolab_api.scenarios import get_catalog_entry
from scenariolab_api.schemas import AIBriefingRequest, ErrorResponse

router = APIRouter(prefix="/api/ai", tags=["ai"])

ERROR_RESPONSES = {
    status.HTTP_404_NOT_FOUND: {
        "model": ErrorResponse,
        "description": "The requested scenario is not registered.",
    },
    status.HTTP_409_CONFLICT: {
        "model": ErrorResponse,
        "description": "The scenario version is unavailable.",
    },
    status.HTTP_422_UNPROCESSABLE_CONTENT: {
        "model": ErrorResponse,
        "description": "The request or replay history is invalid.",
    },
}


@router.post(
    "/briefing",
    response_model=BriefingResponse,
    responses=ERROR_RESPONSES,
)
def create_briefing(
    briefing_request: AIBriefingRequest,
    http_request: Request,
) -> BriefingResponse:
    definition = _get_playable_definition(briefing_request.scenario_id)
    if briefing_request.scenario_version != definition.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "scenario_version_mismatch",
                "message": (
                    f"Scenario '{briefing_request.scenario_id}' version "
                    f"'{briefing_request.scenario_version}' is not available."
                ),
            },
        )
    if not briefing_request.action_history:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "no_completed_turns",
                "message": "At least one completed action is required for a briefing.",
            },
        )
    if len(briefing_request.action_history) > definition.turn.max_turns:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "invalid_replay_history",
                "message": "Action history exceeds the scenario turn limit.",
            },
        )

    _state, latest_result = replay_history(
        definition,
        briefing_request.seed,
        briefing_request.action_history,
    )
    if latest_result is None:  # Defensive; empty histories are rejected above.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "no_completed_turns", "message": "No turn was completed."},
        )

    service: BriefingService = http_request.app.state.briefing_service
    caller_key = http_request.client.host if http_request.client is not None else "unknown"
    catalog_entry = get_catalog_entry(definition.scenario_id)
    allow_live = (
        catalog_entry is not None
        and ScenarioAIFeature.LIVE_BRIEFINGS in catalog_entry.ai_features
    )
    return service.generate(
        build_briefing_context(definition, latest_result),
        caller_key=caller_key,
        allow_live=allow_live,
    )
