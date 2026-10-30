from fastapi import APIRouter, HTTPException, status

from scenariolab_api.domain.enums import AvailabilityStatus
from scenariolab_api.domain.models import ScenarioCatalogEntry, ScenarioDefinition
from scenariolab_api.scenarios import (
    PREDEFINED_SCENARIO_CATALOG,
    get_catalog_entry,
    get_scenario_definition,
)
from scenariolab_api.schemas import ErrorResponse

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.get("", response_model=list[ScenarioCatalogEntry])
def list_scenarios() -> tuple[ScenarioCatalogEntry, ...]:
    return PREDEFINED_SCENARIO_CATALOG


@router.get(
    "/{scenario_id}",
    response_model=ScenarioDefinition,
    responses={
        status.HTTP_404_NOT_FOUND: {
            "model": ErrorResponse,
            "description": "The scenario ID is not registered.",
        },
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "The scenario is cataloged but not yet playable.",
        },
    },
)
def get_scenario(scenario_id: str) -> ScenarioDefinition:
    catalog_entry = get_catalog_entry(scenario_id)
    if catalog_entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "scenario_not_found",
                "message": f"Scenario '{scenario_id}' is not registered.",
            },
        )
    if catalog_entry.availability is AvailabilityStatus.PLANNED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "scenario_not_available",
                "message": (
                    f"Scenario '{scenario_id}' is planned but is not available "
                    "for play."
                ),
            },
        )

    definition = get_scenario_definition(scenario_id)
    if definition is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "scenario_definition_missing",
                "message": (
                    f"Scenario '{scenario_id}' is marked available but has no "
                    "validated definition."
                ),
            },
        )
    return definition
