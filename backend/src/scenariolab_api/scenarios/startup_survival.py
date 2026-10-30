from scenariolab_api.domain.enums import (
    ComparisonOperator,
    ConditionReference,
    DisplayStyle,
    EffectOperator,
    FavorableDirection,
    MatchLogic,
    MetricKind,
    MetricUnit,
    ScenarioCategory,
    ScenarioSource,
    TurnUnit,
)
from scenariolab_api.domain.models import (
    ActionEffect,
    CalculationParameters,
    ConditionClause,
    EventTrigger,
    FallbackPolicy,
    MetricDefinition,
    MetricFormat,
    OutcomeCondition,
    ScenarioAction,
    ScenarioDefinition,
    ScenarioEvent,
    ScenarioMetadata,
    TurnConfiguration,
)

USD_FORMAT = MetricFormat(
    style=DisplayStyle.CURRENCY,
    currency_code="USD",
)
NUMBER_FORMAT = MetricFormat(style=DisplayStyle.NUMBER)
SCORE_FORMAT = MetricFormat(style=DisplayStyle.SCORE, suffix="/100")

STARTUP_SURVIVAL = ScenarioDefinition(
    scenario_id="startup-survival",
    schema_version="1.0",
    version="1.0.0",
    title="Startup Survival",
    description=(
        "Guide a fictional early-stage company through twelve months of difficult "
        "tradeoffs while protecting cash, customers, and the team."
    ),
    category=ScenarioCategory.BUSINESS,
    metadata=ScenarioMetadata(
        objective="Keep the startup alive and operational for 12 simulated months.",
        author="ScenarioLab",
        content_locale="en-US",
        source=ScenarioSource.PREDEFINED,
        tags=("startup", "business", "strategy"),
        disclaimer=(
            "This fictional simulation uses illustrative values and is not a "
            "financial forecast or real-world business advice."
        ),
    ),
    initial_state={
        "cash": 15_000_000,
        "monthly-revenue": 1_500_000,
        "monthly-expenses": 4_500_000,
        "active-users": 2_000,
        "employees": 12,
        "customer-satisfaction": 82,
        "team-morale": 75,
    },
    metrics=(
        MetricDefinition(
            metric_id="cash",
            title="Cash",
            description="Available company cash represented in integer cents.",
            kind=MetricKind.MONEY,
            unit=MetricUnit.CENTS,
            format=USD_FORMAT,
            initial_value=15_000_000,
            min_value=0,
            max_value=100_000_000,
            capacity=100_000_000,
            critical_threshold=0,
            favorable_direction=FavorableDirection.HIGHER,
        ),
        MetricDefinition(
            metric_id="monthly-revenue",
            title="Monthly Revenue",
            description="Current monthly recurring revenue in integer cents.",
            kind=MetricKind.MONEY,
            unit=MetricUnit.CENTS,
            format=USD_FORMAT,
            initial_value=1_500_000,
            min_value=0,
            max_value=50_000_000,
            critical_threshold=250_000,
            favorable_direction=FavorableDirection.HIGHER,
        ),
        MetricDefinition(
            metric_id="monthly-expenses",
            title="Monthly Expenses",
            description="Current monthly operating expenses in integer cents.",
            kind=MetricKind.MONEY,
            unit=MetricUnit.CENTS,
            format=USD_FORMAT,
            initial_value=4_500_000,
            min_value=0,
            max_value=50_000_000,
            favorable_direction=FavorableDirection.LOWER,
        ),
        MetricDefinition(
            metric_id="active-users",
            title="Active Users",
            description="Number of customers actively using the product.",
            kind=MetricKind.RESOURCE,
            unit=MetricUnit.USERS,
            format=NUMBER_FORMAT,
            initial_value=2_000,
            min_value=0,
            max_value=1_000_000,
            capacity=250_000,
            critical_threshold=100,
            favorable_direction=FavorableDirection.HIGHER,
        ),
        MetricDefinition(
            metric_id="employees",
            title="Employees",
            description="Number of people currently employed by the company.",
            kind=MetricKind.RESOURCE,
            unit=MetricUnit.PEOPLE,
            format=NUMBER_FORMAT,
            initial_value=12,
            min_value=0,
            max_value=500,
            capacity=100,
            critical_threshold=3,
            favorable_direction=FavorableDirection.NEUTRAL,
        ),
        MetricDefinition(
            metric_id="customer-satisfaction",
            title="Customer Satisfaction",
            description="A bounded score representing customer sentiment.",
            kind=MetricKind.SCORE,
            unit=MetricUnit.POINTS,
            format=SCORE_FORMAT,
            initial_value=82,
            min_value=0,
            max_value=100,
            critical_threshold=15,
            favorable_direction=FavorableDirection.HIGHER,
        ),
        MetricDefinition(
            metric_id="team-morale",
            title="Team Morale",
            description="A bounded score representing team confidence and energy.",
            kind=MetricKind.SCORE,
            unit=MetricUnit.POINTS,
            format=SCORE_FORMAT,
            initial_value=75,
            min_value=0,
            max_value=100,
            critical_threshold=10,
            favorable_direction=FavorableDirection.HIGHER,
        ),
    ),
    turn=TurnConfiguration(
        duration=1,
        unit=TurnUnit.MONTH,
        max_turns=12,
    ),
    actions=(
        ScenarioAction(
            action_id="invest-in-marketing",
            title="Invest in Marketing",
            description=(
                "Fund a focused acquisition campaign to reach more potential "
                "customers."
            ),
            preconditions=(
                ConditionClause(
                    reference=ConditionReference.METRIC,
                    metric_id="cash",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=2_500_000,
                ),
            ),
            effects=(
                ActionEffect(
                    metric_id="cash",
                    operator=EffectOperator.SUBTRACT,
                    value=2_500_000,
                    description="Allocate $25,000 of cash to the campaign.",
                ),
                ActionEffect(
                    metric_id="active-users",
                    operator=EffectOperator.ADD,
                    value=600,
                    description="Illustratively add 600 active users.",
                ),
                ActionEffect(
                    metric_id="monthly-revenue",
                    operator=EffectOperator.ADD,
                    value=300_000,
                    description="Illustratively add $3,000 in monthly revenue.",
                ),
            ),
        ),
        ScenarioAction(
            action_id="improve-the-product",
            title="Improve the Product",
            description=(
                "Invest in product quality, reliability, and high-impact customer "
                "requests."
            ),
            preconditions=(
                ConditionClause(
                    reference=ConditionReference.METRIC,
                    metric_id="cash",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=3_000_000,
                ),
            ),
            effects=(
                ActionEffect(
                    metric_id="cash",
                    operator=EffectOperator.SUBTRACT,
                    value=3_000_000,
                    description="Allocate $30,000 of cash to product work.",
                ),
                ActionEffect(
                    metric_id="customer-satisfaction",
                    operator=EffectOperator.ADD,
                    value=6,
                    description="Illustratively improve satisfaction by six points.",
                ),
                ActionEffect(
                    metric_id="team-morale",
                    operator=EffectOperator.ADD,
                    value=2,
                    description="Give the team momentum from visible product progress.",
                ),
            ),
        ),
        ScenarioAction(
            action_id="reduce-operating-expenses",
            title="Reduce Operating Expenses",
            description=(
                "Cut discretionary spending and renegotiate services to extend "
                "the company's runway."
            ),
            preconditions=(
                ConditionClause(
                    reference=ConditionReference.METRIC,
                    metric_id="monthly-expenses",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=2_000_000,
                ),
            ),
            effects=(
                ActionEffect(
                    metric_id="monthly-expenses",
                    operator=EffectOperator.SUBTRACT,
                    value=750_000,
                    description="Illustratively reduce monthly expenses by $7,500.",
                ),
                ActionEffect(
                    metric_id="team-morale",
                    operator=EffectOperator.SUBTRACT,
                    value=8,
                    description="Reflect the pressure of operating cuts on morale.",
                ),
                ActionEffect(
                    metric_id="customer-satisfaction",
                    operator=EffectOperator.SUBTRACT,
                    value=3,
                    description="Reflect a small service-quality risk from the cuts.",
                ),
            ),
        ),
    ),
    events=(
        ScenarioEvent(
            event_id="customer-referral-wave",
            title="Customer Referral Wave",
            description=(
                "Recent product improvements prompt a group of customers to refer "
                "new users."
            ),
            trigger=EventTrigger(
                logic=MatchLogic.ALL,
                earliest_turn=2,
                latest_turn=12,
                conditions=(
                    ConditionClause(
                        reference=ConditionReference.ACTION_COUNT,
                        action_id="improve-the-product",
                        operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                        value=1,
                    ),
                    ConditionClause(
                        reference=ConditionReference.METRIC,
                        metric_id="customer-satisfaction",
                        operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                        value=75,
                    ),
                ),
            ),
            effects=(
                ActionEffect(
                    metric_id="active-users",
                    operator=EffectOperator.ADD,
                    value=400,
                    description="Illustratively add 400 referred active users.",
                ),
                ActionEffect(
                    metric_id="monthly-revenue",
                    operator=EffectOperator.ADD,
                    value=200_000,
                    description="Illustratively add $2,000 in monthly revenue.",
                ),
            ),
            weight=2,
            max_occurrences=2,
        ),
        ScenarioEvent(
            event_id="competitor-price-cut",
            title="Competitor Price Cut",
            description=(
                "A competitor lowers prices, putting short-term pressure on growth "
                "and customer sentiment."
            ),
            trigger=EventTrigger(
                earliest_turn=3,
                latest_turn=12,
                conditions=(
                    ConditionClause(
                        reference=ConditionReference.TURN,
                        operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                        value=3,
                    ),
                ),
            ),
            effects=(
                ActionEffect(
                    metric_id="monthly-revenue",
                    operator=EffectOperator.SUBTRACT,
                    value=250_000,
                    description="Illustratively reduce monthly revenue by $2,500.",
                ),
                ActionEffect(
                    metric_id="customer-satisfaction",
                    operator=EffectOperator.SUBTRACT,
                    value=3,
                    description="Reflect customer comparison with the new price.",
                ),
            ),
            weight=2,
            max_occurrences=2,
        ),
        ScenarioEvent(
            event_id="investor-demo-day",
            title="Investor Demo Day",
            description=(
                "Improving revenue attracts an investor who offers a small bridge "
                "investment after a strong demonstration."
            ),
            trigger=EventTrigger(
                logic=MatchLogic.ALL,
                earliest_turn=4,
                latest_turn=10,
                conditions=(
                    ConditionClause(
                        reference=ConditionReference.TURN,
                        operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                        value=4,
                    ),
                    ConditionClause(
                        reference=ConditionReference.METRIC,
                        metric_id="monthly-revenue",
                        operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                        value=2_000_000,
                    ),
                ),
            ),
            effects=(
                ActionEffect(
                    metric_id="cash",
                    operator=EffectOperator.ADD,
                    value=5_000_000,
                    description="Illustratively add a $50,000 bridge investment.",
                ),
                ActionEffect(
                    metric_id="team-morale",
                    operator=EffectOperator.ADD,
                    value=5,
                    description="Increase team confidence after external validation.",
                ),
            ),
            weight=1,
            max_occurrences=1,
        ),
    ),
    win_conditions=(
        OutcomeCondition(
            condition_id="survived-the-year",
            title="The Startup Survived",
            description=(
                "Complete month twelve with cash remaining and sustainable customer "
                "and team health."
            ),
            logic=MatchLogic.ALL,
            priority=50,
            conditions=(
                ConditionClause(
                    reference=ConditionReference.TURN,
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=12,
                ),
                ConditionClause(
                    reference=ConditionReference.METRIC,
                    metric_id="cash",
                    operator=ComparisonOperator.GREATER_THAN,
                    value=0,
                ),
                ConditionClause(
                    reference=ConditionReference.METRIC,
                    metric_id="customer-satisfaction",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=50,
                ),
                ConditionClause(
                    reference=ConditionReference.METRIC,
                    metric_id="team-morale",
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=35,
                ),
            ),
        ),
    ),
    loss_conditions=(
        OutcomeCondition(
            condition_id="bankruptcy",
            title="Bankruptcy",
            description="The startup fails when available cash reaches zero.",
            priority=100,
            conditions=(
                ConditionClause(
                    reference=ConditionReference.METRIC,
                    metric_id="cash",
                    operator=ComparisonOperator.LESS_THAN_OR_EQUAL,
                    value=0,
                ),
            ),
        ),
        OutcomeCondition(
            condition_id="team-collapse",
            title="Team Collapse",
            description="The startup fails when team morale reaches a critical level.",
            priority=90,
            conditions=(
                ConditionClause(
                    reference=ConditionReference.METRIC,
                    metric_id="team-morale",
                    operator=ComparisonOperator.LESS_THAN_OR_EQUAL,
                    value=10,
                ),
            ),
        ),
        OutcomeCondition(
            condition_id="customer-collapse",
            title="Customer Collapse",
            description=(
                "The startup fails when customer satisfaction reaches a critical "
                "level."
            ),
            priority=80,
            conditions=(
                ConditionClause(
                    reference=ConditionReference.METRIC,
                    metric_id="customer-satisfaction",
                    operator=ComparisonOperator.LESS_THAN_OR_EQUAL,
                    value=15,
                ),
            ),
        ),
        OutcomeCondition(
            condition_id="year-end-objectives-missed",
            title="Year-End Objectives Missed",
            description=(
                "At the turn limit, the run ends unsuccessfully if the higher-priority "
                "success criteria are not met."
            ),
            priority=0,
            conditions=(
                ConditionClause(
                    reference=ConditionReference.TURN,
                    operator=ComparisonOperator.GREATER_THAN_OR_EQUAL,
                    value=12,
                ),
            ),
        ),
    ),
    calculation=CalculationParameters(),
    fallback=FallbackPolicy(
        event_ids=(
            "customer-referral-wave",
            "competitor-price-cut",
            "investor-demo-day",
        ),
        no_event_allowed=True,
    ),
)
