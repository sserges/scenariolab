import { useEffect, useRef, useState } from "react";

import {
  ApiError,
  getAIBriefing,
  playTurn,
  startGame,
  type AIBriefingResponse,
  type GameStartResponse,
  type GameState,
  type GameTurnResponse,
  type MetricChange,
  type MetricDefinition,
  type ScenarioAction,
  type ScenarioCatalogEntry,
  type ScenarioDefinition,
  type ScenarioDisplayMetadata,
  type TurnResult,
} from "../lib/api";
import { buildMetricSeries, formatMetricDelta, formatMetricValue, getFavorability } from "../lib/metrics";
import {
  SAVE_FORMAT_VERSION,
  writeSavedRun,
} from "../lib/savedRun";
import type { SaveReadResult, SavedRun, SaveWriteResult } from "../lib/savedRun";
import { DecisionHistory } from "./DecisionHistory";
import { EndGameReport } from "./EndGameReport";
import { MetricCharts } from "./MetricCharts";

interface GameSession {
  scenario: ScenarioDisplayMetadata;
  scenarioId: string;
  scenarioVersion: string;
  seed: number;
  initialMetricValues: Record<string, number>;
  state: GameState;
  availableActions: ScenarioAction[];
  actionHistory: string[];
  lastResult: TurnResult | null;
}

interface GameplayScreenProps {
  catalogEntry: ScenarioCatalogEntry;
  scenarioDefinition: ScenarioDefinition;
  resumeSave?: SavedRun | null;
  onSaveStateChange?: (state: SaveReadResult) => void;
  onBack: () => void;
}

type PendingOperation = "start" | "resume" | "turn" | null;
type FailedOperation = Exclude<PendingOperation, null>;
type BriefingStatus = "idle" | "loading" | "ready" | "failed";

export function GameplayScreen({
  catalogEntry,
  scenarioDefinition,
  resumeSave = null,
  onSaveStateChange,
  onBack,
}: GameplayScreenProps) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedOperation, setFailedOperation] = useState<FailedOperation>("start");
  const [briefingsByTurn, setBriefingsByTurn] = useState<Record<number, AIBriefingResponse>>({});
  const [briefingStatus, setBriefingStatus] = useState<BriefingStatus>("idle");
  const [persistenceStatus, setPersistenceStatus] = useState<SaveWriteResult | "idle">("idle");
  const requestInFlight = useRef(false);
  const resumeStarted = useRef(false);
  const briefingVersion = useRef(0);
  const briefingController = useRef<AbortController | null>(null);
  const lastBriefingRequestKey = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      briefingVersion.current += 1;
      briefingController.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (resumeSave !== null && !resumeStarted.current) {
      resumeStarted.current = true;
      void restoreSavedSimulation();
    }
  }, [resumeSave]);

  const isPending = pendingOperation !== null;

  async function beginSimulation() {
    if (requestInFlight.current) {
      return;
    }
    invalidateBriefings();
    requestInFlight.current = true;
    setPendingOperation("start");
    setErrorMessage(null);
    try {
      const response = await startGame(catalogEntry.scenario_id);
      assertStartMatchesDefinition(response, scenarioDefinition);
      const freshSession = sessionFromStart(response);
      setSession(freshSession);
      setSelectedActionId(null);
      setBriefingsByTurn({});
      setBriefingStatus("idle");
      setFailedOperation("start");
      persistRun(saveFromSession(freshSession));
    } catch (error) {
      setFailedOperation("start");
      setErrorMessage(describeError(error));
    } finally {
      requestInFlight.current = false;
      setPendingOperation(null);
    }
  }

  async function restoreSavedSimulation() {
    if (requestInFlight.current || resumeSave === null) {
      return;
    }
    requestInFlight.current = true;
    setPendingOperation("resume");
    setErrorMessage(null);
    setFailedOperation("resume");
    try {
      if (
        resumeSave.scenario_id !== scenarioDefinition.scenario_id ||
        resumeSave.scenario_version !== scenarioDefinition.version
      ) {
        throw new Error("The saved scenario version is no longer available. The save has not been changed.");
      }
      if (resumeSave.action_history.length > scenarioDefinition.turn.max_turns) {
        throw new Error("Saved progress exceeds this scenario's turn limit. The save has not been changed.");
      }

      const initialResponse = await startGame(resumeSave.scenario_id, resumeSave.seed);
      assertStartMatchesDefinition(initialResponse, scenarioDefinition);
      if (initialResponse.seed !== resumeSave.seed) {
        throw new Error("The server returned a different replay seed. Saved progress has not been changed.");
      }

      let history: string[] = [];
      let latestResponse: GameTurnResponse | null = null;
      for (const actionId of resumeSave.action_history) {
        const response = await playTurn({
          scenario_id: resumeSave.scenario_id,
          scenario_version: resumeSave.scenario_version,
          seed: resumeSave.seed,
          action_history: history,
          action_id: actionId,
        });
        const expectedHistory = [...history, actionId];
        if (
          response.scenario_id !== resumeSave.scenario_id ||
          response.scenario_version !== resumeSave.scenario_version ||
          response.seed !== resumeSave.seed ||
          !sameStrings(response.action_history, expectedHistory) ||
          response.state.decision_history.length !== expectedHistory.length
        ) {
          throw new Error("The API returned an inconsistent replay. Saved progress has not been changed.");
        }
        latestResponse = response;
        history = response.action_history;
      }

      const restoredSession = latestResponse === null
        ? sessionFromStart(initialResponse)
        : sessionFromTurn(
            initialResponse.scenario,
            initialResponse.state.metric_values,
            latestResponse,
          );
      setSession(restoredSession);
      setSelectedActionId(null);
      setBriefingsByTurn({});
      setBriefingStatus("idle");
      setPersistenceStatus("saved");
      onSaveStateChange?.({ status: "valid", save: resumeSave });
      setErrorMessage(null);
    } catch (error) {
      const detail = error instanceof ApiError
        ? ` The game API rejected the saved action history (${error.code}).`
        : error instanceof Error
          ? ` ${error.message}`
          : "";
      setErrorMessage(`Saved progress could not be reconstructed.${detail} The saved data was preserved.`);
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
      isTerminal(session.state)
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
      const nextSession = sessionFromTurn(
        session.scenario,
        session.initialMetricValues,
        response,
      );
      setSession(nextSession);
      setSelectedActionId(null);
      setFailedOperation("turn");
      persistRun(saveFromSession(nextSession));
      void requestBriefing(response);
    } catch (error) {
      setFailedOperation("turn");
      setErrorMessage(describeError(error));
    } finally {
      requestInFlight.current = false;
      setPendingOperation(null);
    }
  }

  async function requestBriefing(response: GameTurnResponse) {
    const requestKey = JSON.stringify([
      response.scenario_id,
      response.scenario_version,
      response.seed,
      response.action_history,
    ]);
    if (lastBriefingRequestKey.current === requestKey) {
      return;
    }
    lastBriefingRequestKey.current = requestKey;
    briefingController.current?.abort();
    const controller = new AbortController();
    briefingController.current = controller;
    const version = briefingVersion.current + 1;
    briefingVersion.current = version;
    setBriefingStatus("loading");
    try {
      const responseBody = await getAIBriefing(
        {
          scenario_id: response.scenario_id,
          scenario_version: response.scenario_version,
          seed: response.seed,
          action_history: response.action_history,
        },
        controller.signal,
      );
      if (briefingVersion.current === version) {
        setBriefingsByTurn((current) => ({
          ...current,
          [response.turn_result.completed_turn_index]: responseBody,
        }));
        setBriefingStatus("ready");
      }
    } catch {
      if (controller.signal.aborted) {
        return;
      }
      if (briefingVersion.current === version) {
        setBriefingStatus("failed");
      }
    }
  }

  function invalidateBriefings() {
    briefingVersion.current += 1;
    briefingController.current?.abort();
    briefingController.current = null;
    lastBriefingRequestKey.current = null;
    setBriefingsByTurn({});
    setBriefingStatus("idle");
  }

  function persistRun(save: SavedRun) {
    const result = writeSavedRun(save);
    setPersistenceStatus(result);
    if (result === "saved") {
      onSaveStateChange?.({ status: "valid", save });
    } else if (result === "invalid") {
      onSaveStateChange?.({ status: "invalid" });
    } else {
      onSaveStateChange?.({ status: "unavailable" });
    }
  }

  function retryLastRequest() {
    if (failedOperation === "start") {
      void beginSimulation();
    } else if (failedOperation === "resume") {
      void restoreSavedSimulation();
    } else {
      void submitDecision();
    }
  }

  const scenarioTitle = session?.scenario.title ?? scenarioDefinition.title ?? catalogEntry.title;
  const objective = session?.scenario.objective ?? scenarioDefinition.metadata.objective ?? catalogEntry.objective;

  return (
    <section aria-labelledby="gameplay-title" className="pb-12">
      <button
        className="mb-7 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-secondary transition-colors hover:text-primary focus-visible:outline-offset-4"
        onClick={onBack}
        type="button"
      >
        <span aria-hidden="true">←</span> Scenario library
      </button>

      <header className="rounded-3xl border border-accent/20 bg-surface p-6 shadow-2xl shadow-black/20 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Playable simulation</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-primary sm:text-5xl" id="gameplay-title">
          {scenarioTitle}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-secondary sm:text-lg sm:leading-8">{objective}</p>
        {session !== null && (
          <dl className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-secondary">
            <div className="rounded-full border border-line bg-tint px-3 py-2">
              <dt className="sr-only">Replay seed</dt><dd>Seed {session.seed}</dd>
            </div>
            <div className="rounded-full border border-line bg-tint px-3 py-2">
              <dt className="sr-only">Scenario version</dt><dd>Version {session.scenarioVersion}</dd>
            </div>
          </dl>
        )}
      </header>

      {persistenceStatus === "unavailable" && session !== null && (
        <p className="mt-5 rounded-2xl border border-warning/20 bg-warning/5 p-4 text-sm leading-6 text-warning" role="status">
          Local storage is unavailable. Gameplay is still active, but progress could not be saved on this device.
        </p>
      )}
      {persistenceStatus === "saved" && session !== null && (
        <p className="sr-only" role="status" aria-live="polite">Progress saved on this device.</p>
      )}

      {errorMessage !== null && (
        <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/5 p-5" role="alert">
          <p className="font-bold text-danger">{failedOperation === "resume" ? "Saved game could not resume" : "Simulation request failed"}</p>
          <p className="mt-2 text-sm leading-6 text-secondary">{errorMessage}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="min-h-10 rounded-xl border border-danger/30 px-4 py-2 text-sm font-bold text-danger hover:bg-danger/10 disabled:cursor-wait disabled:opacity-60"
              disabled={isPending}
              onClick={retryLastRequest}
              type="button"
            >
              {isPending ? "Retrying…" : "Try Again"}
            </button>
            {failedOperation === "resume" && (
              <button
                className="min-h-10 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-secondary hover:bg-tint"
                onClick={onBack}
                type="button"
              >
                Back to Scenario Library
              </button>
            )}
          </div>
        </div>
      )}

      {session === null ? (
        <div className="mt-7 rounded-3xl border border-line bg-tint p-7 text-center sm:p-12">
          {pendingOperation === "resume" ? (
            <div aria-live="polite" className="mx-auto max-w-xl" role="status">
              <h2 className="text-2xl font-bold text-primary">Resuming saved simulation</h2>
              <p className="mt-3 leading-7 text-secondary">
                The backend is replaying the saved decisions from the original seed. Past turns will not request AI briefings.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-primary">Ready for a new run?</h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-secondary">
                Start a new deterministic run. The server will provide the initial state and allowed decisions.
                A successful start replaces this device’s prior save.
              </p>
              <button
                className="mt-7 min-h-12 rounded-xl bg-accent px-6 py-3 font-bold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
                disabled={isPending}
                onClick={() => void beginSimulation()}
                type="button"
              >
                {pendingOperation === "start" ? "Starting New Game…" : "Start New Game"}
              </button>
            </>
          )}
        </div>
      ) : (
        <GameBoard
          briefing={briefingsByTurn[session.state.decision_history.length] ?? null}
          briefingsByTurn={briefingsByTurn}
          briefingStatus={briefingStatus}
          definition={scenarioDefinition}
          isPending={isPending}
          onRestart={() => void beginSimulation()}
          onSelectAction={setSelectedActionId}
          onSubmit={() => void submitDecision()}
          persistenceStatus={persistenceStatus}
          selectedActionId={selectedActionId}
          session={session}
        />
      )}
    </section>
  );
}

interface GameBoardProps {
  session: GameSession;
  definition: ScenarioDefinition;
  briefing: AIBriefingResponse | null;
  briefingsByTurn: Record<number, AIBriefingResponse>;
  briefingStatus: BriefingStatus;
  selectedActionId: string | null;
  isPending: boolean;
  persistenceStatus: SaveWriteResult | "idle";
  onSelectAction: (actionId: string) => void;
  onSubmit: () => void;
  onRestart: () => void;
}

function GameBoard({
  session,
  definition,
  briefing,
  briefingsByTurn,
  briefingStatus,
  selectedActionId,
  isPending,
  persistenceStatus,
  onSelectAction,
  onSubmit,
  onRestart,
}: GameBoardProps) {
  const terminal = isTerminal(session.state);
  const latestChanges = new Map(
    session.lastResult?.metric_changes.map((change) => [change.metric_id, change]),
  );
  const metricSeries = buildMetricSeries(
    session.scenario.metrics,
    session.initialMetricValues,
    session.state.decision_history,
  );
  const completedTurns = session.state.decision_history.length;

  return (
    <div className="mt-7 space-y-8">
      <section aria-labelledby="turn-progress-heading" className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-secondary">Simulation progress</p>
            <h2 aria-live="polite" className="mt-1 text-xl font-bold text-primary" id="turn-progress-heading">
              {capitalize(session.scenario.turn.unit)} {session.state.current_turn} of {session.state.max_turns}
            </h2>
            <p className="mt-1 text-sm text-secondary">
              {completedTurns} {completedTurns === 1 ? "decision" : "decisions"} completed
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:max-w-xs">
            <label className="text-xs font-semibold text-secondary" htmlFor="turn-progress">
              {completedTurns} of {session.state.max_turns} turns complete
            </label>
            <progress
              aria-label="Simulation progress"
              className="h-3 w-full accent-accent"
              id="turn-progress"
              max={session.state.max_turns}
              value={completedTurns}
            />
          </div>
          <StatusBadge status={session.state.status} />
        </div>
      </section>

      <section aria-labelledby="metrics-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">Authoritative state</p>
            <h2 className="mt-1 text-2xl font-bold text-primary" id="metrics-heading">Key metrics</h2>
          </div>
          <span className="text-xs text-secondary">Values and changes from the Python engine</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {session.scenario.metrics.map((metric) => (
            <MetricCard
              change={latestChanges.get(metric.metric_id)}
              key={metric.metric_id}
              metric={metric}
              showChange={session.lastResult !== null}
              value={session.state.metric_values[metric.metric_id] ?? metric.initial_value}
            />
          ))}
        </div>
      </section>

      <MetricCharts series={metricSeries} />

      {!terminal && (
        <section
          aria-labelledby="decisions-heading"
          className="rounded-3xl border border-accent/15 bg-surface p-5 sm:p-7"
        >
          <p className="text-sm font-semibold text-accent">Your move</p>
          <h2 className="mt-1 text-2xl font-bold text-primary" id="decisions-heading">Available decisions</h2>
          <fieldset className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <legend className="sr-only">Choose one available decision</legend>
            {session.availableActions.map((action) => {
              const selected = action.action_id === selectedActionId;
              return (
                <label
                  className={`group min-h-32 cursor-pointer rounded-2xl border p-5 transition-colors focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-canvas ${selected ? "border-accent bg-accent/10" : "border-line bg-inset hover:border-line"}`}
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
                  <span className="flex items-center gap-3 font-bold text-primary">
                    <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-accent bg-accent text-on-accent" : "border-muted text-transparent"}`}>✓</span>
                    {action.title}
                  </span>
                  <span className="mt-3 block text-sm leading-6 text-secondary">{action.description}</span>
                </label>
              );
            })}
          </fieldset>
          <button
            className="mt-5 min-h-12 rounded-xl bg-accent px-6 py-3 font-bold text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedActionId === null || isPending}
            onClick={onSubmit}
            type="button"
          >
            {isPending ? "Resolving Decision…" : "Confirm Decision"}
          </button>
          {persistenceStatus === "saved" && (
            <span className="ml-4 text-xs text-secondary">Saved automatically on this device</span>
          )}
        </section>
      )}

      {session.lastResult !== null && (
        <section aria-label="Latest turn explanation" className="grid gap-5 xl:grid-cols-2">
          <TurnSummary result={session.lastResult} turnUnit={session.scenario.turn.unit} />
          <AIBriefingPanel
            briefing={briefing}
            completedTurn={session.lastResult.completed_turn_index}
            restored={briefing === null && briefingStatus === "idle"}
            status={briefingStatus}
          />
        </section>
      )}

      <DecisionHistory
        briefingsByTurn={briefingsByTurn}
        definition={definition}
        records={session.state.decision_history}
        turnUnit={session.scenario.turn.unit}
      />

      {terminal && (
        <EndGameReport
          definition={definition}
          initialValues={session.initialMetricValues}
          metricSeries={metricSeries}
          onRestart={onRestart}
          restarting={isPending}
          state={session.state}
        />
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
  const favorability = getFavorability(metric, delta);
  const tone = favorability === "favorable"
    ? "text-success"
    : favorability === "unfavorable"
      ? "text-danger"
      : "text-secondary";
  return (
    <article
      aria-label={`${metric.title}: ${formatMetricValue(metric, value)}`}
      className="min-w-0 rounded-2xl border border-line bg-surface p-5"
      data-change={delta > 0 ? "positive" : delta < 0 ? "negative" : "unchanged"}
      data-metric-id={metric.metric_id}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-secondary">{metric.title}</p>
      <p className="mt-3 break-words text-2xl font-black tracking-tight text-primary sm:text-3xl">
        {formatMetricValue(metric, value)}
      </p>
      <p className={`mt-2 text-xs font-semibold ${showChange ? tone : "text-secondary"}`}>
        {!showChange
          ? "Initial value"
          : delta === 0
            ? "No change this turn"
            : `${delta > 0 ? "Increase" : "Decrease"} ${formatMetricDelta(metric, delta)}${favorability === "favorable" ? " · favorable" : favorability === "unfavorable" ? " · unfavorable" : ""}`}
      </p>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-secondary">{metric.description}</p>
    </article>
  );
}

function TurnSummary({ result, turnUnit }: { result: TurnResult; turnUnit: string }) {
  return (
    <section aria-labelledby="turn-summary-heading" className="rounded-3xl border border-accent/15 bg-accent/5 p-5 sm:p-6">
      <p className="text-sm font-semibold text-accent">Latest authoritative result</p>
      <h2 className="mt-1 text-xl font-bold text-primary" id="turn-summary-heading">
        {capitalize(turnUnit)} {result.completed_turn_index} resolved
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-secondary">Selected decision</dt>
          <dd className="mt-1 font-semibold text-primary">{result.selected_action.title}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-secondary">Resulting status</dt>
          <dd className="mt-1 font-semibold text-primary">{humanize(result.resulting_status)}</dd>
        </div>
      </dl>
      {result.triggered_event !== null ? (
        <div className="mt-5 rounded-2xl border border-warning/20 bg-warning/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-warning">Simulation event</p>
          <h3 className="mt-1 font-bold text-primary">{result.triggered_event.title}</h3>
          <p className="mt-1 text-sm leading-6 text-secondary">{result.triggered_event.description}</p>
        </div>
      ) : (
        <p className="mt-5 text-sm text-secondary">No event triggered this turn.</p>
      )}
    </section>
  );
}

function AIBriefingPanel({
  briefing,
  completedTurn,
  restored,
  status,
}: {
  briefing: AIBriefingResponse | null;
  completedTurn: number;
  restored: boolean;
  status: BriefingStatus;
}) {
  if (status === "loading") {
    return (
      <section aria-labelledby="ai-briefing-heading" aria-live="polite" className="rounded-3xl border border-briefing/20 bg-briefing/5 p-5 sm:p-6">
        <p className="text-sm font-semibold text-briefing">AI strategic briefing</p>
        <h2 className="mt-1 text-xl font-bold text-primary" id="ai-briefing-heading">Turn {completedTurn} briefing</h2>
        <p className="mt-3 text-sm text-secondary" role="status">Preparing briefing…</p>
      </section>
    );
  }
  if (status === "failed") {
    return (
      <section aria-labelledby="ai-briefing-heading" aria-live="polite" className="rounded-3xl border border-line bg-tint p-5 sm:p-6">
        <p className="text-sm font-semibold text-secondary">AI briefing unavailable</p>
        <h2 className="mt-1 text-xl font-bold text-primary" id="ai-briefing-heading">Turn {completedTurn} remains authoritative</h2>
        <p className="mt-3 text-sm leading-6 text-secondary">The engine result is complete. You can continue playing without a briefing.</p>
      </section>
    );
  }
  if (briefing === null) {
    return (
      <section aria-labelledby="ai-briefing-heading" className="rounded-3xl border border-briefing/15 bg-briefing/5 p-5 sm:p-6">
        <p className="text-sm font-semibold text-briefing">AI strategic briefing</p>
        <h2 className="mt-1 text-xl font-bold text-primary" id="ai-briefing-heading">Narrative explanation</h2>
        <p className="mt-3 text-sm leading-6 text-secondary">
          {restored
            ? "Past turns were restored from the authoritative replay. No AI requests were made during resume; a new briefing will follow your next decision."
            : "A briefing will appear after an accepted decision."}
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="ai-briefing-heading" className="rounded-3xl border border-briefing/20 bg-briefing/5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-briefing">AI strategic briefing</p>
          <h2 className="mt-1 text-xl font-bold text-primary" id="ai-briefing-heading">{briefing.headline}</h2>
        </div>
        <span className="rounded-full border border-line bg-tint px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
          {briefing.source === "live" ? "Live AI" : "Deterministic fallback"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-secondary">{briefing.situation_summary}</p>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-secondary">Consequence explanation</dt>
          <dd className="mt-1 text-sm leading-6 text-secondary">{briefing.consequence_explanation}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-secondary">Strategic insight</dt>
          <dd className="mt-1 text-sm leading-6 text-secondary">{briefing.strategic_insight}</dd>
        </div>
      </dl>
      <div className="mt-4 rounded-2xl border border-line bg-inset p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-secondary">Next-turn teaser</p>
        <p className="mt-1 text-sm leading-6 text-secondary">{briefing.next_turn_teaser}</p>
      </div>
      <p className="mt-3 text-xs text-secondary">Narrative context only; event and metric records remain authoritative.</p>
    </section>
  );
}

function StatusBadge({ status }: { status: GameState["status"] }) {
  const style = status === "won"
    ? "bg-success/10 text-success"
    : status === "lost"
      ? "bg-danger/10 text-danger"
      : "bg-accent/10 text-accent";
  return (
    <span aria-label={`Game status: ${humanize(status)}`} aria-live="polite" className={`w-fit rounded-full px-3 py-2 text-xs font-bold uppercase tracking-wider ${style}`} role="status">
      {humanize(status)}
    </span>
  );
}

function sessionFromStart(response: GameStartResponse): GameSession {
  return {
    scenario: response.scenario,
    scenarioId: response.scenario_id,
    scenarioVersion: response.scenario_version,
    seed: response.seed,
    initialMetricValues: { ...response.state.metric_values },
    state: response.state,
    availableActions: response.available_actions,
    actionHistory: [],
    lastResult: null,
  };
}

function sessionFromTurn(
  scenario: ScenarioDisplayMetadata,
  initialMetricValues: Record<string, number>,
  response: GameTurnResponse,
): GameSession {
  return {
    scenario,
    scenarioId: response.scenario_id,
    scenarioVersion: response.scenario_version,
    seed: response.seed,
    initialMetricValues: { ...initialMetricValues },
    state: response.state,
    availableActions: response.available_actions,
    actionHistory: response.action_history,
    lastResult: response.turn_result,
  };
}

function saveFromSession(session: GameSession): SavedRun {
  return {
    format_version: SAVE_FORMAT_VERSION,
    scenario_id: session.scenarioId,
    scenario_version: session.scenarioVersion,
    seed: session.seed,
    action_history: [...session.actionHistory],
  };
}

function assertStartMatchesDefinition(
  response: GameStartResponse,
  definition: ScenarioDefinition,
) {
  if (
    response.scenario_id !== definition.scenario_id ||
    response.scenario_version !== definition.version
  ) {
    throw new Error("The scenario version changed. Return to the library and load the current definition.");
  }
}

function sameStrings(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function isTerminal(state: GameState): boolean {
  return state.status === "won" || state.status === "lost";
}

function humanize(value: string): string {
  return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "scenario_not_available") {
      return "This scenario is not available for play yet.";
    }
    if (error.code === "scenario_version_mismatch") {
      return "The saved scenario version is no longer available. Your existing save remains unchanged.";
    }
    return error.message;
  }
  if (error instanceof TypeError) {
    return "Could not reach the ScenarioLab API. Check the connection and retry.";
  }
  if (error instanceof Error && error.message.includes("response did not match the expected contract")) {
    return "The API returned unexpected simulation data. Retry before continuing.";
  }
  return error instanceof Error
    ? error.message
    : "The API returned unexpected simulation data. Retry before continuing.";
}
