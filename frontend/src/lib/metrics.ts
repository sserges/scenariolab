import type { DecisionRecord, MetricDefinition, MetricChange } from "./api";

export interface MetricSeriesPoint {
  turn: number;
  value: number;
}

export interface MetricSeries {
  metric: MetricDefinition;
  points: MetricSeriesPoint[];
}

export function formatMetricValue(metric: MetricDefinition, value: number): string {
  if (metric.format.style === "currency") {
    const amount = metric.unit === "cents" ? value / 100 : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: metric.format.currency_code ?? "USD",
      minimumFractionDigits: metric.format.decimals,
      maximumFractionDigits: metric.format.decimals,
    }).format(amount);
  }
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: metric.format.decimals,
    maximumFractionDigits: metric.format.decimals,
  }).format(value);
  if (metric.format.style === "percentage") {
    return `${formatted}%`;
  }
  return `${formatted}${metric.format.suffix ?? ""}`;
}

export function formatMetricDelta(metric: MetricDefinition, delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${formatMetricValue(metric, Math.abs(delta))}`;
}

export function getFavorability(
  metric: MetricDefinition,
  delta: number,
): "favorable" | "unfavorable" | "neutral" {
  if (delta === 0 || metric.favorable_direction === "neutral") {
    return "neutral";
  }
  const higherIsBetter = metric.favorable_direction === "higher";
  return (delta > 0) === higherIsBetter ? "favorable" : "unfavorable";
}

export function buildMetricSeries(
  metrics: MetricDefinition[],
  initialValues: Record<string, number>,
  history: DecisionRecord[],
): MetricSeries[] {
  return metrics.flatMap((metric) => {
    const initialValue = initialValues[metric.metric_id];
    if (initialValue === undefined || !Number.isSafeInteger(initialValue)) {
      return [];
    }
    let currentValue = initialValue;
    const points: MetricSeriesPoint[] = [{ turn: 0, value: initialValue }];
    for (const record of history) {
      const change = record.metric_changes.find(
        (candidate) => candidate.metric_id === metric.metric_id,
      );
      if (change !== undefined) {
        currentValue = change.new_value;
      }
      points.push({ turn: record.turn, value: currentValue });
    }
    return [{ metric, points }];
  });
}

export function findMetricChange(
  changes: MetricChange[] | undefined,
  metricId: string,
): MetricChange | undefined {
  return changes?.find((change) => change.metric_id === metricId);
}
