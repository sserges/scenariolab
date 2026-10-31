from fastapi import FastAPI, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from scenariolab_api.config import Settings, get_settings
from scenariolab_api.routes.games import router as games_router
from scenariolab_api.routes.health import router as health_router
from scenariolab_api.routes.scenarios import router as scenarios_router


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    app = FastAPI(
        title=app_settings.service_name,
        version="0.1.0",
    )
    app.state.settings = app_settings
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

    app.include_router(health_router)
    app.include_router(scenarios_router)
    app.include_router(games_router)
    return app


app = create_app()
