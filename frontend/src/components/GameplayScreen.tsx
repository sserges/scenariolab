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
        className="mb-7 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-slate-300 transition-colors hover:text-white focus-visible:outline-offset-4"
        onClick={onBack}
        type="button"
      >
        <span aria-hidden="true">←</span> Scenario library
      </button>

      <header className="rounded-3xl border border-teal-300/20 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900/60 p-6 shadow-2xl shadow-black/20 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Playable simulation</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl" id="gameplay-title">
          {scenarioTitle}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">{objective}</p>
        {session !== null && (
          <dl className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-slate-300">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
              <dt className="sr-only">Replay seed</dt><dd>Seed {session.seed}</dd>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
              <dt className="sr-only">Scenario version</dt><dd>Version {session.scenarioVersion}</dd>
            </div>
          </dl>
        )}
      </header>

      {persistenceStatus === "unavailable" && session !== null && (
        <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100" role="status">
          Local storage is unavailable. Gameplay is still active, but progress could not be saved on this device.
        </p>
      )}
      {persistenceStatus === "saved" && session !== null && (
        <p className="sr-only" role="status" aria-live="polite">Progress saved on this device.</p>
      )}

      {errorMessage !== null && (
        <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/5 p-5" role="alert">
          <p className="font-bold text-rose-100">{failedOperation === "resume" ? "Saved game could not resume" : "Simulation request failed"}</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">{errorMessage}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="min-h-10 rounded-xl border border-rose-200/30 px-4 py-2 text-sm font-bold text-rose-100 hover:bg-rose-200/10 disabled:cursor-wait disabled:opacity-60"
              disabled={isPending}
              onClick={retryLastRequest}
              type="button"
            >
              {isPending ? "Retrying…" : "Try Again"}
            </button>
            {failedOperation === "resume" && (
              <button
                className="min-h-10 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
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
        <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.025] p-7 text-center sm:p-12">
          {pendingOperation === "resume" ? (
            <div aria-live="polite" className="mx-auto max-w-xl" role="status">
              <h2 className="text-2xl font-bold text-white">Resuming saved simulation</h2>
              <p className="mt-3 leading-7 text-slate-300">
                The backend is replaying the saved decisions from the original seed. Past turns will not request AI briefings.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white">Ready for a new run?</h2>
              <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-300">
                Start a new deterministic run. The server will provide the initial state and allowed decisions.
                A successful start replaces this device’s prior save.
              </p>
              <button
                className="mt-7 min-h-12 rounded-xl bg-teal-300 px-6 py-3 font-bold text-slate-950 transition-colors hover:bg-teal-200 disabled:cursor-wait disabled:opacity-60"
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
      <section aria-labelledby="turn-progress-heading" className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Simulation progress</p>
            <h2 aria-live="polite" className="mt-1 text-xl font-bold text-white" id="turn-progress-heading">
              {capitalize(session.scenario.turn.unit)} {session.state.current_turn} of {session.state.max_turns}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {completedTurns} {completedTurns === 1 ? "decision" : "decisions"} completed
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:max-w-xs">
            <label className="text-xs font-semibold text-slate-300" htmlFor="turn-progress">
              {completedTurns} of {session.state.max_turns} turns complete
            </label>
            <progress
              aria-label="Simulation progress"
              className="h-3 w-full accent-teal-300"
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
            <p className="text-sm font-semibold text-teal-200">Authoritative state</p>
            <h2 className="mt-1 text-2xl font-bold text-white" id="metrics-heading">Key metrics</h2>
          </div>
          <span className="text-xs text-slate-400">Values and changes from the Python engine</span>
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
          className="rounded-3xl border border-teal-300/15 bg-slate-900/70 p-5 sm:p-7"
        >
          <p className="text-sm font-semibold text-teal-200">Your move</p>
          <h2 className="mt-1 text-2xl font-bold text-white" id="decisions-heading">Available decisions</h2>
          <fieldset className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <legend className="sr-only">Choose one available decision</legend>
            {session.availableActions.map((action) => {
              const selected = action.action_id === selectedActionId;
              return (
                <label
                  className={`group min-h-32 cursor-pointer rounded-2xl border p-5 transition-colors focus-within:ring-2 focus-within:ring-teal-300 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 ${selected ? "border-teal-300 bg-teal-300/10" : "border-white/10 bg-slate-950/40 hover:border-white/25"}`}
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
                  <span className="flex items-center gap-3 font-bold text-white">
                    <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-teal-300 bg-teal-300 text-slate-950" : "border-slate-500 text-transparent"}`}>✓</span>
                    {action.title}
                  </span>
                  <span className="mt-3 block text-sm leading-6 text-slate-300">{action.description}</span>
                </label>
              );
            })}
          </fieldset>
          <button
            className="mt-5 min-h-12 rounded-xl bg-teal-300 px-6 py-3 font-bold text-slate-950 transition-colors hover:bg-teal-200 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedActionId === null || isPending}
            onClick={onSubmit}
            type="button"
          >
            {isPending ? "Resolving Decision…" : "Confirm Decision"}
          </button>
          {persistenceStatus === "saved" && (
            <span className="ml-4 text-xs text-slate-400">Saved automatically on this device</span>
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
    ? "text-emerald-200"
    : favorability === "unfavorable"
      ? "text-rose-200"
      : "text-slate-300";
  return (
    <article
      aria-label={`${metric.title}: ${formatMetricValue(metric, value)}`}
      className="min-w-0 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-900/60 p-5"
      data-change={delta > 0 ? "positive" : delta < 0 ? "negative" : "unchanged"}
      data-metric-id={metric.metric_id}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-slate-300">{metric.title}</p>
      <p className="mt-3 break-words text-2xl font-black tracking-tight text-white sm:text-3xl">
        {formatMetricValue(metric, value)}
      </p>
      <p className={`mt-2 text-xs font-semibold ${showChange ? tone : "text-slate-400"}`}>
        {!showChange
          ? "Initial value"
          : delta === 0
            ? "No change this turn"
            : `${delta > 0 ? "Increase" : "Decrease"} ${formatMetricDelta(metric, delta)}${favorability === "favorable" ? " · favorable" : favorability === "unfavorable" ? " · unfavorable" : ""}`}
      </p>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">{metric.description}</p>
    </article>
  );
}

function TurnSummary({ result, turnUnit }: { result: TurnResult; turnUnit: string }) {
  return (
    <section aria-labelledby="turn-summary-heading" className="rounded-3xl border border-blue-300/15 bg-blue-300/5 p-5 sm:p-6">
      <p className="text-sm font-semibold text-blue-200">Latest authoritative result</p>
      <h2 className="mt-1 text-xl font-bold text-white" id="turn-summary-heading">
        {capitalize(turnUnit)} {result.completed_turn_index} resolved
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Selected decision</dt>
          <dd className="mt-1 font-semibold text-slate-100">{result.selected_action.title}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Resulting status</dt>
          <dd className="mt-1 font-semibold text-slate-100">{humanize(result.resulting_status)}</dd>
        </div>
      </dl>
      {result.triggered_event !== null ? (
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-100">Simulation event</p>
          <h3 className="mt-1 font-bold text-white">{result.triggered_event.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-200">{result.triggered_event.description}</p>
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-300">No event triggered this turn.</p>
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
      <section aria-labelledby="ai-briefing-heading" aria-live="polite" className="rounded-3xl border border-violet-300/20 bg-violet-300/[0.06] p-5 sm:p-6">
        <p className="text-sm font-semibold text-violet-200">AI strategic briefing</p>
        <h2 className="mt-1 text-xl font-bold text-white" id="ai-briefing-heading">Turn {completedTurn} briefing</h2>
        <p className="mt-3 text-sm text-slate-200" role="status">Preparing briefing…</p>
      </section>
    );
  }
  if (status === "failed") {
    return (
      <section aria-labelledby="ai-briefing-heading" aria-live="polite" className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
        <p className="text-sm font-semibold text-slate-200">AI briefing unavailable</p>
        <h2 className="mt-1 text-xl font-bold text-white" id="ai-briefing-heading">Turn {completedTurn} remains authoritative</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">The engine result is complete. You can continue playing without a briefing.</p>
      </section>
    );
  }
  if (briefing === null) {
    return (
      <section aria-labelledby="ai-briefing-heading" className="rounded-3xl border border-violet-300/15 bg-violet-300/[0.04] p-5 sm:p-6">
        <p className="text-sm font-semibold text-violet-200">AI strategic briefing</p>
        <h2 className="mt-1 text-xl font-bold text-white" id="ai-briefing-heading">Narrative explanation</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {restored
            ? "Past turns were restored from the authoritative replay. No AI requests were made during resume; a new briefing will follow your next decision."
            : "A briefing will appear after an accepted decision."}
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="ai-briefing-heading" className="rounded-3xl border border-violet-300/20 bg-violet-300/[0.06] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-200">AI strategic briefing</p>
          <h2 className="mt-1 text-xl font-bold text-white" id="ai-briefing-heading">{briefing.headline}</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-100">
          {briefing.source === "live" ? "Live AI" : "Deterministic fallback"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-200">{briefing.situation_summary}</p>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-300">Consequence explanation</dt>
          <dd className="mt-1 text-sm leading-6 text-slate-200">{briefing.consequence_explanation}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-slate-300">Strategic insight</dt>
          <dd className="mt-1 text-sm leading-6 text-slate-200">{briefing.strategic_insight}</dd>
        </div>
      </dl>
      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Next-turn teaser</p>
        <p className="mt-1 text-sm leading-6 text-slate-200">{briefing.next_turn_teaser}</p>
      </div>
      <p className="mt-3 text-xs text-slate-400">Narrative context only; event and metric records remain authoritative.</p>
    </section>
  );
}

function StatusBadge({ status }: { status: GameState["status"] }) {
  const style = status === "won"
    ? "bg-emerald-300/10 text-emerald-100"
    : status === "lost"
      ? "bg-rose-300/10 text-rose-100"
      : "bg-blue-300/10 text-blue-100";
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
