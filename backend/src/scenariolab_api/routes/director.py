from fastapi import APIRouter, Request

from scenariolab_api.director.models import (
    DirectorProposalRequest,
    DirectorProposalResponse,
    DirectorReplayRequest,
    DirectorReplayResponse,
    DirectorTurnRequest,
    DirectorTurnResponse,
)
from scenariolab_api.director.service import DirectorService
from scenariolab_api.schemas import ErrorResponse

router = APIRouter(prefix="/api/ai/director", tags=["ai-director"])

DIRECTOR_ERRORS = {
    413: {"model": ErrorResponse, "description": "The Director history exceeds the request or replay size limit."},
    409: {"model": ErrorResponse, "description": "The Director request is stale or unsupported."},
    422: {"model": ErrorResponse, "description": "The Director record is invalid or tampered."},
    503: {"model": ErrorResponse, "description": "Director mode or signing is unavailable."},
}


@router.post("/proposal", response_model=DirectorProposalResponse, responses=DIRECTOR_ERRORS)
def create_director_proposal(
    request: DirectorProposalRequest,
    http_request: Request,
) -> DirectorProposalResponse:
    return _service(http_request).propose(request)


@router.post("/turn", response_model=DirectorTurnResponse, responses=DIRECTOR_ERRORS)
def play_director_turn(
    request: DirectorTurnRequest,
    http_request: Request,
) -> DirectorTurnResponse:
    return _service(http_request).take_turn(request)


@router.post("/replay", response_model=DirectorReplayResponse, responses=DIRECTOR_ERRORS)
def replay_director_run(
    request: DirectorReplayRequest,
    http_request: Request,
) -> DirectorReplayResponse:
    return _service(http_request).replay_response(request)


def _service(request: Request) -> DirectorService:
    return request.app.state.director_service
