import { useRef, useState } from "react";

import {
  ApiError,
  playTurn,
  startGame,
  type GameStartResponse,
  type GameState,
  type GameTurnResponse,
  type MetricChange,
  type MetricDefinition,
  type ScenarioAction,
  type ScenarioCatalogEntry,
  type ScenarioDisplayMetadata,
  type TurnResult,
} from "../lib/api";

interface GameSession {
  scenario: ScenarioDisplayMetadata;
  scenarioId: string;
  scenarioVersion: string;
  seed: number;
  state: GameState;
  availableActions: ScenarioAction[];
  actionHistory: string[];
  lastResult: TurnResult | null;
}

interface GameplayScreenProps {
  catalogEntry: ScenarioCatalogEntry;
  onBack: () => void;
}

type PendingOperation = "start" | "turn" | null;

export function GameplayScreen({ catalogEntry, onBack }: GameplayScreenProps) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] =
    useState<PendingOperation>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedOperation, setFailedOperation] =
    useState<Exclude<PendingOperation, null>>("start");
  const requestInFlight = useRef(false);

  const isPending = pendingOperation !== null;
  const isTerminal = session?.state.status === "won" || session?.state.status === "lost";

  async function beginSimulation() {
    if (requestInFlight.current) {
      return;
    }
    requestInFlight.current = true;
    setPendingOperation("start");
    setErrorMessage(null);
    try {
      const response = await startGame(catalogEntry.scenario_id);
      setSession(sessionFromStart(response));
      setSelectedActionId(null);
      setFailedOperation("start");
    } catch (error) {
      setFailedOperation("start");
      setErrorMessage(describeError(error));
    } finally {
      requestInFlight.current = false;
      setPendingOperation(null);
    }
  }

  async function submitDecision() {
    if (
      requestInFlight.current ||
      session === null ||
      selectedActionId === null ||
      isTerminal
    ) {
      return;
    }
    requestInFlight.current = true;
    setPendingOperation("turn");
    setErrorMessage(null);
    try {
      const response = await playTurn({
        scenario_id: session.scenarioId,
        scenario_version: session.scenarioVersion,
        seed: session.seed,
        action_history: session.actionHistory,
        action_id: selectedActionId,
      });
      setSession(sessionFromTurn(session.scenario, response));
      setSelectedActionId(null);
      setFailedOperation("turn");
    } catch (error) {
      setFailedOperation("turn");
      setErrorMessage(describeError(error));
    } finally {
      requestInFlight.current = false;
      setPendingOperation(null);
    }
  }

  function retryLastRequest() {
    if (failedOperation === "start") {
      void beginSimulation();
    } else {
      void submitDecision();
    }
  }

  const scenarioTitle = session?.scenario.title ?? catalogEntry.title;
  const objective = session?.scenario.objective ?? catalogEntry.objective;

  return (
    <section aria-labelledby="gameplay-title" className="pb-10">
      <button
        className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white"
        onClick={onBack}
        type="button"
      >
        <span aria-hidden="true">←</span> Scenario library
      </button>

      <div className="rounded-3xl border border-teal-300/20 bg-gradient-to-br from-slate-900 to-slate-900/70 p-7 shadow-2xl shadow-black/20 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">
          Playable simulation
        </p>
        <h1
          className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl"
          id="gameplay-title"
        >
          {scenarioTitle}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
          {objective}
        </p>
        {session !== null && (
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
              Seed {session.seed}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
              Version {session.scenarioVersion}
            </span>
          </div>
        )}
      </div>

      {errorMessage !== null && (
        <div
          className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-300/5 p-5"
          role="alert"
        >
          <p className="font-bold text-rose-200">Simulation request failed</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{errorMessage}</p>
          <button
            className="mt-4 rounded-xl border border-rose-200/20 px-4 py-2 text-sm font-bold text-rose-100 disabled:cursor-wait disabled:opacity-60"
            disabled={isPending}
            onClick={retryLastRequest}
            type="button"
          >
            {isPending ? "Retrying…" : "Try Again"}
          </button>
        </div>
      )}

      {session === null ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold text-white">Ready to lead the company?</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-400">
            Start a fresh deterministic run. The server will generate a replay seed
            and return the authoritative initial metrics and decisions.
          </p>
          <button
            className="mt-7 rounded-xl bg-teal-300 px-6 py-3 font-bold text-slate-950 transition-colors hover:bg-teal-200 disabled:cursor-wait disabled:opacity-60"
            disabled={isPending}
            onClick={() => void beginSimulation()}
            type="button"
          >
            {pendingOperation === "start" ? "Starting Simulation…" : "Start Simulation"}
          </button>
        </div>
      ) : (
        <GameBoard
          isPending={isPending}
          onRestart={() => void beginSimulation()}
          onSelectAction={setSelectedActionId}
          onSubmit={() => void submitDecision()}
          selectedActionId={selectedActionId}
          session={session}
        />
      )}
    </section>
  );
}

interface GameBoardProps {
  session: GameSession;
  selectedActionId: string | null;
  isPending: boolean;
  onSelectAction: (actionId: string) => void;
  onSubmit: () => void;
  onRestart: () => void;
}

function GameBoard({
  session,
  selectedActionId,
  isPending,
  onSelectAction,
  onSubmit,
  onRestart,
}: GameBoardProps) {
  const isTerminal = session.state.status === "won" || session.state.status === "lost";
  const changes = new Map(
    session.lastResult?.metric_changes.map((change) => [change.metric_id, change]),
  );

  return (
    <div className="mt-8 space-y-7">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Current turn
          </p>
          <p className="mt-1 text-xl font-bold text-white">
            {capitalize(session.scenario.turn.unit)} {session.state.current_turn} of {session.state.max_turns}
          </p>
        </div>
        <StatusBadge status={session.state.status} />
      </div>

      {isTerminal && (
        <div
          className={`rounded-3xl border p-7 ${
            session.state.status === "won"
              ? "border-emerald-300/25 bg-emerald-300/10"
              : "border-rose-300/25 bg-rose-300/10"
          }`}
          role="status"
        >
          <p className="text-sm font-bold uppercase tracking-wider text-slate-300">
            Simulation complete
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            {session.state.status === "won" ? "Victory" : "Company Failure"}
          </h2>
          <p className="mt-3 text-slate-200">
            Outcome: {humanizeReason(session.lastResult?.outcome_reason ?? "complete")}
          </p>
          <button
            className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 disabled:cursor-wait disabled:opacity-60"
            disabled={isPending}
            onClick={onRestart}
            type="button"
          >
            {isPending ? "Restarting…" : "Restart Simulation"}
          </button>
        </div>
      )}

      <section aria-labelledby="metrics-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-300">Authoritative state</p>
            <h2 className="mt-1 text-2xl font-bold text-white" id="metrics-heading">
              Company metrics
            </h2>
          </div>
          <span className="text-xs text-slate-500">Calculated by the Python engine</span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {session.scenario.metrics.map((metric) => (
            <MetricCard
              change={changes.get(metric.metric_id)}
              showChange={session.lastResult !== null}
              key={metric.metric_id}
              metric={metric}
              value={session.state.metric_values[metric.metric_id] ?? metric.initial_value}
            />
          ))}
        </div>
      </section>

      {session.lastResult !== null && (
        <TurnSummary result={session.lastResult} turnUnit={session.scenario.turn.unit} />
      )}

      {!isTerminal && (
        <section
          aria-labelledby="decisions-heading"
          className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"
        >
          <p className="text-sm font-semibold text-teal-300">Your move</p>
          <h2 className="mt-1 text-2xl font-bold text-white" id="decisions-heading">
            Choose a decision
          </h2>
          <fieldset className="mt-5 grid gap-4 lg:grid-cols-3">
            <legend className="sr-only">Available decisions</legend>
            {session.availableActions.map((action) => {
              const selected = action.action_id === selectedActionId;
              return (
                <label
                  className={`cursor-pointer rounded-2xl border p-5 transition-colors ${
                    selected
                      ? "border-teal-300 bg-teal-300/10"
                      : "border-white/10 bg-slate-950/30 hover:border-white/20"
                  }`}
                  key={action.action_id}
                >
                  <input
                    checked={selected}
                    className="sr-only"
                    disabled={isPending}
                    name="decision"
                    onChange={() => onSelectAction(action.action_id)}
                    type="radio"
                    value={action.action_id}
                  />
                  <span className="font-bold text-white">{action.title}</span>
                  <span className="mt-2 block text-sm leading-6 text-slate-400">
                    {action.description}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <button
            className="mt-6 rounded-xl bg-teal-300 px-6 py-3 font-bold text-slate-950 transition-colors hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedActionId === null || isPending}
            onClick={onSubmit}
            type="button"
          >
            {isPending ? "Resolving Decision…" : "Confirm Decision"}
          </button>
        </section>
      )}
    </div>
  );
}

function MetricCard({
  metric,
  value,
  change,
  showChange,
}: {
  metric: MetricDefinition;
  value: number;
  change: MetricChange | undefined;
  showChange: boolean;
}) {
  const delta = change?.delta ?? 0;
  const changeKind = delta > 0 ? "positive" : delta < 0 ? "negative" : "unchanged";
  const favorability = getFavorability(metric, delta);
  const tone =
    favorability === "favorable"
      ? "text-emerald-300"
      : favorability === "unfavorable"
        ? "text-rose-300"
        : "text-slate-500";

  return (
    <article
      className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
      data-change={changeKind}
      data-metric-id={metric.metric_id}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
        {metric.title}
      </p>
      <p className="mt-3 text-2xl font-black tracking-tight text-white">
        {formatMetricValue(metric, value)}
      </p>
      {!showChange ? (
        <p className="mt-2 text-xs text-slate-600">Initial value</p>
      ) : (
        <p className={`mt-2 text-xs font-semibold ${tone}`}>
          {delta === 0 ? "No change" : `${delta > 0 ? "Increase" : "Decrease"} ${formatMetricDelta(metric, delta)}`}
          {favorability === "favorable" ? " · favorable" : ""}
          {favorability === "unfavorable" ? " · unfavorable" : ""}
        </p>
      )}
    </article>
  );
}

function TurnSummary({ result, turnUnit }: { result: TurnResult; turnUnit: string }) {
  return (
    <section
      aria-labelledby="turn-summary-heading"
      className="rounded-3xl border border-blue-300/15 bg-blue-300/5 p-6 sm:p-8"
    >
      <p className="text-sm font-semibold text-blue-200">Turn result</p>
      <h2 className="mt-1 text-2xl font-bold text-white" id="turn-summary-heading">
        {capitalize(turnUnit)} {result.completed_turn_index} resolved
      </h2>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Selected action
          </dt>
          <dd className="mt-1 font-semibold text-slate-200">
            {result.selected_action.title}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Game status
          </dt>
          <dd className="mt-1 font-semibold text-slate-200">
            {humanizeReason(result.resulting_status)}
          </dd>
        </div>
      </dl>
      {result.triggered_event !== null ? (
        <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-200">
            Event triggered
          </p>
          <h3 className="mt-2 text-lg font-bold text-white">
            {result.triggered_event.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {result.triggered_event.description}
          </p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-500">No event triggered this turn.</p>
      )}
      {result.resulting_status === "won" || result.resulting_status === "lost" ? (
        <p className="mt-5 text-sm font-semibold text-slate-200">
          Outcome reason: {humanizeReason(result.outcome_reason)}
        </p>
      ) : null}
    </section>
  );
}

function StatusBadge({ status }: { status: GameState["status"] }) {
  const style =
    status === "won"
      ? "bg-emerald-300/10 text-emerald-200"
      : status === "lost"
        ? "bg-rose-300/10 text-rose-200"
        : "bg-blue-300/10 text-blue-200";
  return (
    <span className={`w-fit rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wider ${style}`}>
      {humanizeReason(status)}
    </span>
  );
}

function sessionFromStart(response: GameStartResponse): GameSession {
  return {
    scenario: response.scenario,
    scenarioId: response.scenario_id,
    scenarioVersion: response.scenario_version,
    seed: response.seed,
    state: response.state,
    availableActions: response.available_actions,
    actionHistory: [],
    lastResult: null,
  };
}

function sessionFromTurn(
  scenario: ScenarioDisplayMetadata,
  response: GameTurnResponse,
): GameSession {
  return {
    scenario,
    scenarioId: response.scenario_id,
    scenarioVersion: response.scenario_version,
    seed: response.seed,
    state: response.state,
    availableActions: response.available_actions,
    actionHistory: response.action_history,
    lastResult: response.turn_result,
  };
}

function formatMetricValue(metric: MetricDefinition, value: number): string {
  if (metric.format.style === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: metric.format.currency_code ?? "USD",
      minimumFractionDigits: metric.format.decimals,
      maximumFractionDigits: metric.format.decimals,
    }).format(value / 100);
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

function formatMetricDelta(metric: MetricDefinition, delta: number): string {
  const absolute = formatMetricValue(metric, Math.abs(delta));
  return `${delta > 0 ? "+" : "−"}${absolute}`;
}

function getFavorability(
  metric: MetricDefinition,
  delta: number,
): "favorable" | "unfavorable" | "neutral" {
  if (delta === 0 || metric.favorable_direction === "neutral") {
    return "neutral";
  }
  const higherIsBetter = metric.favorable_direction === "higher";
  return (delta > 0) === higherIsBetter ? "favorable" : "unfavorable";
}

function humanizeReason(value: string): string {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "scenario_not_available") {
      return "This scenario is not available for play yet.";
    }
    return error.message;
  }
  if (error instanceof TypeError) {
    return "Could not reach the ScenarioLab API. Check the connection and retry.";
  }
  return "The API returned unexpected simulation data. Retry before continuing.";
}
