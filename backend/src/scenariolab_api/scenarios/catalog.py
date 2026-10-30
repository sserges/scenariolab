from types import MappingProxyType

from scenariolab_api.domain.enums import AvailabilityStatus, ScenarioCategory
from scenariolab_api.domain.models import ScenarioCatalogEntry, ScenarioDefinition
from scenariolab_api.scenarios.startup_survival import STARTUP_SURVIVAL

PREDEFINED_SCENARIO_CATALOG = (
    ScenarioCatalogEntry(
        scenario_id="startup-survival",
        title="Startup Survival",
        description=(
            "Guide an early-stage company through twelve months of difficult "
            "financial, customer, and team tradeoffs."
        ),
        category=ScenarioCategory.BUSINESS,
        objective="Keep a startup alive for 12 simulated months.",
        availability=AvailabilityStatus.AVAILABLE,
        planned_key_metrics=(
            "Cash",
            "Monthly Revenue",
            "Monthly Expenses",
            "Active Users",
            "Employees",
            "Customer Satisfaction",
            "Team Morale",
        ),
    ),
    ScenarioCatalogEntry(
        scenario_id="cybersecurity-crisis",
        title="Cybersecurity Crisis",
        description=(
            "Coordinate a company response to an evolving security incident while "
            "balancing containment, continuity, and trust."
        ),
        category=ScenarioCategory.CYBERSECURITY,
        objective="Respond to a company security incident and limit its impact.",
        availability=AvailabilityStatus.PLANNED,
        planned_key_metrics=(
            "Incident Severity",
            "Systems Online",
            "Data Integrity",
            "Business Continuity",
            "Stakeholder Trust",
        ),
    ),
    ScenarioCatalogEntry(
        scenario_id="space-colony",
        title="Space Colony",
        description=(
            "Keep a Mars settlement of 50 astronauts operating through shortages, "
            "equipment failures, and unexpected discoveries."
        ),
        category=ScenarioCategory.SPACE,
        objective="Keep a 50-astronaut Mars colony operational.",
        availability=AvailabilityStatus.PLANNED,
        planned_key_metrics=(
            "Population",
            "Oxygen",
            "Water",
            "Food",
            "Power",
            "Habitat Integrity",
            "Crew Health",
            "Morale",
        ),
    ),
)

_CATALOG_BY_ID = MappingProxyType(
    {entry.scenario_id: entry for entry in PREDEFINED_SCENARIO_CATALOG}
)
_AVAILABLE_DEFINITIONS = MappingProxyType(
    {STARTUP_SURVIVAL.scenario_id: STARTUP_SURVIVAL}
)


def get_catalog_entry(scenario_id: str) -> ScenarioCatalogEntry | None:
    return _CATALOG_BY_ID.get(scenario_id)


def get_scenario_definition(scenario_id: str) -> ScenarioDefinition | None:
    return _AVAILABLE_DEFINITIONS.get(scenario_id)
