from fastapi import APIRouter, Request

from scenariolab_api.config import Settings
from scenariolab_api.schemas import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def get_health(request: Request) -> HealthResponse:
    settings: Settings = request.app.state.settings
    return HealthResponse(service=settings.service_name)
