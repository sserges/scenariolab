from __future__ import annotations

from hashlib import sha256

from scenariolab_api.director.canonical import canonical_json_bytes
from scenariolab_api.director.models import (
    DirectorChoiceCandidate,
    DirectorContextSnapshot,
    DirectorEffect,
    DirectorSituation,
)


FallbackCandidate = tuple[DirectorSituation, tuple[DirectorChoiceCandidate, ...]]


def ordered_fallback_candidates(
    context: DirectorContextSnapshot,
) -> tuple[FallbackCandidate, ...]:
    """Return authored fallbacks in a deterministic, cooldown-aware order."""
    authored = _authored_fallbacks()
    recent = set(context.recent_beats[-3:])
    recent_headlines = set(context.recent_headline_digests)
    eligible = [
        candidate
        for candidate in authored
        if candidate[0].beat_id not in recent
        and _headline_digest(candidate[0].headline) not in recent_headlines
    ]
    if not eligible:
        eligible = [
            candidate
            for candidate in authored
            if _headline_digest(candidate[0].headline) not in recent_headlines
        ]
    if not eligible:
        return ()

    selection_payload = {
        "scenario_id": context.scenario_id,
        "scenario_version": context.scenario_version,
        "seed": context.seed,
        "turn": context.turn,
        "metric_values": dict(context.metric_values),
        "recent_action_ids": context.recent_action_ids,
        "recent_event_ids": context.recent_event_ids,
        "recent_beats": context.recent_beats,
        "recent_headline_digests": context.recent_headline_digests,
    }
    offset = int.from_bytes(sha256(canonical_json_bytes(selection_payload)).digest()[:8], "big")
    start = offset % len(eligible)
    return tuple(eligible[start:] + eligible[:start])


def _normalize_headline(value: str) -> str:
    return " ".join(value.casefold().split())


def _headline_digest(value: str) -> str:
    return sha256(_normalize_headline(value).encode("utf-8")).hexdigest()


def _effect(metric_id: str, operator: str, value: int) -> DirectorEffect:
    return DirectorEffect(metric_id=metric_id, operator=operator, value=value)


def _choice(
    title: str,
    description: str,
    *effects: DirectorEffect,
) -> DirectorChoiceCandidate:
    return DirectorChoiceCandidate(title=title, description=description, effects=tuple(effects))


def _authored_fallbacks() -> list[FallbackCandidate]:
    primary = [
        (
            DirectorSituation(
                situation_id="director-acquisition-offer",
                beat_id="acquisition",
                headline="A national retailer asks for a rapid rollout",
                description=(
                    "A new sales opportunity could bring wider adoption, but the team must "
                    "choose how much support and spending to commit."
                ),
            ),
            (
                _choice(
                    "Fund a supported launch",
                    "Invest in onboarding and take on a larger service commitment.",
                    _effect("cash", "subtract", 1_000_000),
                    _effect("active-users", "add", 200),
                    _effect("customer-satisfaction", "add", 2),
                ),
                _choice(
                    "Run a limited pilot",
                    "Test demand with a smaller commitment and a modest team lift.",
                    _effect("cash", "subtract", 300_000),
                    _effect("active-users", "add", 75),
                    _effect("team-morale", "add", 1),
                ),
                _choice(
                    "Decline the rollout",
                    "Protect operating focus and accept a smaller customer footprint.",
                    _effect("active-users", "subtract", 50),
                    _effect("monthly-expenses", "subtract", 100_000),
                    _effect("customer-satisfaction", "subtract", 2),
                ),
            ),
        ),
        (
            DirectorSituation(
                situation_id="director-supplier-contract",
                beat_id="supplier",
                headline="A supplier offers priority capacity on a short deadline",
                description=(
                    "The supplier can protect service continuity, but the terms shift cost "
                    "and delivery risk onto the startup."
                ),
            ),
            (
                _choice(
                    "Secure priority capacity",
                    "Pay for dependable supply and give customers a steadier experience.",
                    _effect("cash", "subtract", 800_000),
                    _effect("monthly-expenses", "add", 100_000),
                    _effect("customer-satisfaction", "add", 2),
                ),
                _choice(
                    "Renegotiate a smaller commitment",
                    "Reduce the immediate cash cost while pressing for leaner terms.",
                    _effect("cash", "subtract", 300_000),
                    _effect("monthly-expenses", "subtract", 200_000),
                    _effect("team-morale", "subtract", 1),
                ),
                _choice(
                    "Delay the order",
                    "Preserve runway but accept a risk to customer trust and usage.",
                    _effect("active-users", "subtract", 100),
                    _effect("customer-satisfaction", "subtract", 3),
                    _effect("monthly-expenses", "subtract", 100_000),
                ),
            ),
        ),
        (
            DirectorSituation(
                situation_id="director-retention-crisis",
                beat_id="retention",
                headline="Two senior engineers receive outside offers",
                description=(
                    "The team is stretched, and a retention decision may affect both delivery "
                    "capacity and the company's monthly commitments."
                ),
            ),
            (
                _choice(
                    "Make a retention commitment",
                    "Spend to stabilize the team and accept a higher ongoing cost.",
                    _effect("cash", "subtract", 1_200_000),
                    _effect("team-morale", "add", 8),
                    _effect("monthly-expenses", "add", 150_000),
                ),
                _choice(
                    "Offer a focused role change",
                    "Use a smaller cash commitment and give the team more ownership.",
                    _effect("cash", "subtract", 100_000),
                    _effect("team-morale", "add", 3),
                    _effect("employees", "subtract", 1),
                ),
                _choice(
                    "Accept the departures",
                    "Lower payroll pressure while reducing capacity and team confidence.",
                    _effect("employees", "subtract", 2),
                    _effect("team-morale", "subtract", 7),
                    _effect("monthly-expenses", "subtract", 250_000),
                ),
            ),
        ),
        (
            DirectorSituation(
                situation_id="director-customer-partnership",
                beat_id="partnership",
                headline="A major customer proposes a deeper partnership",
                description=(
                    "A long-term account wants more support and product influence, creating "
                    "a choice between service quality, cost, and focus."
                ),
            ),
            (
                _choice(
                    "Build a dedicated service plan",
                    "Support the account closely and accept additional operating expense.",
                    _effect("cash", "subtract", 500_000),
                    _effect("monthly-expenses", "add", 200_000),
                    _effect("customer-satisfaction", "add", 5),
                ),
                _choice(
                    "Start with a narrow pilot",
                    "Limit the commitment while learning whether the partnership fits.",
                    _effect("cash", "subtract", 150_000),
                    _effect("active-users", "add", 100),
                    _effect("customer-satisfaction", "add", 3),
                ),
                _choice(
                    "Keep the standard offering",
                    "Protect the roadmap and operating budget while risking account goodwill.",
                    _effect("active-users", "subtract", 75),
                    _effect("customer-satisfaction", "subtract", 3),
                    _effect("monthly-expenses", "subtract", 100_000),
                ),
            ),
        ),
    ]
    variants = (
        (
            0,
            "director-acquisition-community-network",
            "A regional network requests a coordinated product launch",
            "The opportunity could widen adoption, but it would require the startup to balance support and operating focus.",
        ),
        (
            0,
            "director-acquisition-distributor",
            "A distributor offers access to a new customer segment",
            "The channel could bring new users, while onboarding and service expectations remain uncertain.",
        ),
        (
            1,
            "director-supplier-packaging",
            "A packaging supplier changes its delivery terms",
            "The supplier can preserve continuity, but the revised schedule changes cost and customer risk.",
        ),
        (
            1,
            "director-supplier-materials",
            "A materials vendor asks for a longer commitment",
            "A longer agreement may steady delivery while limiting flexibility and cash flow.",
        ),
        (
            2,
            "director-retention-product-lead",
            "The product lead is considering an outside role",
            "A key contributor wants clearer ownership, while the team is already managing a demanding workload.",
        ),
        (
            2,
            "director-retention-support-team",
            "The support team raises concerns about workload",
            "The team needs relief, but adding support or reducing commitments changes cost and capacity.",
        ),
        (
            3,
            "director-partnership-health-network",
            "A health network asks for a tailored partnership",
            "The account could deepen product adoption, but its support needs may pull focus from the wider roadmap.",
        ),
        (
            3,
            "director-partnership-platform-alliance",
            "A platform company proposes a joint customer program",
            "The proposal offers a route to new users, with tradeoffs in service investment and product attention.",
        ),
    )
    expanded = list(primary)
    for base_index, situation_id, headline, description in variants:
        base_situation, choices = primary[base_index]
        expanded.append(
            (
                DirectorSituation(
                    situation_id=situation_id,
                    beat_id=base_situation.beat_id,
                    headline=headline,
                    description=description,
                ),
                choices,
            )
        )
    return expanded
