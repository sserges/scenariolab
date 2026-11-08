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

export function DirectorSourceIndicator({ source }: { source: "fallback" }) {
  return (
    <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
      Authored fallback
    </span>
  );
}

export function DirectorSituationCard({
  situation,
  turn,
}: {
  situation: DirectorTurnRecord["proposal"]["payload"]["situation"];
  turn: number;
}) {
  return (
    <article aria-labelledby="director-situation-title" className="relative overflow-hidden rounded-3xl border border-accent/25 bg-surface p-5 shadow-xl shadow-black/10 sm:p-7">
      <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Director situation · turn {turn}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-primary sm:text-3xl" id="director-situation-title">
            {situation.headline}
          </h2>
        </div>
        <DirectorSourceIndicator source="fallback" />
      </div>
      <p className="relative mt-4 max-w-3xl text-sm leading-7 text-secondary sm:text-base">{situation.description}</p>
      <p className="relative mt-5 text-xs font-semibold uppercase tracking-wider text-secondary">
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
    <section aria-labelledby="director-choices-heading" className="rounded-3xl border border-accent/15 bg-surface p-5 sm:p-7">
      <p className="text-sm font-semibold text-accent">Your response</p>
      <h2 className="mt-1 text-2xl font-bold text-primary" id="director-choices-heading">Choose a course of action</h2>
      <fieldset className="mt-5 grid gap-4 lg:grid-cols-2">
        <legend className="sr-only">Choose one Director response</legend>
        {choices.map((choice) => {
          const selected = choice.choice_id === selectedChoiceId;
          return (
            <label
              className={`block cursor-pointer rounded-2xl border p-5 transition-colors focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-canvas ${selected ? "border-accent bg-accent/10" : "border-line bg-inset hover:border-accent/40"}`}
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
              <span className="flex items-start gap-3 font-bold text-primary">
                <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-accent bg-accent text-on-accent" : "border-muted text-transparent"}`}>✓</span>
                <span>{choice.title}</span>
              </span>
              <span className="mt-3 block text-sm leading-6 text-secondary">{choice.description}</span>
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
    return <p className="mt-4 text-xs text-secondary">Authoritative preview unavailable.</p>;
  }
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4" data-testid="director-preview">
      <p className="text-xs font-bold uppercase tracking-wider text-secondary">Authoritative preview</p>
      <MetricChanges changes={preview.metric_changes} metrics={metrics} />
      <p className="mt-3 text-xs font-semibold text-secondary">Projected status: {humanize(preview.projected_status)}</p>
      {preview.scripted_event_title !== null && (
        <p className="mt-2 text-xs leading-5 text-warning">Curated event may trigger: {preview.scripted_event_title}</p>
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
    <section aria-labelledby="director-result-heading" className="rounded-3xl border border-accent/20 bg-accent/5 p-5 sm:p-6">
      <p className="text-sm font-semibold text-accent">Verified Director turn result</p>
      <h2 className="mt-1 text-xl font-bold text-primary" id="director-result-heading">Turn {result.completed_turn_index} resolved</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs font-bold uppercase tracking-wider text-secondary">Situation</dt><dd className="mt-1 font-semibold text-primary">{record.proposal.payload.situation.headline}</dd></div>
        <div><dt className="text-xs font-bold uppercase tracking-wider text-secondary">Selected choice</dt><dd className="mt-1 font-semibold text-primary">{choice?.title ?? result.selected_action.title}</dd></div>
        <div><dt className="text-xs font-bold uppercase tracking-wider text-secondary">Turn result</dt><dd className="mt-1 font-semibold text-primary">{humanize(result.resulting_status)} · {humanize(result.outcome_reason)}</dd></div>
        <div><dt className="text-xs font-bold uppercase tracking-wider text-secondary">Receipt</dt><dd className="mt-1 font-mono text-xs text-secondary">Signed by {record.receipt.signature.key_id}</dd></div>
      </dl>
      <MetricChanges changes={result.metric_changes} metrics={metrics} />
      {result.triggered_event !== null ? (
        <div className="mt-5 rounded-2xl border border-warning/20 bg-warning/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-warning">Curated simulation event</p>
          <h3 className="mt-1 font-bold text-primary">{result.triggered_event.title}</h3>
          <p className="mt-1 text-sm leading-6 text-secondary">{result.triggered_event.description}</p>
        </div>
      ) : <p className="mt-5 text-sm text-secondary">No curated event triggered this turn.</p>}
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
  if (records.length === 0) {
    return <section aria-labelledby="director-history-heading" className="rounded-3xl border border-line bg-surface p-5 sm:p-6"><h2 className="text-xl font-bold text-primary" id="director-history-heading">Director history</h2><p className="mt-2 text-sm text-secondary">Completed situations and signed turn results will appear here.</p></section>;
  }
  const events = new Map(definition.events.map((event) => [event.event_id, event]));
  return (
    <section aria-labelledby="director-history-heading" className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-xl font-bold text-primary" id="director-history-heading">Director history</h2>
      <ol className="mt-5 space-y-4">
        {records.map((record, index) => {
          const decision = state.decision_history[index];
          const choice = record.proposal.payload.choices.find((item) => item.choice_id === record.selected_choice_id);
          const event = decision?.event_id === null || decision?.event_id === undefined ? undefined : events.get(decision.event_id);
          return (
            <li className="rounded-2xl border border-line bg-inset p-4 sm:p-5" key={record.receipt.payload.result_digest}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-accent">Turn {index + 1} · {record.proposal.payload.situation.beat_id}</p>
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-secondary">Signed receipt</span>
              </div>
              <h3 className="mt-2 text-lg font-bold text-primary">{record.proposal.payload.situation.headline}</h3>
              <p className="mt-1 text-sm leading-6 text-secondary">{record.proposal.payload.situation.description}</p>
              <p className="mt-4 text-sm text-primary"><span className="font-semibold">Choice:</span> {choice?.title ?? record.selected_choice_id}</p>
              {decision !== undefined && <MetricChanges changes={decision.metric_changes} metrics={definition.metrics} />}
              {event !== undefined && <p className="mt-3 text-sm leading-6 text-warning">Curated event: {event.title} — {event.description}</p>}
              <p className="mt-3 text-xs text-secondary">Turn result: {decision === undefined ? "Verified" : `${humanize(decision.resulting_status)} · ${humanize(decision.outcome_reason)}`}</p>
            </li>
          );
        })}
      </ol>
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
  if (changes.length === 0) return <p className="mt-3 text-xs text-secondary">No metric changes recorded.</p>;
  return (
    <ul className="mt-3 space-y-1.5">
      {changes.map((change) => {
        const metric = metricById.get(change.metric_id);
        if (metric === undefined) return null;
        const tone = getFavorability(metric, change.delta);
        const color = tone === "favorable" ? "text-success" : tone === "unfavorable" ? "text-danger" : "text-secondary";
        return (
          <li className="flex flex-wrap justify-between gap-x-4 text-xs leading-5" key={change.metric_id}>
            <span className="text-secondary">{metric.title}</span>
            <span className={`font-semibold ${color}`}>
              {change.delta > 0 ? "+" : ""}{formatMetricDelta(metric, change.delta)} <span className="font-normal text-secondary">→ {formatMetricValue(metric, change.new_value)}</span>
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
