from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from backend environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="SCENARIOLAB_",
        extra="ignore",
    )

    service_name: Literal["scenariolab-api"] = "scenariolab-api"
    frontend_origin: AnyHttpUrl = AnyHttpUrl("http://localhost:5173")


@lru_cache
def get_settings() -> Settings:
    return Settings()
