from functools import lru_cache
from typing import Annotated, Literal

from pydantic import AnyHttpUrl, Field, SecretStr, StringConstraints, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DirectorKeyId = Annotated[
    str,
    StringConstraints(pattern=r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$", max_length=64),
]


class Settings(BaseSettings):
    """Runtime settings loaded from backend environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="SCENARIOLAB_",
        extra="ignore",
    )

    service_name: Literal["scenariolab-api"] = "scenariolab-api"
    environment: Literal["development", "production"] = "development"
    frontend_origin: AnyHttpUrl = AnyHttpUrl("http://localhost:5173")
    max_request_body_bytes: int = Field(default=65_536, ge=1_024, le=1_048_576)
    ai_enabled: bool = False
    ai_api_key: SecretStr | None = None
    ai_model: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
    ] | None = None
    ai_base_url: AnyHttpUrl = AnyHttpUrl("https://api.openai.com/v1")
    ai_timeout_seconds: float = Field(default=10.0, ge=1.0, le=30.0)
    ai_max_response_tokens: int = Field(default=500, ge=100, le=800)
    ai_provider_calls_per_minute: int = Field(default=20, ge=1, le=120)
    ai_max_concurrent_provider_calls: int = Field(default=2, ge=1, le=32)
    director_enabled: bool = False
    director_active_signing_key_id: Annotated[
        str,
        StringConstraints(pattern=r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$", max_length=64),
    ] | None = None
    director_signing_keys: dict[DirectorKeyId, SecretStr] = Field(default_factory=dict)

    @field_validator("director_signing_keys")
    @classmethod
    def validate_director_signing_keys(
        cls,
        values: dict[DirectorKeyId, SecretStr],
    ) -> dict[DirectorKeyId, SecretStr]:
        for key_id, secret in values.items():
            if len(secret.get_secret_value().encode("utf-8")) < 32:
                raise ValueError("director signing keys must contain at least 32 UTF-8 bytes")
        return values

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if (
            self.director_active_signing_key_id is not None
            and self.director_active_signing_key_id not in self.director_signing_keys
        ):
            raise ValueError("active Director signing key ID must exist in the configured key ring")
        if self.environment == "production":
            if self.frontend_origin.scheme != "https":
                raise ValueError("production frontend_origin must use HTTPS")
            if (
                self.frontend_origin.username
                or self.frontend_origin.password
                or self.frontend_origin.path not in ("", "/")
                or self.frontend_origin.query
                or self.frontend_origin.fragment
            ):
                raise ValueError(
                    "production frontend_origin must be an origin without credentials or path"
                )
            if self.ai_base_url.scheme != "https":
                raise ValueError("production ai_base_url must use HTTPS")
            if (
                self.ai_base_url.username
                or self.ai_base_url.password
                or self.ai_base_url.query
                or self.ai_base_url.fragment
            ):
                raise ValueError(
                    "production ai_base_url must not include credentials or URL parameters"
                )
            if self.ai_enabled and (
                self.ai_api_key is None
                or not self.ai_api_key.get_secret_value().strip()
                or self.ai_model is None
            ):
                raise ValueError(
                    "production live AI requires an API key and model when enabled"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
