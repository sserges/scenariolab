import { expect, test } from "vitest";

import {
  gameStartFixture,
  gameTurnFixture,
  startupMetricsFixture,
} from "../test/scenarioFixtures";
import { buildMetricSeries, formatMetricDelta, formatMetricValue } from "./metrics";

test("formats integer cents as display-only currency using metric metadata", () => {
  const cash = startupMetricsFixture.find((metric) => metric.metric_id === "cash");
  expect(cash).toBeDefined();
  expect(formatMetricValue(cash!, 12_750_000)).toBe("$127,500");
  expect(formatMetricDelta(cash!, -2_250_000)).toBe("−$22,500");
});

test("derives trend points from initial state and authoritative decision records", () => {
  const series = buildMetricSeries(
    gameStartFixture.scenario.metrics,
    gameStartFixture.state.metric_values,
    gameTurnFixture.state.decision_history,
  );
  const cash = series.find((item) => item.metric.metric_id === "cash");
  const revenue = series.find((item) => item.metric.metric_id === "monthly-revenue");

  expect(cash?.points).toEqual([
    { turn: 0, value: 15_000_000 },
    { turn: 1, value: 12_750_000 },
  ]);
  expect(revenue?.points).toEqual([
    { turn: 0, value: 1_500_000 },
    { turn: 1, value: 1_500_000 },
  ]);
});

test("keeps initial-only points and omits metrics absent from the server initial state", () => {
  const series = buildMetricSeries(
    startupMetricsFixture,
    { cash: 15_000_000 },
    [],
  );

  expect(series).toHaveLength(1);
  expect(series[0]?.points).toEqual([{ turn: 0, value: 15_000_000 }]);
});
