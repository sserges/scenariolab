import type {
  AIBriefingResponse,
  GameStartResponse,
  GameState,
  GameTurnResponse,
  MetricChange,
  MetricDefinition,
  ScenarioAction,
  ScenarioCatalogEntry,
  ScenarioDefinition,
} from "../lib/api";

export const liveBriefingFixture: AIBriefingResponse = {
  source: "live",
  headline: "Lean Operations Meet a Competitive Shock",
  situation_summary: "The company tightened spending as market pressure intensified.",
  consequence_explanation: "Cash and operating expenses decreased while team sentiment softened.",
  strategic_insight: "Protect morale and customer trust while preserving the improved cost structure.",
  next_turn_teaser: "A future turn may test whether the leaner plan can support renewed growth.",
};

export const fallbackBriefingFixture: AIBriefingResponse = {
  ...liveBriefingFixture,
  source: "fallback",
  headline: "Competitor Price Cut Shapes the Latest Turn",
};

export const scenarioCatalogFixture: ScenarioCatalogEntry[] = [
  {
    scenario_id: "startup-survival",
    title: "Startup Survival",
    description: "Guide a startup through twelve months of hard tradeoffs.",
    category: "business",
    objective: "Keep a startup alive for 12 simulated months.",
    availability: "available",
    planned_key_metrics: ["Cash", "Monthly Revenue"],
    ai_features: ["scenario-director", "live-briefings"],
  },
  {
    scenario_id: "cybersecurity-crisis",
    title: "Cybersecurity Crisis",
    description: "Lead an incident-response team through an escalating attack.",
    category: "cybersecurity",
    objective: "Contain the attack within 12 rounds while keeping the organization operating.",
    availability: "available",
    planned_key_metrics: ["System Integrity", "Threat Level"],
    ai_features: [],
  },
  {
    scenario_id: "space-colony",
    title: "Space Colony",
    description: "Keep a Mars settlement of 50 astronauts alive.",
    category: "space",
    objective: "Sustain a 50-astronaut Mars colony for 12 mission cycles.",
    availability: "available",
    planned_key_metrics: ["Oxygen", "Food", "Energy"],
    ai_features: [],
  },
];

/** A catalog where only Startup Survival is playable, for planned-state UI coverage. */
export const plannedCatalogFixture: ScenarioCatalogEntry[] = scenarioCatalogFixture.map((entry) =>
  entry.scenario_id === "startup-survival" ? entry : { ...entry, availability: "planned" },
);

const moneyFormat = {
  style: "currency" as const,
  decimals: 0,
  currency_code: "USD",
  suffix: null,
};
const numberFormat = {
  style: "number" as const,
  decimals: 0,
  currency_code: null,
  suffix: null,
};
const scoreFormat = {
  style: "score" as const,
  decimals: 0,
  currency_code: null,
  suffix: "/100",
};

function metric(
  metricId: string,
  title: string,
  initialValue: number,
  kind: string,
  unit: string,
  format: MetricDefinition["format"],
  favorableDirection: MetricDefinition["favorable_direction"],
  maxValue: number,
): MetricDefinition {
  return {
    metric_id: metricId,
    title,
    description: `${title} fixture metric.`,
    kind,
    unit,
    format,
    initial_value: initialValue,
    min_value: 0,
    max_value: maxValue,
    capacity: null,
    critical_threshold: null,
    favorable_direction: favorableDirection,
  };
}

export const startupMetricsFixture: MetricDefinition[] = [
  metric("cash", "Cash", 15_000_000, "money", "cents", moneyFormat, "higher", 100_000_000),
  metric("monthly-revenue", "Monthly Revenue", 1_500_000, "money", "cents", moneyFormat, "higher", 50_000_000),
  metric("monthly-expenses", "Monthly Expenses", 4_500_000, "money", "cents", moneyFormat, "lower", 50_000_000),
  metric("active-users", "Active Users", 2_000, "resource", "users", numberFormat, "higher", 1_000_000),
  metric("employees", "Employees", 12, "resource", "people", numberFormat, "neutral", 500),
  metric("customer-satisfaction", "Customer Satisfaction", 82, "score", "points", scoreFormat, "higher", 100),
  metric("team-morale", "Team Morale", 75, "score", "points", scoreFormat, "higher", 100),
];

const fixtureInitialValues = Object.fromEntries(
  startupMetricsFixture.map((definition) => [definition.metric_id, definition.initial_value]),
);

export const startupDefinitionFixture: ScenarioDefinition = {
  scenario_id: "startup-survival",
  schema_version: "1.0",
  version: "1.0.0",
  title: "Startup Survival",
  description: "Guide a startup through twelve months of hard tradeoffs.",
  category: "business",
  metadata: {
    objective: "Keep a startup alive for 12 simulated months.",
    disclaimer: "A fictional simulation.",
  },
  initial_state: fixtureInitialValues,
  turn: {
    duration: 1,
    unit: "month",
    max_turns: 12,
  },
  metrics: startupMetricsFixture,
  events: [
    {
      event_id: "competitor-price-cut",
      title: "Competitor Price Cut",
      description: "A competitor lowers prices and pressures customer sentiment.",
    },
  ],
  win_conditions: [
    {
      condition_id: "survived-the-year",
      title: "The Startup Survived",
      description: "Complete the final month with cash remaining.",
    },
  ],
  loss_conditions: [
    {
      condition_id: "cash-exhausted",
      title: "Cash Exhausted",
      description: "The startup can no longer fund operations.",
    },
  ],
};

export const startupActionsFixture: ScenarioAction[] = [
  {
    action_id: "invest-in-marketing",
    title: "Invest in Marketing",
    description: "Fund a focused acquisition campaign.",
  },
  {
    action_id: "improve-the-product",
    title: "Improve the Product",
    description: "Invest in product quality and reliability.",
  },
  {
    action_id: "reduce-operating-expenses",
    title: "Reduce Operating Expenses",
    description: "Cut discretionary spending to extend runway.",
  },
];

const initialMetricValues = Object.fromEntries(
  startupMetricsFixture.map((definition) => [
    definition.metric_id,
    definition.initial_value,
  ]),
);

const initialState: GameState = {
  scenario_id: "startup-survival",
  scenario_version: "1.0.0",
  current_turn: 1,
  max_turns: 12,
  metric_values: initialMetricValues,
  status: "not-started",
  decision_history: [],
  seed: { seed: 42, stream_version: "scenario-seed-v1" },
};

export const gameStartFixture: GameStartResponse = {
  scenario_id: "startup-survival",
  scenario_version: "1.0.0",
  seed: 42,
  state: initialState,
  available_actions: startupActionsFixture,
  scenario: {
    title: "Startup Survival",
    description: "Guide a startup through twelve months of hard tradeoffs.",
    objective: "Keep a startup alive for 12 simulated months.",
    turn: { duration: 1, unit: "month", max_turns: 12 },
    metrics: startupMetricsFixture,
  },
};

const firstTurnChanges: MetricChange[] = [
  {
    metric_id: "cash",
    previous_value: 15_000_000,
    new_value: 12_750_000,
    delta: -2_250_000,
    exhausted: false,
    attempted_value: null,
  },
  {
    metric_id: "monthly-expenses",
    previous_value: 4_500_000,
    new_value: 3_750_000,
    delta: -750_000,
    exhausted: false,
    attempted_value: null,
  },
  {
    metric_id: "customer-satisfaction",
    previous_value: 82,
    new_value: 79,
    delta: -3,
    exhausted: false,
    attempted_value: null,
  },
  {
    metric_id: "team-morale",
    previous_value: 75,
    new_value: 67,
    delta: -8,
    exhausted: false,
    attempted_value: null,
  },
];

const firstDecision = {
  action_id: "reduce-operating-expenses",
  action_title: "Reduce Operating Expenses",
  turn: 1,
  sequence: 1,
  event_id: "competitor-price-cut",
  metric_changes: firstTurnChanges,
  resulting_status: "active" as const,
  outcome_reason: "turn-completed",
};

const nextState: GameState = {
  ...initialState,
  current_turn: 2,
  status: "active",
  metric_values: {
    ...initialMetricValues,
    cash: 12_750_000,
    "monthly-expenses": 3_750_000,
    "customer-satisfaction": 79,
    "team-morale": 67,
  },
  decision_history: [firstDecision],
};

export const gameTurnFixture: GameTurnResponse = {
  scenario_id: "startup-survival",
  scenario_version: "1.0.0",
  seed: 42,
  state: nextState,
  turn_result: {
    previous_state: initialState,
    new_state: nextState,
    selected_action: startupActionsFixture[2]!,
    triggered_event: {
      event_id: "competitor-price-cut",
      title: "Competitor Price Cut",
      description: "A competitor lowers prices and pressures customer sentiment.",
    },
    metric_changes: firstTurnChanges,
    completed_turn_index: 1,
    resulting_status: "active",
    outcome_reason: "turn-completed",
  },
  available_actions: startupActionsFixture,
  action_history: ["reduce-operating-expenses"],
};

export const secondGameTurnFixture: GameTurnResponse = {
  ...gameTurnFixture,
  state: {
    ...nextState,
    current_turn: 3,
    decision_history: [firstDecision, { ...firstDecision, turn: 2, sequence: 2 }],
  },
  turn_result: {
    ...gameTurnFixture.turn_result,
    previous_state: nextState,
    new_state: {
      ...nextState,
      current_turn: 3,
      decision_history: [firstDecision, { ...firstDecision, turn: 2, sequence: 2 }],
    },
    completed_turn_index: 2,
    triggered_event: null,
  },
  action_history: ["reduce-operating-expenses", "reduce-operating-expenses"],
};

const terminalState: GameState = {
  ...nextState,
  current_turn: 12,
  status: "won",
  metric_values: { ...nextState.metric_values, cash: 2_050_000 },
  decision_history: Array.from({ length: 12 }, (_, index) => ({
    ...firstDecision,
    action_id: index < 4 ? "reduce-operating-expenses" : "invest-in-marketing",
    action_title: index < 4 ? "Reduce Operating Expenses" : "Invest in Marketing",
    turn: index + 1,
    sequence: index + 1,
    resulting_status: index === 11 ? "won" as const : "active" as const,
    outcome_reason: index === 11 ? "survived-the-year" : "turn-completed",
  })),
};

export const terminalTurnFixture: GameTurnResponse = {
  ...gameTurnFixture,
  state: terminalState,
  turn_result: {
    ...gameTurnFixture.turn_result,
    previous_state: {
      ...nextState,
      current_turn: 12,
      decision_history: terminalState.decision_history.slice(0, 11),
    },
    new_state: terminalState,
    selected_action: startupActionsFixture[0]!,
    completed_turn_index: 12,
    resulting_status: "won",
    outcome_reason: "survived-the-year",
    triggered_event: null,
  },
  available_actions: [],
  action_history: [
    ...Array.from({ length: 4 }, () => "reduce-operating-expenses"),
    ...Array.from({ length: 8 }, () => "invest-in-marketing"),
  ],
};
