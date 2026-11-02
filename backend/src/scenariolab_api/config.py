from functools import lru_cache
from typing import Annotated, Literal

from pydantic import AnyHttpUrl, Field, SecretStr, StringConstraints
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
    ai_api_key: SecretStr | None = None
    ai_model: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
    ] | None = None
    ai_base_url: AnyHttpUrl = AnyHttpUrl("https://api.openai.com/v1")
    ai_timeout_seconds: float = Field(default=10.0, ge=1.0, le=30.0)
    ai_max_response_tokens: int = Field(default=500, ge=100, le=800)
    ai_provider_calls_per_minute: int = Field(default=20, ge=1, le=120)


@lru_cache
def get_settings() -> Settings:
    return Settings()
