import { expect, test } from "vitest";

import { spaceDefinitionFixture } from "../test/multiScenarioFixtures";
import { displayRange, isNearThreshold, isSignedMetric, percentWithin, sparklinePath } from "./metricDisplay";

const metric = (id: string) => spaceDefinitionFixture.metrics.find((item) => item.metric_id === id)!;

test("narrow ranges use declared bounds and wide reserves scale to observed values", () => {
  expect(displayRange(metric("crew-morale"), [72])).toEqual({ low: 0, high: 100 });
  expect(displayRange(metric("oxygen-balance"), [-2])).toEqual({ low: -12, high: 12 });
  expect(displayRange(metric("oxygen"), [30, 41])).toEqual({ low: 0, high: 60 });
});

test("signed balances grow from zero and thresholds warn near the losing side", () => {
  expect(isSignedMetric(metric("food-balance"))).toBe(true);
  expect(isSignedMetric(metric("food"))).toBe(false);
  const range = { low: 0, high: 100 };
  expect(isNearThreshold(metric("crew-morale"), 30, range)).toBe(true);
  expect(isNearThreshold(metric("crew-morale"), 72, range)).toBe(false);
  expect(percentWithin({ low: -12, high: 12 }, 0)).toBe(50);
  expect(percentWithin(range, 150)).toBe(100);
});

test("sparklines draw a flat line for one value and scale multiple values", () => {
  expect(sparklinePath([5])).toBe("M0 12.0 L96 12.0");
  expect(sparklinePath([0, 10])).toBe("M0.0 22.0 L96.0 2.0");
  expect(sparklinePath([])).toBe("");
});
