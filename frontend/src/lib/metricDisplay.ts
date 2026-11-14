import type { MetricDefinition } from "./api";

/** Presentation-only helpers for the console metric rail. Values always come from the server. */

export interface DisplayRange {
  low: number;
  high: number;
}

const NARROW_RANGE = 200;

/**
 * Pick a readable bar range. Narrow contract ranges (scores, percentages, balances)
 * use their declared bounds; wide ranges (reserves, money) scale to the values seen.
 */
export function displayRange(metric: MetricDefinition, observed: number[]): DisplayRange {
  const span = metric.max_value - metric.min_value;
  if (span <= NARROW_RANGE) {
    return { low: metric.min_value, high: metric.max_value };
  }
  const reference = Math.max(
    metric.initial_value * 2,
    ...observed.map((value) => value * 1.25),
    (metric.critical_threshold ?? metric.min_value) * 2,
    metric.min_value + 1,
  );
  return { low: metric.min_value, high: Math.min(metric.max_value, reference) };
}

export function percentWithin(range: DisplayRange, value: number): number {
  const span = range.high - range.low;
  if (span <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, ((value - range.low) / span) * 100));
}

/** True when a metric with a critical threshold sits within 20% of its display range of it. */
export function isNearThreshold(metric: MetricDefinition, value: number, range: DisplayRange): boolean {
  const threshold = metric.critical_threshold;
  if (threshold === null || metric.favorable_direction === "neutral") {
    return false;
  }
  const distance = metric.favorable_direction === "lower" ? threshold - value : value - threshold;
  return distance <= (range.high - range.low) * 0.2;
}

/** True for signed rate metrics whose bar should grow from zero. */
export function isSignedMetric(metric: MetricDefinition): boolean {
  return metric.min_value < 0 && metric.max_value > 0;
}

/** SVG path for a small trend line in a width × height box. */
export function sparklinePath(values: number[], width = 96, height = 24): string {
  if (values.length === 0) {
    return "";
  }
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (low === high) {
    low -= 1;
    high += 1;
  }
  const y = (value: number) => (height - 2 - ((value - low) / (high - low)) * (height - 4)).toFixed(1);
  if (values.length === 1) {
    return `M0 ${y(values[0]!)} L${width} ${y(values[0]!)}`;
  }
  return values
    .map((value, index) => `${index === 0 ? "M" : "L"}${((index / (values.length - 1)) * width).toFixed(1)} ${y(value)}`)
    .join(" ");
}
