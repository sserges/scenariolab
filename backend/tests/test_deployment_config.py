import asyncio
from pathlib import Path

import httpx
import pytest
from pydantic import SecretStr, ValidationError

from scenariolab_api.ai.service import create_briefing_service
from scenariolab_api.config import Settings
from scenariolab_api.main import create_app


def test_safe_defaults_disable_live_ai_and_bound_requests() -> None:
    settings = Settings(_env_file=None)

    assert settings.ai_enabled is False
    assert settings.director_enabled is False
    assert settings.director_signing_keys == {}
    assert settings.max_request_body_bytes == 65_536
    assert settings.ai_max_concurrent_provider_calls == 2
    assert settings.ai_max_response_tokens == 500
    assert settings.director_max_response_tokens == 800


def test_director_signing_key_ring_is_separate_and_supports_rotation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    old_key = "old-director-key-material-with-at-least-32-bytes"
    active_key = "active-director-key-material-with-at-least-32-bytes"
    monkeypatch.setenv("SCENARIOLAB_DIRECTOR_ENABLED", "true")
    monkeypatch.setenv("SCENARIOLAB_DIRECTOR_ACTIVE_SIGNING_KEY_ID", "new-key")
    monkeypatch.setenv(
        "SCENARIOLAB_DIRECTOR_SIGNING_KEYS",
        f'{{"old-key":"{old_key}","new-key":"{active_key}"}}',
    )

    settings = Settings(_env_file=None)

    assert settings.director_enabled is True
    assert settings.ai_enabled is False
    assert settings.director_active_signing_key_id == "new-key"
    assert set(settings.director_signing_keys) == {"old-key", "new-key"}
    assert active_key not in repr(settings)
    with pytest.raises(ValidationError, match="active Director signing key ID"):
        Settings(
            _env_file=None,
            director_active_signing_key_id="missing-key",
            director_signing_keys={"old-key": SecretStr(old_key)},
        )


def test_production_settings_parse_expected_https_configuration() -> None:
    settings = Settings(
        _env_file=None,
        environment="production",
        frontend_origin="https://demo.example.test",
        ai_enabled=False,
        max_request_body_bytes=32_768,
        ai_provider_calls_per_minute=8,
        ai_max_concurrent_provider_calls=1,
    )

    assert settings.environment == "production"
    assert str(settings.frontend_origin) == "https://demo.example.test/"
    assert settings.ai_enabled is False
    assert settings.max_request_body_bytes == 32_768
    assert settings.ai_provider_calls_per_minute == 8
    assert settings.ai_max_concurrent_provider_calls == 1


def test_production_environment_variables_are_parsed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SCENARIOLAB_ENVIRONMENT", "production")
    monkeypatch.setenv("SCENARIOLAB_FRONTEND_ORIGIN", "https://demo.example.test")
    monkeypatch.setenv("SCENARIOLAB_AI_ENABLED", "false")
    monkeypatch.setenv("SCENARIOLAB_MAX_REQUEST_BODY_BYTES", "32768")
    monkeypatch.setenv("SCENARIOLAB_AI_PROVIDER_CALLS_PER_MINUTE", "8")
    monkeypatch.setenv("SCENARIOLAB_AI_MAX_CONCURRENT_PROVIDER_CALLS", "1")

    settings = Settings(_env_file=None)

    assert settings.environment == "production"
    assert settings.frontend_origin.scheme == "https"
    assert settings.ai_enabled is False
    assert settings.max_request_body_bytes == 32_768
    assert settings.ai_provider_calls_per_minute == 8
    assert settings.ai_max_concurrent_provider_calls == 1


def test_director_response_token_budget_is_configurable_and_bounded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SCENARIOLAB_DIRECTOR_MAX_RESPONSE_TOKENS", "700")

    settings = Settings(_env_file=None)

    assert settings.director_max_response_tokens == 700
    with pytest.raises(ValidationError):
        Settings(_env_file=None, director_max_response_tokens=801)


def test_checked_in_production_environment_template_parses() -> None:
    template = Path(__file__).resolve().parents[1] / ".env.production.example"

    settings = Settings(_env_file=template)

    assert settings.environment == "production"
    assert settings.frontend_origin.scheme == "https"
    assert settings.ai_enabled is False
    assert settings.max_request_body_bytes == 65_536
    assert settings.ai_provider_calls_per_minute == 5
    assert settings.ai_max_concurrent_provider_calls == 1
    assert settings.director_max_response_tokens == 800
    assert settings.director_enabled is True
    assert settings.director_live_generation_enabled is False


def test_public_fallback_template_runs_director_without_provider_credentials() -> None:
    template = Path(__file__).resolve().parents[1] / ".env.production.example"
    settings = Settings(
        _env_file=template,
        director_active_signing_key_id="release-test",
        director_signing_keys={
            "release-test": SecretStr("release-test-only-key-material-at-least-32-bytes")
        },
    )
    application = create_app(settings)
    history = {
        "format_version": 2,
        "mode": "director",
        "scenario_id": "startup-survival",
        "scenario_version": "1.0.0",
        "seed": 42,
        "profile_id": "startup-survival-director",
        "profile_version": "1.0.0",
        "turn_records": [],
    }

    response = asyncio.run(_post_director_proposal(application, history))

    assert settings.ai_enabled is False
    assert settings.ai_api_key is None
    assert settings.director_enabled is True
    assert settings.director_live_generation_enabled is False
    assert response.status_code == 200
    assert response.json()["proposal"]["payload"]["source"] == "fallback"


async def _post_director_proposal(application: object, history: dict[str, object]) -> httpx.Response:
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.post("/api/ai/director/proposal", json=history)


def test_production_settings_reject_http_frontend_origin() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            environment="production",
            frontend_origin="http://demo.example.test",
        )


@pytest.mark.parametrize(
    "frontend_origin",
    [
        "https://user@demo.example.test",
        "https://demo.example.test/path",
        "https://demo.example.test/?preview=1",
    ],
)
def test_production_frontend_origin_must_be_an_exact_origin(
    frontend_origin: str,
) -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            environment="production",
            frontend_origin=frontend_origin,
        )


def test_production_settings_reject_http_provider_url() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            environment="production",
            frontend_origin="https://demo.example.test",
            ai_base_url="http://provider.example/v1",
        )


def test_production_provider_url_must_not_embed_credentials() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            environment="production",
            frontend_origin="https://demo.example.test",
            ai_base_url="https://user:password@provider.example/v1",
        )


def test_production_live_ai_requires_key_and_model() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            environment="production",
            frontend_origin="https://demo.example.test",
            ai_enabled=True,
        )

    settings = Settings(
        _env_file=None,
        environment="production",
        frontend_origin="https://demo.example.test",
        ai_enabled=True,
        ai_api_key=SecretStr("unit-test-only-secret"),
        ai_model="test-model",
    )
    assert settings.ai_enabled is True


def test_ai_disabled_setting_keeps_deterministic_fallback_even_with_credentials() -> None:
    settings = Settings(
        _env_file=None,
        ai_enabled=False,
        ai_api_key=SecretStr("unit-test-only-secret"),
        ai_model="test-model",
    )
    service = create_briefing_service(settings)

    assert service._provider is None


async def _post_limited_body(body: bytes, *, limit: int) -> httpx.Response:
    application = create_app(
        Settings(_env_file=None, max_request_body_bytes=limit, ai_enabled=False)
    )
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.post(
            "/api/games/start",
            content=body,
            headers={"content-type": "application/json"},
        )


def test_request_body_size_limit_rejects_oversized_payload_before_parsing() -> None:
    response = asyncio.run(_post_limited_body(b"x" * 1_025, limit=1_024))

    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "request_too_large"


def test_request_body_within_limit_reaches_the_api() -> None:
    response = asyncio.run(
        _post_limited_body(
            b'{"scenario_id":"startup-survival","seed":42}',
            limit=1_024,
        )
    )

    assert response.status_code == 200


async def _cors_preflight(origin: str) -> httpx.Response:
    application = create_app(
        Settings(
            _env_file=None,
            environment="production",
            frontend_origin="https://demo.example.test",
            ai_enabled=False,
        )
    )
    transport = httpx.ASGITransport(app=application)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.options(
            "/api/games/start",
            headers={
                "origin": origin,
                "access-control-request-method": "POST",
                "access-control-request-headers": "content-type",
            },
        )


def test_production_cors_allows_exact_frontend_origin_only() -> None:
    allowed = asyncio.run(_cors_preflight("https://demo.example.test"))
    rejected = asyncio.run(_cors_preflight("https://attacker.example.test"))

    assert allowed.headers["access-control-allow-origin"] == "https://demo.example.test"
    assert "access-control-allow-origin" not in rejected.headers
