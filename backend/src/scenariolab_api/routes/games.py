from __future__ import annotations

import secrets
from typing import NoReturn

from fastapi import APIRouter, HTTPException, status

from scenariolab_api.domain.enums import AvailabilityStatus, GameStatus
from scenariolab_api.domain.models import GameState, ScenarioDefinition
from scenariolab_api.engine import (
    EngineError,
    get_available_actions,
    initialize_game,
    resolve_turn,
)
from scenariolab_api.scenarios import get_catalog_entry, get_scenario_definition
from scenariolab_api.schemas import (
    ErrorResponse,
    GameStartRequest,
    GameStartResponse,
    GameTurnRequest,
    GameTurnResponse,
    ScenarioDisplayMetadata,
)

router = APIRouter(prefix="/api/games", tags=["games"])

ERROR_RESPONSES = {
    status.HTTP_404_NOT_FOUND: {
        "model": ErrorResponse,
        "description": "The requested scenario is not registered.",
    },
    status.HTTP_409_CONFLICT: {
        "model": ErrorResponse,
        "description": "The scenario or reconstructed game cannot accept the request.",
    },
    status.HTTP_422_UNPROCESSABLE_CONTENT: {
        "model": ErrorResponse,
        "description": "The request or replay history is invalid.",
    },
}


@router.post(
    "/start",
    response_model=GameStartResponse,
    responses=ERROR_RESPONSES,
)
def start_game(request: GameStartRequest) -> GameStartResponse:
    definition = _get_playable_definition(request.scenario_id)
    seed = request.seed if request.seed is not None else secrets.randbits(53)
    state = initialize_game(definition, seed)
    return GameStartResponse(
        scenario_id=definition.scenario_id,
        scenario_version=definition.version,
        seed=seed,
        state=state,
        available_actions=tuple(get_available_actions(definition, state)),
        scenario=_display_metadata(definition),
    )


@router.post(
    "/turn",
    response_model=GameTurnResponse,
    responses=ERROR_RESPONSES,
)
def play_turn(request: GameTurnRequest) -> GameTurnResponse:
    definition = _get_playable_definition(request.scenario_id)
    if request.scenario_version != definition.version:
        _raise_api_error(
            status.HTTP_409_CONFLICT,
            "scenario_version_mismatch",
            (
                f"Scenario '{request.scenario_id}' version "
                f"'{request.scenario_version}' is not available."
            ),
        )
    if len(request.action_history) > definition.turn.max_turns:
        _raise_api_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "invalid_replay_history",
            "Action history exceeds the scenario turn limit.",
        )

    state = _replay_history(definition, request.seed, request.action_history)
    if state.status in {GameStatus.WON, GameStatus.LOST}:
        _raise_api_error(
            status.HTTP_409_CONFLICT,
            "game_already_complete",
            "The replayed game is terminal and cannot accept another action.",
        )

    try:
        turn_result = resolve_turn(definition, state, request.action_id)
    except EngineError as error:
        _raise_engine_error(error)

    new_state = turn_result.new_state
    return GameTurnResponse(
        scenario_id=definition.scenario_id,
        scenario_version=definition.version,
        seed=request.seed,
        state=new_state,
        turn_result=turn_result,
        available_actions=tuple(get_available_actions(definition, new_state)),
        action_history=(*request.action_history, request.action_id),
    )


def _get_playable_definition(scenario_id: str) -> ScenarioDefinition:
    catalog_entry = get_catalog_entry(scenario_id)
    if catalog_entry is None:
        _raise_api_error(
            status.HTTP_404_NOT_FOUND,
            "scenario_not_found",
            f"Scenario '{scenario_id}' is not registered.",
        )
    if catalog_entry.availability is AvailabilityStatus.PLANNED:
        _raise_api_error(
            status.HTTP_409_CONFLICT,
            "scenario_not_available",
            f"Scenario '{scenario_id}' is planned but is not available for play.",
        )
    definition = get_scenario_definition(scenario_id)
    if definition is None:
        _raise_api_error(
            status.HTTP_409_CONFLICT,
            "scenario_definition_missing",
            f"Scenario '{scenario_id}' has no validated definition.",
        )
    return definition


def _replay_history(
    definition: ScenarioDefinition,
    seed: int,
    action_history: tuple[str, ...],
) -> GameState:
    state = initialize_game(definition, seed)
    for turn_index, action_id in enumerate(action_history, start=1):
        try:
            state = resolve_turn(definition, state, action_id).new_state
        except EngineError as error:
            _raise_api_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "invalid_replay_history",
                (
                    f"Action history is invalid at turn {turn_index}: "
                    f"{error.code}."
                ),
            )
    return state


def _display_metadata(definition: ScenarioDefinition) -> ScenarioDisplayMetadata:
    return ScenarioDisplayMetadata(
        title=definition.title,
        description=definition.description,
        objective=definition.metadata.objective,
        turn=definition.turn,
        metrics=definition.metrics,
    )


def _raise_engine_error(error: EngineError) -> NoReturn:
    if error.code == "game-already-complete":
        status_code = status.HTTP_409_CONFLICT
    elif error.code == "action-not-eligible":
        status_code = status.HTTP_409_CONFLICT
    else:
        status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    _raise_api_error(
        status_code,
        error.code.replace("-", "_"),
        str(error),
    )


def _raise_api_error(status_code: int, code: str, message: str) -> NoReturn:
    raise HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )
