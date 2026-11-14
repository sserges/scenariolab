import type {
  AIBriefingResponse,
  DecisionRecord,
  MetricDefinition,
  ScenarioDefinition,
} from "../lib/api";
import { formatMetricDelta, formatMetricValue, getFavorability } from "../lib/metrics";

interface DecisionHistoryProps {
  records: DecisionRecord[];
  turnUnit: string;
  definition: ScenarioDefinition;
  briefingsByTurn: Record<number, AIBriefingResponse>;
  /** False for scenarios whose briefings are always authored fallback text. */
  liveBriefings?: boolean;
}

/** Compact, newest-first decision log. Every entry is an authoritative engine record. */
export function DecisionHistory({
  records,
  turnUnit,
  definition,
  briefingsByTurn,
  liveBriefings = true,
}: DecisionHistoryProps) {
  const metrics = new Map(definition.metrics.map((metric) => [metric.metric_id, metric]));
  const events = new Map(definition.events.map((event) => [event.event_id, event]));
  const newestFirst = [...records].reverse();

  return (
    <section aria-labelledby="history-heading" className="rounded-2xl border border-line bg-surface px-4 pb-3 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-secondary" id="history-heading">
          Decision history
        </h2>
        <span className="text-[11px] text-secondary">Newest first</span>
      </div>

      {records.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-secondary">
          No decisions have been completed yet.
        </p>
      ) : (
        <ol aria-label="Completed decisions, newest first" className="mt-1">
          {newestFirst.map((record) => (
            <DecisionHistoryEntry
              briefing={briefingsByTurn[record.turn] ?? null}
              event={record.event_id === null ? undefined : events.get(record.event_id)}
              key={`${record.sequence}-${record.action_id}`}
              liveBriefings={liveBriefings}
              metrics={metrics}
              record={record}
              turnUnit={turnUnit}
            />
          ))}
        </ol>
      )}
      <p className="mt-2 border-t border-line pt-3 text-[11px] text-secondary">
        Rejected decisions never appear here.
      </p>
    </section>
  );
}

function DecisionHistoryEntry({
  briefing,
  event,
  liveBriefings,
  metrics,
  record,
  turnUnit,
}: {
  briefing: AIBriefingResponse | null;
  event: ScenarioDefinition["events"][number] | undefined;
  liveBriefings: boolean;
  metrics: Map<string, MetricDefinition>;
  record: DecisionRecord;
  turnUnit: string;
}) {
  const terminal = record.resulting_status === "won" || record.resulting_status === "lost";
  return (
    <li className="border-t border-line py-3 first:border-t-0" data-history-turn={record.turn}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
          {titleCase(turnUnit)} {record.turn}
        </p>
        {terminal && (
          <span className={`text-[11px] font-bold uppercase tracking-wider ${record.resulting_status === "won" ? "text-success" : "text-danger"}`}>
            {humanize(record.resulting_status)}
          </span>
        )}
      </div>
      <h3 className="mt-1 text-sm font-semibold text-primary">{record.action_title}</h3>

      {event !== undefined ? (
        <p className="mt-1 text-xs font-semibold text-warning">
          <span className="sr-only">Simulation event: </span>
          <span aria-hidden="true">Event · </span>
          <span>{event.title}</span>
        </p>
      ) : record.event_id !== null ? (
        <p className="mt-1 text-xs text-secondary">Recorded event: {humanize(record.event_id)}</p>
      ) : null}

      <details className="group mt-1.5">
        <summary className="cursor-pointer list-none text-xs font-semibold text-secondary hover:text-primary">
          <span aria-hidden="true" className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
          {record.metric_changes.length} metric {record.metric_changes.length === 1 ? "change" : "changes"}
          {briefing !== null ? " · briefing" : ""}
        </summary>
        {event !== undefined && (
          <p className="mt-2 text-xs leading-5 text-secondary">{event.description}</p>
        )}
        {record.metric_changes.length === 0 ? (
          <p className="mt-2 text-xs text-secondary">No metric changes recorded.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {record.metric_changes.map((change) => {
              const metric = metrics.get(change.metric_id);
              if (metric === undefined) {
                return (
                  <li className="text-xs text-secondary" key={change.metric_id}>
                    Metric metadata unavailable for {humanize(change.metric_id)}.
                  </li>
                );
              }
              const favorability = getFavorability(metric, change.delta);
              const tone = favorability === "favorable"
                ? "text-success"
                : favorability === "unfavorable"
                  ? "text-danger"
                  : "text-secondary";
              return (
                <li className="text-xs" key={change.metric_id}>
                  <span className="block font-semibold text-secondary">{metric.title}</span>
                  <span className={`metric-number block tabular-nums ${tone}`}>
                    {formatMetricValue(metric, change.previous_value)} → {formatMetricValue(metric, change.new_value)}
                    <span className="text-secondary"> ({formatMetricDelta(metric, change.delta)})</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-secondary">Outcome record: {humanize(record.outcome_reason)}</p>
        {briefing !== null && (
          <aside aria-label={liveBriefings ? "AI narrative for this turn" : "Briefing for this turn"} className="mt-2 rounded-xl bg-briefing/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-briefing">{liveBriefings ? "AI explanation" : "Briefing"}</p>
              <span className="text-[11px] font-semibold text-secondary">
                {!liveBriefings ? "Authored briefing" : briefing.source === "live" ? "Live AI" : "Deterministic fallback"}
              </span>
            </div>
            <h4 className="mt-1 text-xs font-semibold text-primary">{briefing.headline}</h4>
            <p className="mt-1 text-xs leading-5 text-secondary">{briefing.consequence_explanation}</p>
          </aside>
        )}
      </details>
    </li>
  );
}

function humanize(value: string): string {
  return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
