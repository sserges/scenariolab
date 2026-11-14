from types import MappingProxyType

from scenariolab_api.domain.enums import (
    AvailabilityStatus,
    ScenarioAIFeature,
    ScenarioCategory,
)
from scenariolab_api.domain.models import ScenarioCatalogEntry, ScenarioDefinition
from scenariolab_api.scenarios.cybersecurity_crisis import CYBERSECURITY_CRISIS
from scenariolab_api.scenarios.space_colony import SPACE_COLONY
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
        ai_features=(
            ScenarioAIFeature.SCENARIO_DIRECTOR,
            ScenarioAIFeature.LIVE_BRIEFINGS,
        ),
    ),
    ScenarioCatalogEntry(
        scenario_id="cybersecurity-crisis",
        title="Cybersecurity Crisis",
        description=(
            "Lead an incident-response team through twelve rounds of an escalating "
            "attack while balancing containment, continuity, and trust."
        ),
        category=ScenarioCategory.CYBERSECURITY,
        objective=(
            "Contain the attack within 12 rounds while keeping the organization "
            "operating."
        ),
        availability=AvailabilityStatus.AVAILABLE,
        planned_key_metrics=(
            "System Integrity",
            "Threat Level",
            "Attacker Momentum",
            "Operational Continuity",
            "Stakeholder Trust",
            "Response Resources",
        ),
    ),
    ScenarioCatalogEntry(
        scenario_id="space-colony",
        title="Space Colony",
        description=(
            "Keep a Mars settlement of 50 astronauts alive through twelve mission "
            "cycles of shortages, equipment failures, and discoveries."
        ),
        category=ScenarioCategory.SPACE,
        objective=(
            "Sustain a 50-astronaut Mars colony for 12 mission cycles."
        ),
        availability=AvailabilityStatus.AVAILABLE,
        planned_key_metrics=(
            "Oxygen",
            "Food",
            "Energy",
            "Crew Morale",
            "Colony Integrity",
        ),
    ),
)

_CATALOG_BY_ID = MappingProxyType(
    {entry.scenario_id: entry for entry in PREDEFINED_SCENARIO_CATALOG}
)
_AVAILABLE_DEFINITIONS = MappingProxyType(
    {
        definition.scenario_id: definition
        for definition in (STARTUP_SURVIVAL, CYBERSECURITY_CRISIS, SPACE_COLONY)
    }
)


def get_catalog_entry(scenario_id: str) -> ScenarioCatalogEntry | None:
    return _CATALOG_BY_ID.get(scenario_id)


def get_scenario_definition(scenario_id: str) -> ScenarioDefinition | None:
    return _AVAILABLE_DEFINITIONS.get(scenario_id)
