from scenariolab_api.domain.enums import AvailabilityStatus
from scenariolab_api.scenarios import PREDEFINED_SCENARIO_CATALOG


def test_catalog_lists_exactly_three_official_scenarios() -> None:
    assert len(PREDEFINED_SCENARIO_CATALOG) == 3
    assert [entry.scenario_id for entry in PREDEFINED_SCENARIO_CATALOG] == [
        "startup-survival",
        "cybersecurity-crisis",
        "space-colony",
    ]
    assert PREDEFINED_SCENARIO_CATALOG[0].availability is AvailabilityStatus.AVAILABLE
    assert all(
        entry.availability is AvailabilityStatus.PLANNED
        for entry in PREDEFINED_SCENARIO_CATALOG[1:]
    )
