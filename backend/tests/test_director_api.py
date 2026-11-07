from __future__ import annotations

import asyncio
from copy import deepcopy

import httpx
import pytest
from pydantic import SecretStr, ValidationError

from scenariolab_api.ai.provider import OpenAICompatibleProvider
from scenariolab_api.config import Settings
from scenariolab_api.director.models import (
    DirectorEffect,
    DirectorProposalResponse,
    DirectorReplayHistory,
    DirectorReplayResponse,
)
from scenariolab_api.director.fallback import ordered_fallback_candidates
from scenariolab_api.director.service import DirectorFailure, DirectorService
from scenariolab_api.domain.enums import GameStatus
from scenariolab_api.engine import initialize_game
from scenariolab_api.main import create_app
from scenariolab_api.scenarios.startup_survival import STARTUP_SURVIVAL

TEST_KEY = "director-test-key-material-32-bytes-minimum"


def settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "_env_file": None,
        "director_enabled": True,
        "director_active_signing_key_id": "test-key",
        "director_signing_keys": {"test-key": SecretStr(TEST_KEY)},
    }
    values.update(overrides)
    return Settings(**values)


def history_body(
    *,
    seed: int = 42,
    records: list[dict[str, object]] | None = None,
) -> dict[str, object]:
    return {
        "format_version": 2,
        "mode": "director",
        "scenario_id": "startup-survival",
        "scenario_version": "1.0.0",
        "seed": seed,
        "profile_id": "startup-survival-director",
        "profile_version": "1.0.0",
        "turn_records": records or [],
    }


async def post(
    app: object,
    path: str,
    body: dict[str, object],
) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.post(path, json=body)


def call(app: object, path: str, body: dict[str, object]) -> httpx.Response:
    return asyncio.run(post(app, path, body))


def proposal_for(app: object, body: dict[str, object] | None = None) -> dict[str, object]:
    response = call(app, "/api/ai/director/proposal", body or history_body())
    assert response.status_code == 200, response.text
    return response.json()


def turn_body(
    prefix: dict[str, object],
    proposal: dict[str, object],
    choice_id: str,
) -> dict[str, object]:
    return {
        **prefix,
        "proposal": proposal,
        "selected_choice_id": choice_id,
    }


def test_director_is_disabled_by_default_with_structured_error() -> None:
    app = create_app(Settings(_env_file=None))

    response = call(app, "/api/ai/director/proposal", history_body())

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "director_disabled"


def test_missing_signing_configuration_fails_closed_without_secret_leak() -> None:
    missing = Settings(_env_file=None, director_enabled=True)
    app = create_app(missing)

    response = call(app, "/api/ai/director/proposal", history_body())

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "director_signing_unavailable"
    assert TEST_KEY not in repr(settings())
    with pytest.raises(ValidationError, match="at least 32 UTF-8 bytes"):
        Settings(
            _env_file=None,
            director_signing_keys={"too-short": SecretStr("small")},
        )


def test_proposal_is_deterministic_signed_and_previews_match_resolution() -> None:
    app = create_app(settings())
    first = proposal_for(app)
    second = proposal_for(app)
    assert first == second

    parsed = DirectorProposalResponse.model_validate(first)
    assert parsed.proposal.payload.source == "fallback"
    assert len(parsed.proposal.payload.choices) in {2, 3, 4}
    assert len(parsed.previews) == len(parsed.proposal.payload.choices)
    assert len({choice.choice_id for choice in parsed.proposal.payload.choices}) == len(parsed.proposal.payload.choices)

    selected = parsed.proposal.payload.choices[0]
    turn = call(
        app,
        "/api/ai/director/turn",
        turn_body(history_body(), parsed.proposal.model_dump(mode="json"), selected.choice_id),
    )
    assert turn.status_code == 200, turn.text
    resolved = turn.json()
    matching_preview = next(preview for preview in parsed.previews if preview.choice_id == selected.choice_id)
    assert resolved["turn_result"]["metric_changes"] == [
        change.model_dump(mode="json") for change in matching_preview.metric_changes
    ]
    assert resolved["turn_result"]["resulting_status"] == matching_preview.projected_status
    assert resolved["turn_result"]["outcome_reason"] == matching_preview.outcome_reason
    assert resolved["state"]["decision_history"][-1]["source"] == "director"


def test_fallback_catalog_has_distinct_headlines_and_uses_the_beat_cooldown() -> None:
    service = DirectorService(settings())
    initial = initialize_game(STARTUP_SURVIVAL, 2026)
    context = service._context(initial, ())
    candidates = ordered_fallback_candidates(context)
    headlines = [situation.headline.casefold() for situation, _ in candidates]
    assert len(candidates) == 12
    assert len(set(headlines)) == 12

    used = candidates[0][0]
    updated = context.model_copy(update={"recent_beats": (used.beat_id,)})
    cooled = ordered_fallback_candidates(updated)
    assert cooled
    assert all(situation.beat_id != used.beat_id for situation, _ in cooled)


def test_three_turn_fallback_run_replays_without_provider_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    app = create_app(settings())

    def fail_if_called(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("Director replay must never call an AI provider")

    monkeypatch.setattr(OpenAICompatibleProvider, "generate_briefing", fail_if_called)
    records: list[dict[str, object]] = []
    beats: list[str] = []
    last_state: dict[str, object] | None = None
    for turn_index in range(3):
        prefix = history_body(records=records)
        proposal_response = call(app, "/api/ai/director/proposal", prefix)
        assert proposal_response.status_code == 200, proposal_response.text
        proposal = proposal_response.json()["proposal"]
        beats.append(proposal["payload"]["situation"]["beat_id"])
        choice = proposal["payload"]["choices"][turn_index % len(proposal["payload"]["choices"])]
        result = call(app, "/api/ai/director/turn", turn_body(prefix, proposal, choice["choice_id"]))
        assert result.status_code == 200, result.text
        records.append(result.json()["turn_record"])
        last_state = result.json()["state"]

    replay = call(app, "/api/ai/director/replay", history_body(records=records))
    assert replay.status_code == 200, replay.text
    replayed = DirectorReplayResponse.model_validate(replay.json())
    assert replayed.state.model_dump(mode="json") == last_state
    assert replayed.state.current_turn == 4
    assert len(replayed.state.decision_history) == 3
    assert replayed.latest_turn_result is not None
    assert len(set(beats)) == 3

    tampered_records = deepcopy(records)
    tampered_records[-1]["proposal"]["payload"]["choices"][0]["effects"][0]["value"] += 1
    tampered = call(app, "/api/ai/director/replay", history_body(records=tampered_records))
    assert tampered.status_code == 422
    assert tampered.json()["detail"]["code"] == "invalid_director_signature"


def test_tampered_proposal_and_receipt_are_rejected() -> None:
    app = create_app(settings())
    response = proposal_for(app)
    proposal = response["proposal"]
    selected = proposal["payload"]["choices"][0]["choice_id"]

    tampered_proposal = deepcopy(proposal)
    tampered_proposal["payload"]["choices"][0]["effects"][0]["value"] += 1
    bad_turn = call(
        app,
        "/api/ai/director/turn",
        turn_body(history_body(), tampered_proposal, selected),
    )
    assert bad_turn.status_code == 422
    assert bad_turn.json()["detail"]["code"] == "invalid_director_signature"

    tampered_signature = deepcopy(proposal)
    original_mac = tampered_signature["signature"]["value"]
    tampered_signature["signature"]["value"] = ("A" if original_mac[0] != "A" else "B") + original_mac[1:]
    bad_mac = call(
        app,
        "/api/ai/director/turn",
        turn_body(history_body(), tampered_signature, selected),
    )
    assert bad_mac.status_code == 422
    assert bad_mac.json()["detail"]["code"] == "invalid_director_signature"

    good_turn = call(app, "/api/ai/director/turn", turn_body(history_body(), proposal, selected))
    assert good_turn.status_code == 200
    record = good_turn.json()["turn_record"]
    record["receipt"]["payload"]["resulting_state_digest"] = "0" * 64
    replay = call(app, "/api/ai/director/replay", history_body(records=[record]))
    assert replay.status_code == 422
    assert replay.json()["detail"]["code"] == "invalid_director_signature"

    record["selected_choice_id"] = proposal["payload"]["choices"][1]["choice_id"]
    changed_decision = call(app, "/api/ai/director/replay", history_body(records=[record]))
    assert changed_decision.status_code == 422


def test_cross_game_stale_proposal_and_wrong_turn_are_rejected() -> None:
    app = create_app(settings())
    proposal = proposal_for(app)["proposal"]
    choice_id = proposal["payload"]["choices"][0]["choice_id"]

    cross_game = call(
        app,
        "/api/ai/director/turn",
        turn_body(history_body(seed=43), proposal, choice_id),
    )
    assert cross_game.status_code == 409
    assert cross_game.json()["detail"]["code"] == "stale_director_proposal"

    first_response = call(
        app,
        "/api/ai/director/turn",
        turn_body(history_body(), proposal, choice_id),
    )
    repeated_response = call(
        app,
        "/api/ai/director/turn",
        turn_body(history_body(), proposal, choice_id),
    )
    assert first_response.status_code == repeated_response.status_code == 200
    assert first_response.json() == repeated_response.json()

    first_turn = first_response
    assert first_turn.status_code == 200
    records = [first_turn.json()["turn_record"]]
    stale = call(
        app,
        "/api/ai/director/turn",
        turn_body(history_body(records=records), proposal, choice_id),
    )
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "stale_director_proposal"


def test_key_rotation_keeps_old_records_verifiable_and_receipts_use_proposal_key() -> None:
    old_app = create_app(
        settings(
            director_active_signing_key_id="old-key",
            director_signing_keys={"old-key": SecretStr(TEST_KEY)},
        )
    )
    proposal = proposal_for(old_app)["proposal"]
    choice_id = proposal["payload"]["choices"][0]["choice_id"]

    new_app = create_app(
        settings(
            director_active_signing_key_id="new-key",
            director_signing_keys={
                "old-key": SecretStr(TEST_KEY),
                "new-key": SecretStr("a-different-director-key-material-32-bytes"),
            },
        )
    )
    turn = call(new_app, "/api/ai/director/turn", turn_body(history_body(), proposal, choice_id))
    assert turn.status_code == 200, turn.text
    record = turn.json()["turn_record"]
    assert record["proposal"]["signature"]["key_id"] == "old-key"
    assert record["receipt"]["signature"]["key_id"] == "old-key"
    replay = call(new_app, "/api/ai/director/replay", history_body(records=[record]))
    assert replay.status_code == 200, replay.text


def test_modified_history_identity_and_unknown_scenario_are_rejected() -> None:
    app = create_app(settings())
    proposal = proposal_for(app)["proposal"]
    choice_id = proposal["payload"]["choices"][0]["choice_id"]
    other_scenario = history_body()
    other_scenario["scenario_id"] = "space-colony"

    response = call(
        app,
        "/api/ai/director/turn",
        turn_body(other_scenario, proposal, choice_id),
    )
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "unsupported_director_scenario"


def test_policy_rejects_unknown_metrics_unapproved_operators_unaffordable_and_out_of_bounds() -> None:
    service = DirectorService(settings())
    request = DirectorProposalResponse.model_validate(proposal_for(create_app(settings())))
    payload = request.proposal.payload

    choice = next(
        candidate
        for candidate in payload.choices
        if any(effect.metric_id == "cash" for effect in candidate.effects)
    )
    cash_choice = choice
    unknown_effect = DirectorEffect(metric_id="unknown-metric", operator="add", value=1)
    unknown_choice = choice.model_copy(update={"effects": (unknown_effect,)})
    unknown_payload = payload.model_copy(update={"choices": (unknown_choice, *payload.choices[1:])})
    with pytest.raises(DirectorFailure) as unknown:
        service._validate_proposal_and_preview(STARTUP_SURVIVAL, initialize_game(STARTUP_SURVIVAL, 42), unknown_payload)
    assert unknown.value.code == "invalid_director_effect"

    with pytest.raises(ValidationError):
        DirectorEffect.model_validate({"metric_id": "cash", "operator": "multiply", "value": 2})
    with pytest.raises(ValidationError):
        DirectorEffect.model_validate({"metric_id": "cash", "operator": "add", "value": True})
    with pytest.raises(ValidationError):
        DirectorEffect.model_validate({"metric_id": "cash", "operator": "add", "value": 1, "code": "x"})

    state = initialize_game(STARTUP_SURVIVAL, 42).model_copy(
        update={"metric_values": {**STARTUP_SURVIVAL.initial_state, "cash": 100_000}}
    )
    unaffordable = cash_choice.model_copy(
        update={
            "effects": tuple(
                effect.model_copy(update={"value": 200_000}) if effect.metric_id == "cash" else effect
                for effect in cash_choice.effects
            )
        }
    )
    unaffordable_payload = payload.model_copy(
        update={
            "choices": tuple(
                unaffordable if candidate.choice_id == cash_choice.choice_id else candidate
                for candidate in payload.choices
            )
        }
    )
    with pytest.raises(DirectorFailure) as unaffordable_error:
        service._validate_proposal_and_preview(STARTUP_SURVIVAL, state, unaffordable_payload)
    assert unaffordable_error.value.code == "director_unaffordable_choice"

    cash_gain = next(
        effect for effect in cash_choice.effects if effect.metric_id == "cash"
    ).model_copy(update={"operator": "add"})
    cash_gain_choice = cash_choice.model_copy(
        update={
            "effects": tuple(
                cash_gain if effect.metric_id == "cash" else effect
                for effect in cash_choice.effects
            )
        }
    )
    cash_gain_payload = payload.model_copy(
        update={
            "choices": tuple(
                cash_gain_choice if candidate.choice_id == cash_choice.choice_id else candidate
                for candidate in payload.choices
            )
        }
    )
    with pytest.raises(DirectorFailure) as cash_creation:
        service._validate_proposal_and_preview(
            STARTUP_SURVIVAL,
            initialize_game(STARTUP_SURVIVAL, 42),
            cash_gain_payload,
        )
    assert cash_creation.value.code == "invalid_director_effect"

    duplicate_cash = choice.model_copy(
        update={
            "effects": (
                DirectorEffect(metric_id="cash", operator="subtract", value=1_200_000),
                DirectorEffect(metric_id="cash", operator="subtract", value=900_000),
                next(effect for effect in choice.effects if effect.metric_id != "cash"),
            )
        }
    )
    duplicate_cash_payload = payload.model_copy(
        update={
            "choices": tuple(
                duplicate_cash if candidate.choice_id == choice.choice_id else candidate
                for candidate in payload.choices
            )
        }
    )
    with pytest.raises(DirectorFailure) as cash_budget:
        service._validate_proposal_and_preview(
            STARTUP_SURVIVAL,
            initialize_game(STARTUP_SURVIVAL, 42),
            duplicate_cash_payload,
        )
    assert cash_budget.value.code == "invalid_director_effect"

    high_satisfaction = initialize_game(STARTUP_SURVIVAL, 42).model_copy(
        update={"metric_values": {**STARTUP_SURVIVAL.initial_state, "customer-satisfaction": 100}}
    )
    with pytest.raises(DirectorFailure) as bounds:
        service._validate_proposal_and_preview(STARTUP_SURVIVAL, high_satisfaction, payload)
    assert bounds.value.code in {"invalid_director_effect", "invalid_director_proposal"}


def test_replay_rejects_duplicate_turns_and_terminal_games() -> None:
    app = create_app(settings())
    records: list[dict[str, object]] = []
    state: dict[str, object] | None = None
    for _ in range(12):
        prefix = history_body(records=records)
        proposal_response = call(app, "/api/ai/director/proposal", prefix)
        if proposal_response.status_code == 409:
            break
        proposal = proposal_response.json()["proposal"]
        selected = proposal["payload"]["choices"][0]["choice_id"]
        result = call(app, "/api/ai/director/turn", turn_body(prefix, proposal, selected))
        if result.status_code == 409:
            break
        assert result.status_code == 200, result.text
        state = result.json()["state"]
        records.append(result.json()["turn_record"])
        if state["status"] in {"won", "lost"}:
            break

    assert state is not None
    assert state["status"] in {"won", "lost"}
    if state["status"] in {"won", "lost"}:
        terminal_proposal = call(app, "/api/ai/director/proposal", history_body(records=records))
        assert terminal_proposal.status_code == 409
        assert terminal_proposal.json()["detail"]["code"] == "game_already_complete"
        duplicate = call(app, "/api/ai/director/turn", turn_body(history_body(records=records), proposal, selected))
        assert duplicate.status_code == 409

    assert records
    over_limit = call(
        app,
        "/api/ai/director/replay",
        history_body(records=[records[0]] * 13),
    )
    assert over_limit.status_code == 422

    duplicate_turn = call(
        app,
        "/api/ai/director/replay",
        history_body(records=[records[0], records[0]]),
    )
    assert duplicate_turn.status_code == 422


def test_v2_history_is_bounded_and_v1_game_routes_remain_usable() -> None:
    valid = DirectorReplayHistory.model_validate(history_body())
    assert valid.format_version == 2
    with pytest.raises(ValidationError):
        DirectorReplayHistory.model_validate({**history_body(), "format_version": 1})

    app = create_app(settings())
    classic = call(app, "/api/games/start", {"scenario_id": "startup-survival", "seed": 42})
    assert classic.status_code == 200
    assert classic.json()["state"]["status"] == "not-started"


def test_director_only_supports_pinned_profile_and_seeded_state() -> None:
    service = DirectorService(settings())
    state = initialize_game(STARTUP_SURVIVAL, 42)
    assert state.seed.seed == 42
    assert state.status is GameStatus.NOT_STARTED
    with pytest.raises(DirectorFailure) as profile_error:
        service.replay(DirectorReplayHistory.model_validate({
            **history_body(),
            "profile_version": "2.0.0",
        }))
    assert profile_error.value.code == "unsupported_director_profile"
