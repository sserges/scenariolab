import { useId } from "react";

import type { MetricSeries } from "../lib/metrics";
import { formatMetricValue } from "../lib/metrics";

interface MetricSeriesGroup {
  key: string;
  title: string;
  unit: string;
  series: MetricSeries[];
}

export function groupMetricSeries(series: MetricSeries[]): MetricSeriesGroup[] {
  const groups = new Map<string, MetricSeriesGroup>();
  for (const item of series) {
    const { metric } = item;
    const key = [
      metric.unit,
      metric.format.style,
      metric.format.currency_code ?? "",
      metric.format.suffix ?? "",
    ].join(":");
    const group = groups.get(key);
    if (group !== undefined) {
      group.series.push(item);
      continue;
    }
    groups.set(key, {
      key,
      title: metric.unit === "cents" ? "Financial trends" : `${titleCase(metric.unit)} trends`,
      unit: getDisplayUnit(metric),
      series: [item],
    });
  }
  const values = [...groups.values()];
  // Metrics that share a unit but differ in format (for example a reserve and its
  // per-turn rate) would otherwise get identical chart titles.
  const titleCounts = new Map<string, number>();
  for (const group of values) {
    titleCounts.set(group.title, (titleCounts.get(group.title) ?? 0) + 1);
  }
  for (const group of values) {
    const metric = group.series[0]!.metric;
    const rate = metric.format.suffix?.trim().match(/\/([a-z][a-z ]*)$/i);
    if ((titleCounts.get(group.title) ?? 0) > 1 && rate) {
      group.title = `${titleCase(metric.unit)} per ${rate[1]} trends`;
    }
  }
  return values;
}

export function MetricCharts({ series }: { series: MetricSeries[] }) {
  const groups = groupMetricSeries(series);
  const hasFinancialMetrics = series.some((item) => item.metric.unit === "cents");
  return (
    <section aria-labelledby="charts-heading" className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-accent">Simulation trends</p>
        <h2 className="mt-1 text-2xl font-bold text-primary" id="charts-heading">
          {hasFinancialMetrics ? "Financial and resource visualizations" : "Resource and status visualizations"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-secondary">
          Charts use the initial state and recorded values after completed turns. No
          intermediate values are inferred.
        </p>
      </div>
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-line bg-tint p-6 text-sm text-secondary">
          Chart history is unavailable until the server returns metric metadata and
          an initial state.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {groups.map((group) => (
            <MetricTrendChart group={group} key={group.key} />
          ))}
        </div>
      )}
    </section>
  );
}

function MetricTrendChart({ group }: { group: MetricSeriesGroup }) {
  const titleId = useId();
  const descriptionId = useId();
  const points = group.series[0]?.points ?? [];
  const values = group.series.flatMap((item) => item.points.map((point) => point.value));
  if (points.length === 0 || values.length === 0) {
    return null;
  }

  const width = 760;
  const height = 330;
  const left = 110;
  const right = 24;
  const top = 22;
  const bottom = 58;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const rawMin = values.reduce((minimum, value) => Math.min(minimum, value), Number.POSITIVE_INFINITY);
  const rawMax = values.reduce((maximum, value) => Math.max(maximum, value), Number.NEGATIVE_INFINITY);
  const pad = rawMin === rawMax
    ? Math.max(1, Math.abs(rawMax) * 0.05)
    : (rawMax - rawMin) * 0.08;
  const min = rawMin - pad;
  const max = rawMax + pad;
  const x = (index: number) =>
    points.length === 1
      ? left + plotWidth / 2
      : left + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) => top + ((max - value) / (max - min)) * plotHeight;
  const yTicks = Array.from({ length: 5 }, (_, index) => max - ((max - min) * index) / 4);
  const xTickIndices = getXTickIndices(points.length);

  return (
    <figure
      aria-labelledby={titleId}
      className="min-w-0 rounded-3xl border border-line bg-surface p-4 sm:p-6"
    >
      <figcaption className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-primary" id={titleId}>{group.title}</h3>
          <p className="mt-1 text-xs text-secondary">Recorded value by completed turn · {group.unit}</p>
        </div>
        {points.length === 1 && (
          <span className="rounded-full border border-line px-3 py-1 text-xs text-secondary">
            Initial state only
          </span>
        )}
      </figcaption>

      <svg
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="mt-4 h-auto w-full overflow-visible"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <desc id={descriptionId}>
          {group.series.map((item) => item.metric.title).join(", ")} over the initial state
          and {Math.max(0, points.length - 1)} completed turns. Values come from the
          authoritative game state and decision history.
        </desc>
        {yTicks.map((tick, index) => {
          const tickY = y(tick);
          return (
            <g key={`y-${index}`}>
              <line
                stroke="var(--theme-chart-grid)"
                strokeDasharray="4 6"
                strokeWidth="1"
                x1={left}
                x2={width - right}
                y1={tickY}
                y2={tickY}
              />
              <text
                fill="var(--theme-chart-label)"
                fontSize="24"
                textAnchor="end"
                x={left - 12}
                y={tickY + 4}
              >
                {formatAxisValue(group.series[0]!.metric, tick)}
              </text>
            </g>
          );
        })}
        <line stroke="var(--theme-chart-axis)" x1={left} x2={left} y1={top} y2={height - bottom} />
        <line
          stroke="var(--theme-chart-axis)"
          x1={left}
          x2={width - right}
          y1={height - bottom}
          y2={height - bottom}
        />
        <text
          fill="var(--theme-chart-label)"
          fontSize="22"
          textAnchor="middle"
          x={left + plotWidth / 2}
          y={height - 9}
        >
          Completed turn
        </text>
        {xTickIndices.map((index) => {
          const point = points[index];
          if (point === undefined) {
            return null;
          }
          const label = point.turn === 0 ? "Initial" : String(point.turn);
          return (
            <g key={`x-${point.turn}`}>
              <line
                stroke="var(--theme-chart-axis)"
                x1={x(index)}
                x2={x(index)}
                y1={height - bottom}
                y2={height - bottom + 5}
              />
              <text
                fill="var(--theme-chart-label)"
                fontSize="23"
                textAnchor="middle"
                x={x(index)}
                y={height - bottom + 22}
              >
                {label}
              </text>
            </g>
          );
        })}
        {group.series.map((item, seriesIndex) => {
          const color = `var(--theme-chart-series-${(seriesIndex % 6) + 1})`;
          const path = item.points
            .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.value)}`)
            .join(" ");
          return (
            <g key={item.metric.metric_id}>
              <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
              {item.points.map((point, index) => (
                <circle
                  cx={x(index)}
                  cy={y(point.value)}
                  fill="var(--theme-surface)"
                  key={`${item.metric.metric_id}-${point.turn}`}
                  r="4.5"
                  stroke={color}
                  strokeWidth="2.5"
                />
              ))}
            </g>
          );
        })}
      </svg>

      <ul aria-label={`${group.title} legend`} className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-secondary">
        {group.series.map((item, index) => (
          <li className="flex items-center gap-2" key={item.metric.metric_id}>
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: `var(--theme-chart-series-${(index % 6) + 1})` }}
            />
            {item.metric.title}
          </li>
        ))}
      </ul>

      <p className="sr-only">
        {group.series.map((item) => `${item.metric.title}: ${item.points.map((point) => `turn ${point.turn}, ${formatMetricValue(item.metric, point.value)}`).join("; ")}`).join(". ")}
      </p>
    </figure>
  );
}

function getXTickIndices(pointCount: number): number[] {
  if (pointCount <= 6) {
    return Array.from({ length: pointCount }, (_, index) => index);
  }
  const indices = new Set<number>([0, pointCount - 1]);
  const interval = Math.ceil((pointCount - 1) / 4);
  for (let index = interval; index < pointCount - 1; index += interval) {
    indices.add(index);
  }
  return [...indices].sort((first, second) => first - second);
}

function formatAxisValue(metric: MetricSeries["metric"], value: number): string {
  if (metric.format.style !== "currency") {
    return formatMetricValue(metric, value);
  }
  const amount = metric.unit === "cents" ? value / 100 : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: metric.format.currency_code ?? "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("-", " ");
}

function getDisplayUnit(metric: MetricSeries["metric"]): string {
  if (metric.format.style === "currency") {
    return metric.format.currency_code ?? "currency";
  }
  if (metric.format.style === "percentage") {
    return "%";
  }
  return metric.unit;
}
