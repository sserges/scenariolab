import type { MetricChange, MetricDefinition } from "../lib/api";
import {
  displayRange,
  isNearThreshold,
  isSignedMetric,
  percentWithin,
  sparklinePath,
} from "../lib/metricDisplay";
import { formatMetricDelta, formatMetricValue, getFavorability } from "../lib/metrics";
import type { MetricSeries } from "../lib/metrics";

interface MetricRailProps {
  metrics: MetricDefinition[];
  values: Record<string, number>;
  changes: Map<string, MetricChange>;
  showChange: boolean;
  series: MetricSeries[];
  turnUnit: string;
}

export function MetricRail({ metrics, values, changes, showChange, series, turnUnit }: MetricRailProps) {
  const seriesById = new Map(series.map((item) => [item.metric.metric_id, item.points.map((point) => point.value)]));
  return (
    <section aria-labelledby="metrics-heading" className="rounded-2xl border border-line bg-surface px-4 pb-2 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-secondary" id="metrics-heading">Key metrics</h2>
        <span className="text-[11px] text-secondary">From the Python engine</span>
      </div>
      <div className="mt-1">
        {metrics.map((metric) => (
          <MetricRow
            change={changes.get(metric.metric_id)}
            history={seriesById.get(metric.metric_id) ?? []}
            key={metric.metric_id}
            metric={metric}
            showChange={showChange}
            turnUnit={turnUnit}
            value={values[metric.metric_id] ?? metric.initial_value}
          />
        ))}
      </div>
    </section>
  );
}

function MetricRow({
  metric,
  value,
  change,
  showChange,
  history,
  turnUnit,
}: {
  metric: MetricDefinition;
  value: number;
  change: MetricChange | undefined;
  showChange: boolean;
  history: number[];
  turnUnit: string;
}) {
  const delta = change?.delta ?? 0;
  const favorability = getFavorability(metric, delta);
  const tone = favorability === "favorable" ? "text-success" : favorability === "unfavorable" ? "text-danger" : "text-secondary";
  const range = displayRange(metric, history.length > 0 ? history : [value]);
  const signed = isSignedMetric(metric);
  const near = !signed && isNearThreshold(metric, value, range);
  const valuePercent = percentWithin(range, value);
  const zeroPercent = percentWithin(range, 0);
  const fill = signed
    ? {
        left: `${Math.min(zeroPercent, valuePercent)}%`,
        width: `${Math.max(Math.abs(valuePercent - zeroPercent), 1.5)}%`,
      }
    : { left: "0%", width: `${Math.max(valuePercent, 1.5)}%` };
  const fillColor = signed
    ? value >= 0 ? "bg-success" : "bg-danger"
    : near ? "bg-warning" : "bg-accent";
  const markerPercent = signed
    ? zeroPercent
    : metric.critical_threshold === null ? null : percentWithin(range, metric.critical_threshold);
  const formatted = formatMetricValue(metric, value);
  const note = change?.exhausted
    ? "Exhausted this turn"
    : metric.critical_threshold !== null
      ? `${near ? "Close to the limit · " : ""}Critical at ${formatMetricValue(metric, metric.critical_threshold)}`
      : signed
        ? `Applied every ${turnUnit}`
        : metric.description;

  return (
    <article
      aria-label={`${metric.title}: ${formatted}`}
      className="border-t border-line py-3 first:border-t-0"
      data-change={delta > 0 ? "positive" : delta < 0 ? "negative" : "unchanged"}
      data-metric-id={metric.metric_id}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-primary">{metric.title}</p>
        <p className={`text-xs font-bold tabular-nums ${showChange ? tone : "text-secondary"}`}>
          {!showChange ? (
            "Initial value"
          ) : delta === 0 ? (
            "No change this turn"
          ) : (
            <>
              <span aria-hidden="true">{delta > 0 ? "↑ " : "↓ "}</span>
              <span className="sr-only">{delta > 0 ? "Increase " : "Decrease "}</span>
              {formatMetricDelta(metric, delta)}
              {favorability !== "neutral" && <span className="sr-only">{` · ${favorability}`}</span>}
            </>
          )}
        </p>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className={`metric-number break-words text-2xl font-bold tracking-tight tabular-nums ${near ? "text-warning" : "text-primary"}`}>
          {formatted}
        </p>
        <svg aria-hidden="true" className="h-6 w-24 shrink-0 overflow-visible text-accent" viewBox="0 0 96 24">
          <path d={sparklinePath(history)} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </div>
      <div className="relative mt-2 h-1.5 rounded-full bg-inset">
        <span className={`absolute inset-y-0 rounded-full ${fillColor}`} style={fill} />
        {markerPercent !== null && (
          <span
            className={`absolute -inset-y-1 w-0.5 ${signed ? "bg-secondary" : "bg-danger"}`}
            style={{ left: `calc(${markerPercent}% - 1px)` }}
          />
        )}
      </div>
      <p className={`mt-1.5 line-clamp-1 text-[11px] ${near ? "font-semibold text-warning" : "text-secondary"}`}>{note}</p>
    </article>
  );
}
