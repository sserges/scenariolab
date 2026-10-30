import type { ScenarioCatalogEntry, ScenarioDefinition } from "../lib/api";

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
