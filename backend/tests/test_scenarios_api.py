import asyncio

import httpx
import pytest

from scenariolab_api.domain.models import ScenarioDefinition
from scenariolab_api.main import app


async def request(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.get(path)


def test_catalog_endpoint_returns_three_scenarios() -> None:
    response = asyncio.run(request("/api/scenarios"))

    assert response.status_code == 200
    body = response.json()
    assert [entry["scenario_id"] for entry in body] == [
        "startup-survival",
        "cybersecurity-crisis",
        "space-colony",
    ]
    assert [entry["availability"] for entry in body] == [
        "available",
        "planned",
        "planned",
    ]


def test_startup_survival_endpoint_returns_valid_definition() -> None:
    response = asyncio.run(request("/api/scenarios/startup-survival"))

    assert response.status_code == 200
    definition = ScenarioDefinition.model_validate(response.json())
    assert definition.scenario_id == "startup-survival"
    assert definition.turn.max_turns == 12


@pytest.mark.parametrize("scenario_id", ["cybersecurity-crisis", "space-colony"])
def test_planned_scenarios_are_not_returned_as_playable(scenario_id: str) -> None:
    response = asyncio.run(request(f"/api/scenarios/{scenario_id}"))

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "scenario_not_available"


def test_unknown_scenario_returns_not_found() -> None:
    response = asyncio.run(request("/api/scenarios/not-registered"))

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "scenario_not_found"
