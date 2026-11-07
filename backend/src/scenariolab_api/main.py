from fastapi import FastAPI, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from scenariolab_api.ai import create_briefing_service
from scenariolab_api.config import Settings, get_settings
from scenariolab_api.director.service import DirectorFailure, DirectorService
from scenariolab_api.routes.ai import router as ai_router
from scenariolab_api.routes.director import router as director_router
from scenariolab_api.routes.games import router as games_router
from scenariolab_api.routes.health import router as health_router
from scenariolab_api.routes.scenarios import router as scenarios_router
from scenariolab_api.request_limits import RequestBodyLimitMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    app = FastAPI(
        title=app_settings.service_name,
        version="0.1.0",
    )
    app.state.settings = app_settings
    app.state.briefing_service = create_briefing_service(app_settings)
    app.state.director_service = DirectorService(app_settings)
    app.add_middleware(
        RequestBodyLimitMiddleware,
        max_body_bytes=app_settings.max_request_body_bytes,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(app_settings.frontend_origin).rstrip("/")],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Accept", "Content-Type"],
    )

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation(
        _request: object,
        _error: RequestValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={
                "detail": {
                    "code": "invalid_request",
                    "message": "Request data did not match the expected contract.",
                }
            },
        )

    @app.exception_handler(DirectorFailure)
    async def handle_director_failure(
        _request: object,
        error: DirectorFailure,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={
                "detail": {
                    "code": error.code,
                    "message": str(error),
                }
            },
        )

    app.include_router(health_router)
    app.include_router(scenarios_router)
    app.include_router(games_router)
    app.include_router(ai_router)
    app.include_router(director_router)
    return app


app = create_app()
