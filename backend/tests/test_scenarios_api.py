import asyncio

import httpx
import pytest

from scenariolab_api.domain.enums import AvailabilityStatus
from scenariolab_api.domain.models import ScenarioDefinition
from scenariolab_api.main import app
from scenariolab_api.routes import scenarios as scenarios_route
from scenariolab_api.scenarios import get_catalog_entry


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
        "available",
        "available",
    ]
    assert [entry["ai_features"] for entry in body] == [
        ["scenario-director", "live-briefings"],
        [],
        [],
    ]


def test_startup_survival_endpoint_returns_valid_definition() -> None:
    response = asyncio.run(request("/api/scenarios/startup-survival"))

    assert response.status_code == 200
    definition = ScenarioDefinition.model_validate(response.json())
    assert definition.scenario_id == "startup-survival"
    assert definition.turn.max_turns == 12


@pytest.mark.parametrize(
    ("scenario_id", "turn_unit"),
    [("cybersecurity-crisis", "round"), ("space-colony", "cycle")],
)
def test_new_scenarios_return_valid_playable_definitions(
    scenario_id: str,
    turn_unit: str,
) -> None:
    response = asyncio.run(request(f"/api/scenarios/{scenario_id}"))

    assert response.status_code == 200
    definition = ScenarioDefinition.model_validate(response.json())
    assert definition.scenario_id == scenario_id
    assert definition.version == "1.0.0"
    assert definition.turn.max_turns == 12
    assert definition.turn.unit.value == turn_unit


def test_planned_catalog_entries_are_not_returned_as_playable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    entry = get_catalog_entry("space-colony")
    assert entry is not None
    planned = entry.model_copy(update={"availability": AvailabilityStatus.PLANNED})
    monkeypatch.setattr(scenarios_route, "get_catalog_entry", lambda _scenario_id: planned)

    response = asyncio.run(request("/api/scenarios/space-colony"))

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "scenario_not_available"


def test_unknown_scenario_returns_not_found() -> None:
    response = asyncio.run(request("/api/scenarios/not-registered"))

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "scenario_not_found"
