import type {
  GameStartResponse,
  GameState,
  GameTurnResponse,
  MetricChange,
  MetricDefinition,
  ScenarioAction,
  ScenarioCatalogEntry,
  ScenarioDefinition,
} from "../lib/api";

export const scenarioCatalogFixture: ScenarioCatalogEntry[] = [
  {
    scenario_id: "startup-survival",
    title: "Startup Survival",
    description: "Guide a startup through twelve months of hard tradeoffs.",
    category: "business",
    objective: "Keep a startup alive for 12 simulated months.",
    availability: "available",
    planned_key_metrics: ["Cash", "Monthly Revenue"],
  },
  {
    scenario_id: "cybersecurity-crisis",
    title: "Cybersecurity Crisis",
    description: "Coordinate a response to an evolving security incident.",
    category: "cybersecurity",
    objective: "Respond to a company security incident.",
    availability: "planned",
    planned_key_metrics: ["Incident Severity", "Systems Online"],
  },
  {
    scenario_id: "space-colony",
    title: "Space Colony",
    description: "Keep a Mars settlement of 50 astronauts operational.",
    category: "space",
    objective: "Keep a 50-astronaut Mars colony operational.",
    availability: "planned",
    planned_key_metrics: ["Population", "Oxygen", "Water"],
  },
];

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
  turn: {
    duration: 1,
    unit: "month",
    max_turns: 12,
  },
  metrics: [
    { metric_id: "cash", title: "Cash" },
    { metric_id: "team-morale", title: "Team Morale" },
  ],
};

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

const terminalState: GameState = {
  ...nextState,
  current_turn: 12,
  status: "won",
  metric_values: { ...nextState.metric_values, cash: 2_050_000 },
};

export const terminalTurnFixture: GameTurnResponse = {
  ...gameTurnFixture,
  state: terminalState,
  turn_result: {
    ...gameTurnFixture.turn_result,
    new_state: terminalState,
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
