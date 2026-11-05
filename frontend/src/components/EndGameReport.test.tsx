import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { buildMetricSeries } from "../lib/metrics";
import {
  gameStartFixture,
  startupDefinitionFixture,
  terminalTurnFixture,
} from "../test/scenarioFixtures";
import { EndGameReport } from "./EndGameReport";

test("summarizes terminal outcome, completed turns, metric changes, and trends", () => {
  render(
    <EndGameReport
      definition={startupDefinitionFixture}
      initialValues={gameStartFixture.state.metric_values}
      metricSeries={buildMetricSeries(
        gameStartFixture.scenario.metrics,
        gameStartFixture.state.metric_values,
        terminalTurnFixture.state.decision_history,
      )}
      onRestart={vi.fn()}
      restarting={false}
      state={terminalTurnFixture.state}
    />,
  );

  expect(screen.getByRole("heading", { name: "Victory" })).toBeInTheDocument();
  expect(screen.getByText("Outcome: The Startup Survived")).toBeInTheDocument();
  expect(screen.getByText("12 of 12 turns completed · Final status: Won")).toBeInTheDocument();
  const cashRow = document.querySelector('[data-final-metric="cash"]');
  expect(cashRow).not.toBeNull();
  expect(within(cashRow as HTMLElement).getByText("$150,000")).toBeInTheDocument();
  expect(within(cashRow as HTMLElement).getByText("$20,500")).toBeInTheDocument();
  expect(screen.getAllByText(/Event: Competitor Price Cut/).length).toBeGreaterThan(0);
  expect(screen.getByRole("img", { name: "Financial trends" })).toBeInTheDocument();
});
