import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { buildMetricSeries } from "../lib/metrics";
import {
  gameStartFixture,
  gameTurnFixture,
  startupMetricsFixture,
} from "../test/scenarioFixtures";
import { MetricCharts, groupMetricSeries } from "./MetricCharts";

test("groups same-unit values into reusable financial and resource charts", () => {
  const series = buildMetricSeries(
    startupMetricsFixture,
    gameStartFixture.state.metric_values,
    gameTurnFixture.state.decision_history,
  );
  const groups = groupMetricSeries(series);

  expect(groups.find((group) => group.unit === "USD")?.series.map((item) => item.metric.metric_id)).toEqual([
    "cash",
    "monthly-revenue",
    "monthly-expenses",
  ]);
  expect(groups.some((group) => group.unit === "users")).toBe(true);
  expect(groupMetricSeries([])).toEqual([]);
});

test("renders accessible chart alternatives and initial-only empty history", () => {
  const series = buildMetricSeries(
    startupMetricsFixture,
    gameStartFixture.state.metric_values,
    [],
  );
  render(<MetricCharts series={series} />);

  expect(screen.getByRole("heading", { name: "Financial and resource visualizations" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Financial trends" })).toBeInTheDocument();
  expect(screen.getAllByText("Initial state only").length).toBeGreaterThan(0);
  expect(screen.getByText(/No intermediate values are inferred/)).toBeInTheDocument();
});

test("renders a safe placeholder when metric history is missing", () => {
  render(<MetricCharts series={[]} />);
  expect(screen.getByText(/Chart history is unavailable/)).toBeInTheDocument();
});

test("distinguishes same-unit reserve and rate groups without financial wording", async () => {
  const { spaceDefinitionFixture, spaceStartFixture } = await import("../test/multiScenarioFixtures");
  const series = buildMetricSeries(spaceDefinitionFixture.metrics, spaceStartFixture.state.metric_values, []);

  expect(groupMetricSeries(series).map((group) => group.title)).toEqual([
    "Days trends",
    "Days per cycle trends",
    "Points trends",
  ]);
  render(<MetricCharts series={series} />);
  expect(screen.getByRole("heading", { name: "Resource and status visualizations" })).toBeInTheDocument();
  expect(screen.queryByText(/Financial/)).not.toBeInTheDocument();
});
