from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from scenariolab_api.config import Settings, get_settings
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
        allow_methods=["GET"],
        allow_headers=["Accept", "Content-Type"],
    )
    app.include_router(health_router)
    app.include_router(scenarios_router)
    return app


app = create_app()
