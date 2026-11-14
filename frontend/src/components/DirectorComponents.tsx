import type {
  DirectorChoice,
  DirectorChoicePreviewResponse,
  DirectorTurnRecord,
  GameState,
  MetricChange,
  MetricDefinition,
  ScenarioDefinition,
  TurnResult,
} from "../lib/api";
import { formatMetricDelta, formatMetricValue, getFavorability } from "../lib/metrics";

export function DirectorSourceIndicator({ source }: { source: "live" | "fallback" }) {
  return (
    <span aria-label={source === "live" ? "Situation source: AI generated" : "Situation source: authored fallback"} className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent" role="status">
      {source === "live" ? "AI generated" : "Authored fallback"}
    </span>
  );
}

export function DirectorSituationCard({
  situation,
  source,
  turn,
}: {
  situation: DirectorTurnRecord["proposal"]["payload"]["situation"];
  source: "live" | "fallback";
  turn: number;
}) {
  return (
    <article aria-labelledby="director-situation-title" className="console-enter rounded-2xl border border-accent/40 bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">Director situation · turn {turn}</p>
        <DirectorSourceIndicator source={source} />
      </div>
      <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-primary" id="director-situation-title">
        {situation.headline}
      </h2>
      <p className="mt-2 max-w-[68ch] text-sm leading-6 text-secondary">{situation.description}</p>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-secondary">
        Situation type: {situation.beat_id}
      </p>
    </article>
  );
}

export function DirectorChoiceList({
  choices,
  previews,
  selectedChoiceId,
  disabled,
  onSelect,
  metrics,
}: {
  choices: DirectorChoice[];
  previews: DirectorChoicePreviewResponse[];
  selectedChoiceId: string | null;
  disabled: boolean;
  onSelect: (choiceId: string) => void;
  metrics: MetricDefinition[];
}) {
  const previewByChoice = new Map(previews.map((preview) => [preview.choice_id, preview]));
  return (
    <section aria-labelledby="director-choices-heading" className="flex flex-col gap-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-secondary" id="director-choices-heading">Choose a course of action</h2>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Choose one Director response</legend>
        {choices.map((choice) => {
          const selected = choice.choice_id === selectedChoiceId;
          return (
            <label
              className={`flex cursor-pointer flex-col gap-2.5 rounded-2xl border-[1.5px] p-4 transition-colors focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-canvas ${selected ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-accent/50"}`}
              key={choice.choice_id}
            >
              <input
                checked={selected}
                className="sr-only"
                disabled={disabled}
                name="director-choice"
                onChange={() => onSelect(choice.choice_id)}
                type="radio"
                value={choice.choice_id}
              />
              <span className="flex items-start gap-3 font-bold leading-snug text-primary">
                <span aria-hidden="true" className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-accent" : "border-muted"}`}>
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                </span>
                <span>{choice.title}</span>
              </span>
              <span className="block text-sm leading-6 text-secondary">{choice.description}</span>
              <DirectorPreview preview={previewByChoice.get(choice.choice_id)} metrics={metrics} />
            </label>
          );
        })}
      </fieldset>
    </section>
  );
}

export function DirectorPreview({
  preview,
  metrics,
}: {
  preview: DirectorChoicePreviewResponse | undefined;
  metrics: MetricDefinition[];
}) {
  if (preview === undefined) {
    return <p className="text-xs text-secondary">Authoritative preview unavailable.</p>;
  }
  return (
    <div className="mt-auto rounded-xl bg-inset p-3" data-testid="director-preview">
      <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Authoritative preview</p>
      <MetricChanges changes={preview.metric_changes} metrics={metrics} />
      <p className="mt-2 text-xs font-semibold text-secondary">Projected status: {humanize(preview.projected_status)}</p>
      {preview.scripted_event_title !== null && (
        <p className="mt-1 text-xs leading-5 text-warning">Curated event may trigger: {preview.scripted_event_title}</p>
      )}
    </div>
  );
}

export function DirectorLatestResult({
  record,
  result,
  metrics,
}: {
  record: DirectorTurnRecord;
  result: TurnResult;
  metrics: MetricDefinition[];
}) {
  const choice = record.proposal.payload.choices.find((item) => item.choice_id === record.selected_choice_id);
  return (
    <section aria-labelledby="director-result-heading" className="console-enter rounded-2xl border border-line bg-surface p-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">Verified Director turn result</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-primary" id="director-result-heading">Turn {result.completed_turn_index} resolved</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-[11px] font-bold uppercase tracking-wider text-secondary">Situation</dt><dd className="mt-0.5 font-semibold text-primary">{record.proposal.payload.situation.headline}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-wider text-secondary">Selected choice</dt><dd className="mt-0.5 font-semibold text-primary">{choice?.title ?? result.selected_action.title}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-wider text-secondary">Turn result</dt><dd className="mt-0.5 font-semibold text-primary">{humanize(result.resulting_status)} · {humanize(result.outcome_reason)}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-wider text-secondary">Receipt</dt><dd className="mt-0.5 font-mono text-xs text-secondary">Signed by {record.receipt.signature.key_id}</dd></div>
          </dl>
          {result.triggered_event !== null ? (
            <div className="mt-3 rounded-xl bg-warning/10 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-warning">Curated simulation event</p>
              <h3 className="mt-0.5 font-bold text-primary">{result.triggered_event.title}</h3>
              <p className="mt-1 text-sm leading-6 text-secondary">{result.triggered_event.description}</p>
            </div>
          ) : <p className="mt-3 text-sm text-secondary">No curated event triggered this turn.</p>}
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Metric changes</p>
          <MetricChanges changes={result.metric_changes} metrics={metrics} />
        </div>
      </div>
    </section>
  );
}

export function DirectorHistory({
  records,
  state,
  definition,
}: {
  records: DirectorTurnRecord[];
  state: GameState;
  definition: ScenarioDefinition;
}) {
  const events = new Map(definition.events.map((event) => [event.event_id, event]));
  return (
    <section aria-labelledby="director-history-heading" className="rounded-2xl border border-line bg-surface px-4 pb-3 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-secondary" id="director-history-heading">Director history</h2>
        <span className="text-[11px] text-secondary">Newest first</span>
      </div>
      {records.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-secondary">Completed situations and signed turn results will appear here.</p>
      ) : (
        <ol className="mt-1">
          {records.map((record, index) => ({ record, index })).reverse().map(({ record, index }) => {
            const decision = state.decision_history[index];
            const choice = record.proposal.payload.choices.find((item) => item.choice_id === record.selected_choice_id);
            const event = decision?.event_id === null || decision?.event_id === undefined ? undefined : events.get(decision.event_id);
            return (
              <li className="border-t border-line py-3 first:border-t-0" key={record.receipt.payload.result_digest}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-accent">Turn {index + 1} · {record.proposal.payload.situation.beat_id}</p>
                  <DirectorSourceIndicator source={record.proposal.payload.source} />
                </div>
                <h3 className="mt-1 text-sm font-semibold text-primary">{record.proposal.payload.situation.headline}</h3>
                <p className="mt-0.5 text-xs text-primary"><span className="text-secondary">Choice:</span> {choice?.title ?? record.selected_choice_id}</p>
                {event !== undefined && <p className="mt-1 text-xs font-semibold text-warning">Curated event · {event.title}</p>}
                <details className="group mt-1.5">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-secondary hover:text-primary">
                    <span aria-hidden="true" className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
                    Details and signed receipt
                  </summary>
                  <p className="mt-2 text-xs leading-5 text-secondary">{record.proposal.payload.situation.description}</p>
                  {decision !== undefined && <MetricChanges changes={decision.metric_changes} metrics={definition.metrics} />}
                  {event !== undefined && <p className="mt-2 text-xs leading-5 text-secondary">{event.description}</p>}
                  <p className="mt-2 text-[11px] text-secondary">Turn result: {decision === undefined ? "Verified" : `${humanize(decision.resulting_status)} · ${humanize(decision.outcome_reason)}`} · Signed receipt</p>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function MetricChanges({
  changes,
  metrics,
}: {
  changes: MetricChange[];
  metrics: MetricDefinition[];
}) {
  const metricById = new Map(metrics.map((metric) => [metric.metric_id, metric]));
  if (changes.length === 0) return <p className="mt-2 text-xs text-secondary">No metric changes recorded.</p>;
  return (
    <ul className="mt-2 space-y-1">
      {changes.map((change) => {
        const metric = metricById.get(change.metric_id);
        if (metric === undefined) return null;
        const tone = getFavorability(metric, change.delta);
        const color = tone === "favorable" ? "text-success" : tone === "unfavorable" ? "text-danger" : "text-secondary";
        return (
          <li className="flex flex-wrap justify-between gap-x-4 text-xs leading-5" key={change.metric_id}>
            <span className="text-secondary">{metric.title}</span>
            <span className={`metric-number font-semibold tabular-nums ${color}`}>
              {formatMetricDelta(metric, change.delta)} <span className="font-normal text-secondary">→ {formatMetricValue(metric, change.new_value)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function directorChoiceForRecord(record: DirectorTurnRecord): DirectorChoice | undefined {
  return record.proposal.payload.choices.find((choice) => choice.choice_id === record.selected_choice_id);
}

function humanize(value: string): string {
  return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
