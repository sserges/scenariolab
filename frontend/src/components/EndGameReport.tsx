import type { GameState, MetricDefinition, ScenarioDefinition } from "../lib/api";
import { formatMetricDelta, formatMetricValue, getFavorability } from "../lib/metrics";
import type { MetricSeries } from "../lib/metrics";
import { MetricCharts } from "./MetricCharts";

interface EndGameReportProps {
  state: GameState;
  definition: ScenarioDefinition;
  initialValues: Record<string, number>;
  metricSeries: MetricSeries[];
  onRestart: () => void;
  restarting: boolean;
}

export function EndGameReport({
  state,
  definition,
  initialValues,
  metricSeries,
  onRestart,
  restarting,
}: EndGameReportProps) {
  const won = state.status === "won";
  const lastRecord = state.decision_history.at(-1);
  const outcomeId = lastRecord?.outcome_reason ?? "outcome-unavailable";
  const outcome = [...definition.win_conditions, ...definition.loss_conditions]
    .find((condition) => condition.condition_id === outcomeId);
  const events = new Map(definition.events.map((event) => [event.event_id, event]));

  return (
    <section
      aria-labelledby="final-report-heading"
      className={`overflow-hidden rounded-3xl border ${won ? "border-emerald-300/25 bg-emerald-300/[0.06]" : "border-rose-300/25 bg-rose-300/[0.06]"}`}
    >
      <div className="flex flex-col gap-5 border-b border-white/10 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
        <div>
          <p className={`text-sm font-bold uppercase tracking-wider ${won ? "text-emerald-200" : "text-rose-200"}`}>
            Final report
          </p>
          <h2 className="mt-2 text-3xl font-black text-white" id="final-report-heading">
            {won ? "Victory" : "Failure"}
          </h2>
          <p className="mt-3 max-w-2xl text-slate-200">
            Outcome: {outcome?.title ?? humanize(outcomeId)}
          </p>
          {outcome?.description && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{outcome.description}</p>
          )}
          <p className="mt-4 text-sm text-slate-300">
            {state.decision_history.length} of {state.max_turns} turns completed · Final status: {humanize(state.status)}
          </p>
        </div>
        <button
          className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-teal-100 focus-visible:outline-offset-4 disabled:cursor-wait disabled:opacity-60"
          disabled={restarting}
          onClick={onRestart}
          type="button"
        >
          {restarting ? "Starting new game…" : "Restart Simulation"}
        </button>
      </div>

      <div className="space-y-8 p-6 sm:p-8">
        <div>
          <h3 className="text-lg font-bold text-white">Initial and final metrics</h3>
          <p className="mt-1 text-sm text-slate-400">
            Changes are final server values minus the original server-provided state.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-300">
                <tr>
                  <th className="px-4 py-3" scope="col">Metric</th>
                  <th className="px-4 py-3" scope="col">Initial</th>
                  <th className="px-4 py-3" scope="col">Final</th>
                  <th className="px-4 py-3" scope="col">Net change</th>
                </tr>
              </thead>
              <tbody>
                {definition.metrics.map((metric) => (
                  <FinalMetricRow
                    initialValue={initialValues[metric.metric_id] ?? metric.initial_value}
                    key={metric.metric_id}
                    metric={metric}
                    finalValue={state.metric_values[metric.metric_id] ?? metric.initial_value}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Decision and event recap</h3>
          {state.decision_history.length === 0 ? (
            <p className="mt-2 text-sm text-slate-300">No decisions were recorded.</p>
          ) : (
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {state.decision_history.map((record) => {
                const event = record.event_id === null ? undefined : events.get(record.event_id);
                return (
                  <li className="rounded-xl border border-white/10 bg-slate-950/30 p-4" key={`${record.sequence}-${record.action_id}`}>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Turn {record.turn} · {humanize(record.resulting_status)}
                    </p>
                    <p className="mt-1 font-semibold text-slate-100">{record.action_title}</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {event === undefined
                        ? record.event_id === null
                          ? "No event recorded"
                          : `Recorded event: ${humanize(record.event_id)}`
                        : `Event: ${event.title}`}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <MetricCharts series={metricSeries} />
      </div>
    </section>
  );
}

function FinalMetricRow({
  initialValue,
  metric,
  finalValue,
}: {
  initialValue: number;
  metric: MetricDefinition;
  finalValue: number;
}) {
  const delta = finalValue - initialValue;
  const favorability = getFavorability(metric, delta);
  const tone = favorability === "favorable"
    ? "text-emerald-200"
    : favorability === "unfavorable"
      ? "text-rose-200"
      : "text-slate-300";
  return (
    <tr className="border-t border-white/5" data-final-metric={metric.metric_id}>
      <th className="px-4 py-3 font-semibold text-slate-100" scope="row">{metric.title}</th>
      <td className="px-4 py-3 text-slate-300">{formatMetricValue(metric, initialValue)}</td>
      <td className="px-4 py-3 text-slate-100">{formatMetricValue(metric, finalValue)}</td>
      <td className={`px-4 py-3 font-semibold ${tone}`}>{formatMetricDelta(metric, delta)}</td>
    </tr>
  );
}

function humanize(value: string): string {
  return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
