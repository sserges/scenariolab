"""Cybersecurity Crisis v1.0.0: lead incident response for 12 decision rounds.

Core dynamic: every round, Threat Level rises by the current Attacker Momentum
(a declared recurring rule). Containment lowers momentum but disrupts
operations; Response Resources are a finite pool that only refills through
explicit choices with their own costs.
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
PERCENT_FORMAT = MetricFormat(style=DisplayStyle.PERCENTAGE)
MOMENTUM_FORMAT = MetricFormat(style=DisplayStyle.NUMBER, suffix=" /round")
HOURS_FORMAT = MetricFormat(style=DisplayStyle.NUMBER, suffix=" hrs")

INITIAL_STATE = {
    "system-integrity": 72,
    "threat-level": 30,
    "attacker-momentum": 4,
    "operational-continuity": 90,
    "stakeholder-trust": 70,
    "response-resources": 140,
}

CYBERSECURITY_CRISIS = ScenarioDefinition(
    scenario_id="cybersecurity-crisis",
    schema_version="1.0",
    version="1.0.0",
    title="Cybersecurity Crisis",
    description=(
        "Lead a fictional organization's incident-response team through twelve "
        "rounds of an escalating security crisis while keeping operations running."
    ),
    category=ScenarioCategory.CYBERSECURITY,
    metadata=ScenarioMetadata(
        objective=(
            "Contain the attack within 12 decision rounds while preserving system "
            "integrity, operational continuity, and stakeholder trust."
        ),
        author="ScenarioLab",
        content_locale="en-US",
        source=ScenarioSource.PREDEFINED,
        tags=("cybersecurity", "incident-response", "strategy"),
        disclaimer=(
            "This fictional simulation uses illustrative values. It is not a "
            "security assessment, incident-response plan, or professional advice."
        ),
    ),
    initial_state=INITIAL_STATE,
    metrics=(
        MetricDefinition(
            metric_id="system-integrity",
            title="System Integrity",
            description="How much of the environment remains trustworthy and uncompromised.",
            kind=MetricKind.SCORE,
            unit=MetricUnit.POINTS,
            format=SCORE_FORMAT,
            initial_value=INITIAL_STATE["system-integrity"],
            min_value=0,
            max_value=100,
            critical_threshold=20,
            favorable_direction=FavorableDirection.HIGHER,
        ),
        MetricDefinition(
            metric_id="threat-level",
            title="Threat Level",
            description="Attacker foothold and potential impact. Rises each round by Attacker Momentum.",
            kind=MetricKind.SCORE,
            unit=MetricUnit.POINTS,
            format=SCORE_FORMAT,
            initial_value=INITIAL_STATE["threat-level"],
            min_value=0,
            max_value=100,
            critical_threshold=90,
            favorable_direction=FavorableDirection.LOWER,
        ),
        MetricDefinition(
            metric_id="attacker-momentum",
            title="Attacker Momentum",
            description="Threat Level added at the end of every round until containment slows the attacker.",
            kind=MetricKind.COUNT,
            unit=MetricUnit.POINTS,
            format=MOMENTUM_FORMAT,
            initial_value=INITIAL_STATE["attacker-momentum"],
            min_value=0,
            max_value=10,
            critical_threshold=8,
            favorable_direction=FavorableDirection.LOWER,
        ),
        MetricDefinition(
            metric_id="operational-continuity",
            title="Operational Continuity",
            description="Share of critical business services still operating normally.",
            kind=MetricKind.PERCENTAGE,
            unit=MetricUnit.PERCENT,
            format=PERCENT_FORMAT,
            initial_value=INITIAL_STATE["operational-continuity"],
            min_value=0,
            max_value=100,
            critical_threshold=25,
            favorable_direction=FavorableDirection.HIGHER,
        ),
        MetricDefinition(
            metric_id="stakeholder-trust",
            title="Stakeholder Trust",
            description="Confidence of leadership, customers, regulators, and partners in the response.",
            kind=MetricKind.SCORE,
            unit=MetricUnit.POINTS,
            format=SCORE_FORMAT,
            initial_value=INITIAL_STATE["stakeholder-trust"],
            min_value=0,
            max_value=100,
            critical_threshold=15,
            favorable_direction=FavorableDirection.HIGHER,
        ),
        MetricDefinition(
            metric_id="response-resources",
            title="Response Resources",
            description="Responder hours, tooling, and support available to commit. Does not refill on its own.",
            kind=MetricKind.RESOURCE,
            unit=MetricUnit.HOURS,
            format=HOURS_FORMAT,
            initial_value=INITIAL_STATE["response-resources"],
            min_value=0,
            max_value=999,
            critical_threshold=20,
            favorable_direction=FavorableDirection.HIGHER,
        ),
    ),
    turn=TurnConfiguration(duration=1, unit=TurnUnit.ROUND, max_turns=12),
    actions=(
        ScenarioAction(
            action_id="isolate-affected-systems",
            title="Isolate Affected Systems",
            description=(
                "Segment compromised hosts and cut attacker pathways. Slows the "
                "attack sharply but takes services offline."
            ),
            effects=(
                subtract("response-resources", 20, "Commit 20 responder hours to containment."),
                subtract("attacker-momentum", 3, "Reduce Attacker Momentum by 3."),
                subtract("operational-continuity", 10, "Take isolated services offline (-10%)."),
                add("system-integrity", 3, "Stop further spread inside isolated segments."),
            ),
        ),
        ScenarioAction(
            action_id="patch-and-harden",
            title="Patch and Harden Systems",
            description=(
                "Roll out emergency patches, rotate credentials, and enforce "
                "multi-factor authentication across the estate."
            ),
            effects=(
                subtract("response-resources", 25, "Commit 25 responder hours to remediation."),
                add("system-integrity", 10, "Restore 10 points of System Integrity."),
                subtract("attacker-momentum", 1, "Close known entry points (-1 momentum)."),
                subtract("operational-continuity", 3, "Brief maintenance windows (-3%)."),
            ),
        ),
        ScenarioAction(
            action_id="launch-threat-hunt",
            title="Launch Threat Hunt",
            description=(
                "Proactively search for persistence and evict the attacker from "
                "footholds it already holds. Forensics briefly pause services."
            ),
            effects=(
                subtract("response-resources", 30, "Commit 30 responder hours to hunting."),
                subtract("threat-level", 12, "Evict known footholds (-12 Threat Level)."),
                subtract("operational-continuity", 4, "Forensic imaging pauses some services (-4%)."),
            ),
        ),
        ScenarioAction(
            action_id="brief-stakeholders",
            title="Brief Stakeholders Transparently",
            description=(
                "Give leadership, customers, and regulators a candid status update "
                "and a clear remediation plan."
            ),
            effects=(
                subtract("response-resources", 10, "Commit 10 hours to communications."),
                add("stakeholder-trust", 8, "Improve Stakeholder Trust by 8."),
                subtract("operational-continuity", 2, "Divert leadership attention (-2%)."),
            ),
        ),
        ScenarioAction(
            action_id="restore-services",
            title="Restore Services and Rotate Staff",
            description=(
                "Bring business systems back online and rest the response team. "
                "Recovers capacity, but the attacker keeps operating."
            ),
            effects=(
                add("operational-continuity", 8, "Restore services (+8%)."),
                add("response-resources", 20, "Recover 20 responder hours through rest."),
                add("attacker-momentum", 2, "Reduced vigilance lets the attacker advance (+2)."),
            ),
        ),
        ScenarioAction(
            action_id="engage-external-responders",
            title="Engage External Responders",
            description=(
                "Call in an outside incident-response firm. Adds substantial "
                "capacity, but signals that the crisis is serious."
            ),
            effects=(
                add("response-resources", 45, "Add 45 hours of external responder capacity."),
                subtract("stakeholder-trust", 7, "Stakeholders read the escalation as a warning (-7)."),
            ),
        ),
        ScenarioAction(
            action_id="activate-backup-site",
            title="Fail Over to Backup Site",
            description=(
                "Shift critical operations to clean disaster-recovery infrastructure. "
                "Only possible once continuity has dropped to 60% or lower."
            ),
            preconditions=(metric_is("operational-continuity", "<=", 60),),
            effects=(
                subtract("response-resources", 35, "Commit 35 hours to the failover."),
                add("operational-continuity", 22, "Restore critical operations (+22%)."),
                add("system-integrity", 4, "Run on known-clean systems (+4)."),
            ),
        ),
    ),
    recurring_rules=(
        RecurringRule(
            rule_id="attacker-escalation",
            target_metric_id="threat-level",
            terms=(RecurringRuleTerm(metric_id="attacker-momentum", operator="add"),),
            description=(
                "After the chosen response, Threat Level rises by the current "
                "Attacker Momentum before any event is processed."
            ),
        ),
    ),
    events=(
        ScenarioEvent(
            event_id="phishing-campaign",
            title="Targeted Phishing Campaign",
            description=(
                "Convincing emails impersonating the finance team reach hundreds of "
                "employees, and several click the link."
            ),
            trigger=EventTrigger(earliest_turn=1, latest_turn=3, conditions=(turn_is(">=", 1),)),
            effects=(
                add("attacker-momentum", 2, "New access paths add 2 Attacker Momentum."),
                subtract("system-integrity", 3, "Infected endpoints reduce integrity by 3."),
            ),
            weight=3,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="credential-compromise",
            title="Compromised Employee Credentials",
            description=(
                "An administrator's stolen credentials are used to sign in from an "
                "unfamiliar location."
            ),
            trigger=EventTrigger(
                earliest_turn=2,
                latest_turn=7,
                conditions=(metric_is("attacker-momentum", ">=", 3),),
            ),
            effects=(
                subtract("system-integrity", 6, "Privileged misuse reduces integrity by 6."),
                add("threat-level", 5, "Privileged access raises Threat Level by 5."),
            ),
            weight=2,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="lateral-movement",
            title="Suspicious Lateral Movement",
            description=(
                "Network monitoring flags unusual traffic between internal servers "
                "that should never talk to each other."
            ),
            trigger=EventTrigger(
                earliest_turn=2,
                latest_turn=9,
                conditions=(metric_is("threat-level", ">=", 40),),
            ),
            effects=(
                add("attacker-momentum", 2, "Spreading access adds 2 Attacker Momentum."),
                add("threat-level", 3, "Wider reach raises Threat Level by 3."),
            ),
            weight=2,
            max_occurrences=2,
        ),
        ScenarioEvent(
            event_id="ransomware-detonation",
            title="Ransomware Detonation",
            description=(
                "File servers begin encrypting and a ransom note appears on shared "
                "drives across the organization."
            ),
            trigger=EventTrigger(
                earliest_turn=4,
                latest_turn=11,
                conditions=(metric_is("threat-level", ">=", 55),),
            ),
            effects=(
                subtract("operational-continuity", 18, "Encrypted systems cut continuity by 18%."),
                subtract("system-integrity", 10, "Encrypted data reduces integrity by 10."),
                subtract("stakeholder-trust", 6, "Visible disruption reduces trust by 6."),
            ),
            weight=4,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="supplier-compromise",
            title="Third-Party Supplier Breach",
            description=(
                "A managed-service supplier discloses that its remote-access tooling "
                "was breached, including its connection to your network."
            ),
            trigger=EventTrigger(
                earliest_turn=3,
                latest_turn=9,
                conditions=(turn_is(">=", 3),),
            ),
            effects=(
                add("attacker-momentum", 1, "A new trusted pathway adds 1 Attacker Momentum."),
                subtract("stakeholder-trust", 4, "Partners question supply-chain controls (-4)."),
            ),
            weight=1,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="critical-vulnerability",
            title="Critical Vulnerability Disclosed",
            description=(
                "A widely used gateway product receives an emergency advisory for an "
                "actively exploited flaw."
            ),
            trigger=EventTrigger(
                earliest_turn=5,
                latest_turn=11,
                conditions=(metric_is("system-integrity", "<", 80),),
            ),
            effects=(
                add("threat-level", 6, "Exposed gateways raise Threat Level by 6."),
                add("attacker-momentum", 1, "Easy exploitation adds 1 Attacker Momentum."),
            ),
            weight=2,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="data-exposure",
            title="Customer Data Exposure",
            description=(
                "Samples of internal customer records appear on a leak site, and "
                "journalists begin asking questions."
            ),
            trigger=EventTrigger(
                earliest_turn=5,
                latest_turn=12,
                conditions=(metric_is("system-integrity", "<=", 55),),
            ),
            effects=(
                subtract("stakeholder-trust", 12, "Public exposure reduces trust by 12."),
                add("threat-level", 4, "Exfiltration confirms deep access (+4 Threat Level)."),
            ),
            weight=3,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="service-disruption",
            title="Customer-Facing Service Disruption",
            description=(
                "The customer portal fails under degraded infrastructure, and support "
                "queues overflow."
            ),
            trigger=EventTrigger(
                earliest_turn=3,
                latest_turn=12,
                conditions=(metric_is("operational-continuity", "<=", 65),),
            ),
            effects=(
                subtract("operational-continuity", 7, "Additional outages cut continuity by 7%."),
                subtract("stakeholder-trust", 4, "Customers notice the outage (-4 trust)."),
            ),
            weight=2,
            max_occurrences=2,
        ),
        ScenarioEvent(
            event_id="threat-intel-shared",
            title="Industry Threat Intelligence Shared",
            description=(
                "Your transparency earns goodwill. A sector partner shares the "
                "attacker's infrastructure and tooling indicators."
            ),
            trigger=EventTrigger(
                logic=MatchLogic.ALL,
                earliest_turn=3,
                latest_turn=12,
                conditions=(
                    action_count_is("brief-stakeholders", ">=", 1),
                    metric_is("stakeholder-trust", ">=", 70),
                ),
            ),
            effects=(
                subtract("attacker-momentum", 2, "Known indicators reduce Attacker Momentum by 2."),
                subtract("threat-level", 5, "Blocked infrastructure lowers Threat Level by 5."),
            ),
            weight=3,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="attacker-pivot",
            title="Attacker Pivots to New Access",
            description=(
                "Blocked on one path, the attacker falls back on footholds that were "
                "never evicted and resumes operations."
            ),
            trigger=EventTrigger(
                logic=MatchLogic.ALL,
                earliest_turn=3,
                latest_turn=11,
                conditions=(
                    metric_is("attacker-momentum", "<=", 2),
                    metric_is("threat-level", ">=", 25),
                ),
            ),
            effects=(
                add("attacker-momentum", 3, "Remaining footholds restore 3 Attacker Momentum."),
            ),
            weight=3,
            max_occurrences=2,
        ),
        ScenarioEvent(
            event_id="attacker-infrastructure-down",
            title="Attacker Infrastructure Taken Down",
            description=(
                "With the attacker starved of access, law enforcement and hosting "
                "providers dismantle its command servers."
            ),
            trigger=EventTrigger(
                logic=MatchLogic.ALL,
                earliest_turn=6,
                latest_turn=12,
                conditions=(
                    metric_is("attacker-momentum", "<=", 1),
                    metric_is("threat-level", "<=", 30),
                ),
            ),
            effects=(
                subtract("threat-level", 8, "Lost command servers lower Threat Level by 8."),
                add("stakeholder-trust", 4, "Visible progress improves trust by 4."),
            ),
            weight=3,
            max_occurrences=1,
        ),
        ScenarioEvent(
            event_id="recovery-milestone",
            title="Recovery Milestone Reached",
            description=(
                "Core systems pass verification, and leadership confirms that "
                "normal operations are resuming."
            ),
            trigger=EventTrigger(
                logic=MatchLogic.ALL,
                earliest_turn=7,
                latest_turn=12,
                conditions=(
                    metric_is("system-integrity", ">=", 70),
                    metric_is("operational-continuity", ">=", 65),
                ),
            ),
            effects=(
                add("stakeholder-trust", 6, "Confirmed recovery improves trust by 6."),
                add("operational-continuity", 4, "Verified systems return to service (+4%)."),
            ),
            weight=2,
            max_occurrences=1,
        ),
    ),
    win_conditions=(
        OutcomeCondition(
            condition_id="crisis-contained",
            title="Crisis Contained",
            description=(
                "After round twelve, the attacker is contained and the organization "
                "is still operating with stakeholder confidence intact."
            ),
            priority=50,
            conditions=(
                turn_is(">=", 12),
                metric_is("threat-level", "<=", 45),
                metric_is("system-integrity", ">=", 45),
                metric_is("operational-continuity", ">=", 50),
                metric_is("stakeholder-trust", ">=", 35),
            ),
        ),
    ),
    loss_conditions=(
        OutcomeCondition(
            condition_id="network-takeover",
            title="Network Takeover",
            description="The attacker gains control of the environment when Threat Level reaches 90.",
            priority=100,
            conditions=(metric_is("threat-level", ">=", 90),),
        ),
        OutcomeCondition(
            condition_id="critical-infrastructure-compromised",
            title="Critical Infrastructure Compromised",
            description="The response fails when System Integrity falls to 20 or below.",
            priority=95,
            conditions=(metric_is("system-integrity", "<=", 20),),
        ),
        OutcomeCondition(
            condition_id="operations-collapse",
            title="Operations Collapse",
            description="The organization cannot function when Operational Continuity falls to 25% or below.",
            priority=90,
            conditions=(metric_is("operational-continuity", "<=", 25),),
        ),
        OutcomeCondition(
            condition_id="stakeholder-confidence-lost",
            title="Stakeholder Confidence Lost",
            description="Leadership replaces the response team when Stakeholder Trust falls to 15 or below.",
            priority=80,
            conditions=(metric_is("stakeholder-trust", "<=", 15),),
        ),
        OutcomeCondition(
            condition_id="crisis-unresolved",
            title="Crisis Unresolved",
            description=(
                "After round twelve, the run ends unsuccessfully if the attacker is "
                "not contained or the organization is too damaged to recover."
            ),
            priority=0,
            conditions=(turn_is(">=", 12),),
        ),
    ),
    calculation=CalculationParameters(),
    fallback=FallbackPolicy(
        event_ids=(
            "phishing-campaign",
            "credential-compromise",
            "lateral-movement",
            "ransomware-detonation",
            "supplier-compromise",
            "critical-vulnerability",
            "attacker-pivot",
            "data-exposure",
            "service-disruption",
            "threat-intel-shared",
            "attacker-infrastructure-down",
            "recovery-milestone",
        ),
        no_event_allowed=True,
    ),
)
