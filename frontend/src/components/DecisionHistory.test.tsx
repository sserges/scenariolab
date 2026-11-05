import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { gameTurnFixture, startupDefinitionFixture } from "../test/scenarioFixtures";
import { DecisionHistory } from "./DecisionHistory";

test("shows authoritative decisions chronologically with events and metric changes", () => {
  render(
    <DecisionHistory
      briefingsByTurn={{}}
      definition={startupDefinitionFixture}
      records={gameTurnFixture.state.decision_history}
      turnUnit="month"
    />,
  );

  const entries = [...document.querySelectorAll<HTMLElement>("[data-history-turn]")];
  expect(entries).toHaveLength(1);
  expect(within(entries[0]!).getByText("Month 1")).toBeInTheDocument();
  expect(within(entries[0]!).getByText("Reduce Operating Expenses")).toBeInTheDocument();
  expect(within(entries[0]!).getByText("Competitor Price Cut")).toBeInTheDocument();
  expect(within(entries[0]!).getByText(/\$150,000 → \$127,500/)).toBeInTheDocument();
  expect(within(entries[0]!).queryByText(/AI explanation/)).not.toBeInTheDocument();
});

test("shows narrative as a separate explanation and does not replace event records", () => {
  render(
    <DecisionHistory
      briefingsByTurn={{
        1: {
          source: "live",
          headline: "Narrative headline",
          situation_summary: "Narrative situation",
          consequence_explanation: "Narrative consequence",
          strategic_insight: "Narrative insight",
          next_turn_teaser: "A future event may occur.",
        },
      }}
      definition={startupDefinitionFixture}
      records={gameTurnFixture.state.decision_history}
      turnUnit="month"
    />,
  );

  expect(screen.getByText("Narrative headline")).toBeInTheDocument();
  expect(screen.getByText("Competitor Price Cut")).toBeInTheDocument();
  expect(screen.getByText("Live AI")).toBeInTheDocument();
});

test("shows an empty state without fabricating history entries", () => {
  render(
    <DecisionHistory
      briefingsByTurn={{}}
      definition={startupDefinitionFixture}
      records={[]}
      turnUnit="month"
    />,
  );
  expect(screen.getByText("No decisions have been completed yet.")).toBeInTheDocument();
  expect(screen.queryAllByRole("listitem")).toHaveLength(0);
});
