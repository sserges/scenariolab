"""Space Colony v1.0.0: sustain a 50-astronaut Mars colony for 12 mission cycles.

Core dynamic: Oxygen, Food, and Energy are reserves measured in days of supply.
Each cycle, every reserve changes by its own declared net balance (recurring
rules). Investing in infrastructure improves future balances at an immediate
cost, while emergency measures buy reserves now at the crew's expense.
"""

from scenariolab_api.domain.enums import (
    DisplayStyle,
    FavorableDirection,
    MatchLogic,
    MetricKind,
    MetricUnit,
    ScenarioCategory,
    ScenarioSource,
    TurnUnit,
)
from scenariolab_api.domain.models import (
    CalculationParameters,
    EventTrigger,
    FallbackPolicy,
    MetricDefinition,
    MetricFormat,
    OutcomeCondition,
    RecurringRule,
    RecurringRuleTerm,
    ScenarioAction,
    ScenarioDefinition,
    ScenarioEvent,
    ScenarioMetadata,
    TurnConfiguration,
)
from scenariolab_api.scenarios._builders import (
    action_count_is,
    add,
    metric_is,
    subtract,
    turn_is,
)

SCORE_FORMAT = MetricFormat(style=DisplayStyle.SCORE, suffix="/100")
RESERVE_FORMAT = MetricFormat(style=DisplayStyle.NUMBER, suffix=" days")
BALANCE_FORMAT = MetricFormat(style=DisplayStyle.NUMBER, suffix=" days/cycle")

INITIAL_STATE = {
    "oxygen": 30,
    "oxygen-balance": -2,
    "food": 36,
    "food-balance": -3,
    "energy": 34,
    "energy-balance": -2,
    "crew-morale": 72,
    "colony-integrity": 80,
}


def _reserve(metric_id: str, title: str, description: str) -> MetricDefinition:
    return MetricDefinition(
        metric_id=metric_id,
        title=title,
        description=description,
        kind=MetricKind.RESOURCE,
        unit=MetricUnit.DAYS,
        format=RESERVE_FORMAT,
        initial_value=INITIAL_STATE[metric_id],
        min_value=0,
        max_value=999,
        critical_threshold=8,
        favorable_direction=FavorableDirection.HIGHER,
    )


def _balance(metric_id: str, title: str, description: str) -> MetricDefinition:
    return MetricDefinition(
        metric_id=metric_id,
        title=title,
        description=description,
        kind=MetricKind.COUNT,
        unit=MetricUnit.DAYS,
        format=BALANCE_FORMAT,
        initial_value=INITIAL_STATE[metric_id],
        min_value=-12,
        max_value=12,
        favorable_direction=FavorableDirection.HIGHER,
    )


SPACE_COLONY = ScenarioDefinition(
    scenario_id="space-colony",
    schema_version="1.0",
    version="1.0.0",
    title="Space Colony",
    description=(
        "Command a fictional Mars settlement of 50 astronauts through twelve mission "
        "cycles of scarce oxygen, food, and energy."
    ),
    category=ScenarioCategory.SPACE,
    metadata=ScenarioMetadata(
        objective=(
            "Sustain all 50 astronauts through 12 mission cycles with life-support "
            "reserves, crew morale, and habitat integrity intact."
        ),
        author="ScenarioLab",
        content_locale="en-US",
        source=ScenarioSource.PREDEFINED,
        tags=("space", "resource-management", "strategy"),
        disclaimer=(
            "This fictional simulation uses simplified, illustrative values and is "
            "not an engineering or mission-planning model."
        ),
    ),
    initial_state=INITIAL_STATE,
    metrics=(
        _reserve("oxygen", "Oxygen Reserve", "Days of breathable air stored for the colony."),
        _balance(
            "oxygen-balance",
            "Oxygen Balance",
            "Net oxygen production minus consumption, applied to the reserve every cycle.",
        ),
        _reserve("food", "Food Stores", "Days of food available for all 50 astronauts."),
        _balance(
            "food-balance",
            "Food Balance",
            "Net hydroponic harvest minus consumption, applied to stores every cycle.",
        ),
        _reserve("energy", "Energy Reserve", "Days of stored power for habitat, labs, and life support."),
        _balance(
            "energy-balance",
            "Energy Balance",
            "Net generation minus demand, applied to the energy reserve every cycle.",
        ),
        MetricDefinition(
            metric_id="crew-morale",
            title="Crew Morale",
            description="Psychological resilience and cohesion of the 50-person crew.",
            kind=MetricKind.SCORE,
            unit=MetricUnit.POINTS,
            format=SCORE_FORMAT,
            initial_value=INITIAL_STATE["crew-morale"],
            min_value=0,
            max_value=100,
            critical_threshold=15,
            favorable_direction=FavorableDirection.HIGHER,
        ),
        MetricDefinition(
            metric_id="colony-integrity",
            title="Colony Integrity",
            description="Structural and mechanical condition of habitats and equipment.",
            kind=MetricKind.SCORE,
            unit=MetricUnit.POINTS,
            format=SCORE_FORMAT,
            initial_value=INITIAL_STATE["colony-integrity"],
            min_value=0,
            max_value=100,
            critical_threshold=20,
            favorable_direction=FavorableDirection.HIGHER,
        ),
    ),
    turn=TurnConfiguration(duration=1, unit=TurnUnit.CYCLE, max_turns=12),
    actions=(
        ScenarioAction(
            action_id="repair-oxygen-generators",
            title="Overhaul Oxygen Generators",
            description=(
                "Rebuild electrolysis stacks and scrubbers. Improves oxygen output "
                "every cycle, but draws heavily on stored power."
            ),
            effects=(
                subtract("energy", 3, "Draw 3 days of stored energy."),
                add("oxygen-balance", 2, "Improve Oxygen Balance by 2 days per cycle."),
                subtract("crew-morale", 2, "Long maintenance shifts (-2 morale)."),
            ),
        ),
        ScenarioAction(
            action_id="expand-hydroponics",
            title="Expand Hydroponics Bay",
            description=(
                "Bring new grow racks online. Plants add food and a little oxygen "
                "every cycle, but lighting costs energy."
            ),
            effects=(
                subtract("energy", 3, "Draw 3 days of stored energy for lighting."),
                add("food-balance", 2, "Improve Food Balance by 2 days per cycle."),
                add("oxygen-balance", 1, "Plants improve Oxygen Balance by 1."),
                subtract("energy-balance", 1, "Grow lights add ongoing demand (-1 per cycle)."),
            ),
        ),
        ScenarioAction(
            action_id="deploy-solar-arrays",
            title="Deploy Additional Solar Arrays",
            description=(
                "Send surface crews to assemble new panels. Raises generation every "
                "cycle at the cost of risky, exhausting surface work."
            ),
            effects=(
                add("energy-balance", 3, "Improve Energy Balance by 3 days per cycle."),
                subtract("food", 2, "Extra rations for surface crews (-2 days)."),
                subtract("crew-morale", 4, "Hazardous surface work (-4 morale)."),
            ),
        ),
        ScenarioAction(
            action_id="habitat-maintenance",
            title="Run Habitat Maintenance",
            description=(
                "Seal micro-leaks, replace worn seals, and service airlocks before "
                "small failures become emergencies."
            ),
            effects=(
                add("colony-integrity", 9, "Restore 9 points of Colony Integrity."),
                subtract("energy", 2, "Draw 2 days of stored energy."),
                subtract("crew-morale", 2, "Tedious maintenance rotation (-2 morale)."),
            ),
        ),
        ScenarioAction(
            action_id="crew-rest-rotation",
            title="Crew Rest and Recreation",
            description=(
                "Pause nonessential work for rest, communication with Earth, and a "
                "shared meal. Restores the crew but consumes supplies."
            ),
            effects=(
                add("crew-morale", 10, "Improve Crew Morale by 10."),
                subtract("food", 3, "Shared meal uses 3 days of food."),
            ),
        ),
        ScenarioAction(
            action_id="emergency-rationing",
            title="Emergency Rationing Protocol",
            description=(
                "Cut rations, dim habitats, and limit activity. Immediately banks "
                "reserves, but the crew bears the strain."
            ),
            effects=(
                add("oxygen", 3, "Reduced activity saves 3 days of oxygen."),
                add("food", 5, "Smaller rations save 5 days of food."),
                add("energy", 4, "Dimmed habitats save 4 days of energy."),
                subtract("crew-morale", 9, "Hardship lowers Crew Morale by 9."),
            ),
        ),
        ScenarioAction(
            action_id="survey-expedition",
            title="Launch Survey Expedition",
            description=(
                "Send a rover team to survey nearby terrain for subsurface ice and "
                "minerals. Costly now, potentially transformative later."
            ),
            preconditions=(action_count_is("survey-expedition", "<", 2),),
            effects=(
                subtract("energy", 4, "Rover operations draw 4 days of energy."),
                subtract("food", 3, "Expedition supplies use 3 days of food."),
                add("crew-morale", 5, "Discovery work lifts Crew Morale by 5."),
            ),
        ),
    ),
    recurring_rules=(
        RecurringRule(
            rule_id="oxygen-cycle",
            target_metric_id="oxygen",
            terms=(RecurringRuleTerm(metric_id="oxygen-balance", operator="add"),),
            underflow_behavior="exhaust-at-minimum",
            description="Apply the net Oxygen Balance to the Oxygen Reserve each cycle.",
        ),
        RecurringRule(
            rule_id="food-cycle",
            target_metric_id="food",
            terms=(RecurringRuleTerm(metric_id="food-balance", operator="add"),),
            underflow_behavior="exhaust-at-minimum",
            description="Apply the net Food Balance to Food Stores each cycle.",
        ),
        RecurringRule(
            rule_id="energy-cycle",
            target_metric_id="energy",
            terms=(RecurringRuleTerm(metric_id="energy-balance", operator="add"),),
            underflow_behavior="exhaust-at-minimum",
            description="Apply the net Energy Balance to the Energy Reserve each cycle.",
        ),
    ),
    events=(
        ScenarioEvent(
            event_id="oxygen-scrubber-malfunction",
            title="Oxygen Scrubber Malfunction",
            description=(
                "A carbon-dioxide scrubber fails in the main habitat, and backup "
                "units must run at full load."
            ),
            trigger=EventTrigger(earliest_turn=2, latest_turn=7, conditions=(turn_is(">=", 2),)),
            effects=(
                subtract("oxygen-balance", 2, "Lost capacity worsens Oxygen Balance by 2."),
                subtract("oxygen", 2, "Emergency venting costs 2 days of oxygen."),
            ),
            weight=2,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="crop-blight",
            title="Hydroponic Crop Blight",
            description=(
                "A fungal blight spreads through the grow racks before it can be "
                "contained."
            ),
            trigger=EventTrigger(
                earliest_turn=3,
                latest_turn=10,
                conditions=(metric_is("food-balance", "<=", -1),),
            ),
            effects=(
                subtract("food", 5, "Destroyed crops cost 5 days of food."),
                subtract("food-balance", 1, "Damaged racks worsen Food Balance by 1."),
            ),
            weight=2,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="solar-storm",
            title="Solar Storm",
            description=(
                "A coronal mass ejection forces the crew into shielded quarters and "
                "disrupts surface power systems."
            ),
            trigger=EventTrigger(earliest_turn=4, latest_turn=11, conditions=(turn_is(">=", 4),)),
            effects=(
                subtract("energy", 5, "Shielding and outages cost 5 days of energy."),
                subtract("crew-morale", 4, "Days in the storm shelter lower morale by 4."),
                subtract("colony-integrity", 3, "Radiation damages exposed equipment (-3)."),
            ),
            weight=2,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="power-system-failure",
            title="Power Distribution Failure",
            description=(
                "An overloaded power bus fails, and engineers reroute critical loads "
                "through aging backup lines."
            ),
            trigger=EventTrigger(
                earliest_turn=3,
                latest_turn=12,
                conditions=(metric_is("energy", "<=", 16),),
            ),
            effects=(
                subtract("energy-balance", 2, "Inefficient backup lines worsen Energy Balance by 2."),
                subtract("crew-morale", 3, "Rolling blackouts lower morale by 3."),
            ),
            weight=3,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="habitat-breach",
            title="Micrometeoroid Habitat Breach",
            description=(
                "A micrometeoroid punctures a worn habitat module, and the crew seals "
                "it off after losing pressure."
            ),
            trigger=EventTrigger(
                earliest_turn=5,
                latest_turn=12,
                conditions=(metric_is("colony-integrity", "<=", 70),),
            ),
            effects=(
                subtract("colony-integrity", 10, "Structural damage reduces integrity by 10."),
                subtract("oxygen", 4, "Lost atmosphere costs 4 days of oxygen."),
            ),
            weight=3,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="crew-conflict",
            title="Crew Conflict",
            description=(
                "Tension over workloads and rations erupts into an open dispute "
                "between two work teams."
            ),
            trigger=EventTrigger(
                earliest_turn=3,
                latest_turn=12,
                conditions=(metric_is("crew-morale", "<=", 55),),
            ),
            effects=(
                subtract("crew-morale", 6, "Open conflict lowers morale by 6."),
                subtract("colony-integrity", 2, "Neglected duties reduce integrity by 2."),
            ),
            weight=3,
            max_occurrences=2,
        ),
        ScenarioEvent(
            event_id="medical-emergency",
            title="Medical Emergency",
            description=(
                "An astronaut is seriously injured in a workshop accident, and the "
                "medical bay runs around the clock."
            ),
            trigger=EventTrigger(earliest_turn=4, latest_turn=12, conditions=(turn_is(">=", 4),)),
            effects=(
                subtract("energy", 2, "Medical equipment draws 2 days of energy."),
                subtract("crew-morale", 5, "Worry for a crewmate lowers morale by 5."),
            ),
            weight=1,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="dust-storm",
            title="Regional Dust Storm",
            description=(
                "A dust storm darkens the sky for weeks, coating panels and cutting "
                "solar generation."
            ),
            trigger=EventTrigger(earliest_turn=6, latest_turn=11, conditions=(turn_is(">=", 6),)),
            effects=(
                subtract("energy-balance", 1, "Dusty panels worsen Energy Balance by 1."),
                subtract("energy", 3, "Lost generation costs 3 days of energy."),
            ),
            weight=2,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="subsurface-ice-discovery",
            title="Subsurface Ice Discovery",
            description=(
                "The survey team confirms a shallow ice deposit within reach of the "
                "colony's drilling rig."
            ),
            trigger=EventTrigger(
                earliest_turn=2,
                latest_turn=12,
                conditions=(action_count_is("survey-expedition", ">=", 1),),
            ),
            effects=(
                add("oxygen-balance", 2, "Ice electrolysis improves Oxygen Balance by 2."),
                add("food-balance", 1, "More water for crops improves Food Balance by 1."),
                add("crew-morale", 4, "A major discovery lifts morale by 4."),
            ),
            weight=4,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="resupply-lander",
            title="Resupply Lander Arrives",
            description=(
                "A cargo lander from Earth touches down on the colony's landing pad "
                "with supplies and spare parts."
            ),
            trigger=EventTrigger(
                earliest_turn=7,
                latest_turn=9,
                conditions=(metric_is("colony-integrity", ">=", 50),),
            ),
            effects=(
                add("food", 8, "Delivered supplies add 8 days of food."),
                add("oxygen", 5, "Delivered tanks add 5 days of oxygen."),
                add("crew-morale", 3, "Letters from home lift morale by 3."),
            ),
            weight=3,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="record-harvest",
            title="Record Harvest",
            description="The expanded grow racks deliver the colony's best harvest yet.",
            trigger=EventTrigger(
                logic=MatchLogic.ALL,
                earliest_turn=4,
                latest_turn=12,
                conditions=(
                    metric_is("food-balance", ">=", 1),
                    action_count_is("expand-hydroponics", ">=", 1),
                ),
            ),
            effects=(
                add("food", 6, "Surplus crops add 6 days of food."),
                add("crew-morale", 3, "Fresh produce lifts morale by 3."),
            ),
            weight=2,
            max_occurrences=1,
        ),
    ),
    win_conditions=(
        OutcomeCondition(
            condition_id="colony-sustained",
            title="Colony Sustained",
            description=(
                "After cycle twelve, all 50 astronauts are sustained with every "
                "reserve at 10 days or more and a stable, motivated crew."
            ),
            priority=50,
            conditions=(
                turn_is(">=", 12),
                metric_is("oxygen", ">=", 10),
                metric_is("food", ">=", 10),
                metric_is("energy", ">=", 10),
                metric_is("crew-morale", ">=", 35),
                metric_is("colony-integrity", ">=", 40),
            ),
        ),
    ),
    loss_conditions=(
        OutcomeCondition(
            condition_id="life-support-failure",
            title="Life Support Failure",
            description="The colony must evacuate when the Oxygen Reserve is exhausted.",
            priority=100,
            conditions=(metric_is("oxygen", "<=", 0),),
        ),
        OutcomeCondition(
            condition_id="food-exhausted",
            title="Food Supplies Exhausted",
            description="The mission is abandoned when Food Stores run out.",
            priority=95,
            conditions=(metric_is("food", "<=", 0),),
        ),
        OutcomeCondition(
            condition_id="total-power-loss",
            title="Total Power Loss",
            description="Life support cannot run when the Energy Reserve is exhausted.",
            priority=90,
            conditions=(metric_is("energy", "<=", 0),),
        ),
        OutcomeCondition(
            condition_id="habitat-collapse",
            title="Habitat Collapse",
            description="The habitat becomes unsafe when Colony Integrity falls to 20 or below.",
            priority=85,
            conditions=(metric_is("colony-integrity", "<=", 20),),
        ),
        OutcomeCondition(
            condition_id="crew-breakdown",
            title="Crew Breakdown",
            description="Mission command recalls the crew when Crew Morale falls to 15 or below.",
            priority=80,
            conditions=(metric_is("crew-morale", "<=", 15),),
        ),
        OutcomeCondition(
            condition_id="colony-unsustainable",
            title="Colony Unsustainable",
            description=(
                "After cycle twelve, the mission ends unsuccessfully if reserves, "
                "morale, or habitat integrity are too low to continue."
            ),
            priority=0,
            conditions=(turn_is(">=", 12),),
        ),
    ),
    calculation=CalculationParameters(),
    fallback=FallbackPolicy(
        event_ids=(
            "oxygen-scrubber-malfunction",
            "crop-blight",
            "solar-storm",
            "power-system-failure",
            "habitat-breach",
            "crew-conflict",
            "medical-emergency",
            "dust-storm",
            "subsurface-ice-discovery",
            "resupply-lander",
            "record-harvest",
        ),
        no_event_allowed=True,
    ),
)
