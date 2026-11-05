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
}

export function DecisionHistory({
  records,
  turnUnit,
  definition,
  briefingsByTurn,
}: DecisionHistoryProps) {
  const metrics = new Map(definition.metrics.map((metric) => [metric.metric_id, metric]));
  const events = new Map(definition.events.map((event) => [event.event_id, event]));

  return (
    <section aria-labelledby="history-heading" className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-amber-200">Audit trail</p>
        <h2 className="mt-1 text-2xl font-bold text-white" id="history-heading">
          Decision history
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Chronological records returned by the simulation API. Rejected decisions do not appear here.
        </p>
      </div>

      {records.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-sm text-slate-400">
          No decisions have been completed yet.
        </p>
      ) : (
        <ol aria-label="Completed decisions in chronological order" className="space-y-4">
          {records.map((record) => (
            <DecisionHistoryEntry
              briefing={briefingsByTurn[record.turn] ?? null}
              events={events}
              key={`${record.sequence}-${record.action_id}`}
              metrics={metrics}
              record={record}
              turnUnit={turnUnit}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function DecisionHistoryEntry({
  briefing,
  events,
  metrics,
  record,
  turnUnit,
}: {
  briefing: AIBriefingResponse | null;
  events: Map<string, ScenarioDefinition["events"][number]>;
  metrics: Map<string, MetricDefinition>;
  record: DecisionRecord;
  turnUnit: string;
}) {
  const event = record.event_id === null ? undefined : events.get(record.event_id);
  return (
    <li className="relative rounded-3xl border border-white/10 bg-slate-900/60 p-5 sm:p-6" data-history-turn={record.turn}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-teal-200">
            {titleCase(turnUnit)} {record.turn}
          </p>
          <h3 className="mt-2 text-lg font-bold text-white">{record.action_title}</h3>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300">
          {humanize(record.resulting_status)}
        </span>
      </div>

      {event !== undefined ? (
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-200">Simulation event</p>
          <h4 className="mt-1 font-semibold text-white">{event.title}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-300">{event.description}</p>
        </div>
      ) : record.event_id !== null ? (
        <p className="mt-4 text-sm text-slate-400">Recorded event: {humanize(record.event_id)}</p>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No event triggered.</p>
      )}

      <div className="mt-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Metric changes</h4>
        {record.metric_changes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No metric changes recorded.</p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {record.metric_changes.map((change) => {
              const metric = metrics.get(change.metric_id);
              if (metric === undefined) {
                return (
                  <li className="text-sm text-slate-300" key={change.metric_id}>
                    Metric metadata unavailable for {humanize(change.metric_id)}.
                  </li>
                );
              }
              const favorability = getFavorability(metric, change.delta);
              const tone = favorability === "favorable"
                ? "text-emerald-200"
                : favorability === "unfavorable"
                  ? "text-rose-200"
                  : "text-slate-300";
              return (
                <li className="rounded-xl border border-white/5 bg-black/10 px-3 py-2 text-sm" key={change.metric_id}>
                  <span className="block font-semibold text-slate-200">{metric.title}</span>
                  <span className={`mt-1 block ${tone}`}>
                    {formatMetricValue(metric, change.previous_value)} → {formatMetricValue(metric, change.new_value)}
                    <span className="text-slate-400"> ({formatMetricDelta(metric, change.delta)})</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Outcome record: {humanize(record.outcome_reason)}
      </p>

      {briefing !== null && (
        <aside aria-label="AI narrative for this turn" className="mt-4 rounded-2xl border border-violet-300/15 bg-violet-300/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-200">AI explanation</p>
            <span className="text-xs font-semibold text-slate-300">
              {briefing.source === "live" ? "Live AI" : "Deterministic fallback"}
            </span>
          </div>
          <h4 className="mt-2 font-semibold text-white">{briefing.headline}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-300">{briefing.consequence_explanation}</p>
        </aside>
      )}
    </li>
  );
}

function humanize(value: string): string {
  return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
