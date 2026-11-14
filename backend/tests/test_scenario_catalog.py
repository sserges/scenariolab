from scenariolab_api.director.profile import STARTUP_SURVIVAL_DIRECTOR_PROFILE
from scenariolab_api.domain.enums import AvailabilityStatus, ScenarioAIFeature
from scenariolab_api.scenarios import PREDEFINED_SCENARIO_CATALOG, get_scenario_definition


def test_catalog_lists_exactly_three_official_scenarios() -> None:
    assert len(PREDEFINED_SCENARIO_CATALOG) == 3
    assert [entry.scenario_id for entry in PREDEFINED_SCENARIO_CATALOG] == [
        "startup-survival",
        "cybersecurity-crisis",
        "space-colony",
    ]
    assert all(
        entry.availability is AvailabilityStatus.AVAILABLE
        for entry in PREDEFINED_SCENARIO_CATALOG
    )


def test_every_available_entry_has_a_matching_validated_definition() -> None:
    for entry in PREDEFINED_SCENARIO_CATALOG:
        definition = get_scenario_definition(entry.scenario_id)
        assert definition is not None
        assert definition.scenario_id == entry.scenario_id
        assert definition.title == entry.title
        assert definition.category == entry.category
        metric_titles = {metric.title for metric in definition.metrics}
        assert all(
            any(key in title for title in metric_titles)
            for key in entry.planned_key_metrics
        ), entry.scenario_id


def test_ai_features_are_scoped_to_startup_survival_and_match_director_profile() -> None:
    director_entries = [
        entry.scenario_id
        for entry in PREDEFINED_SCENARIO_CATALOG
        if ScenarioAIFeature.SCENARIO_DIRECTOR in entry.ai_features
    ]
    live_briefing_entries = [
        entry.scenario_id
        for entry in PREDEFINED_SCENARIO_CATALOG
        if ScenarioAIFeature.LIVE_BRIEFINGS in entry.ai_features
    ]

    assert director_entries == [STARTUP_SURVIVAL_DIRECTOR_PROFILE.scenario_id]
    assert live_briefing_entries == ["startup-survival"]
