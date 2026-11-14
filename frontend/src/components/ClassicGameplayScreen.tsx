import { useEffect, useRef, useState } from "react";

import {
  ApiError,
  getAIBriefing,
  hasAIFeature,
  playTurn,
  startGame,
  type AIBriefingResponse,
  type GameStartResponse,
  type GameState,
  type GameTurnResponse,
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
import type { SaveReadResult, SavedScriptedRun, SaveWriteResult } from "../lib/savedRun";
import { turnLabel } from "../lib/turns";
import { DecisionHistory } from "./DecisionHistory";
import { EndGameReport } from "./EndGameReport";
import { MetricCharts } from "./MetricCharts";
import { MetricRail } from "./MetricRail";

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
  resumeSave?: SavedScriptedRun | null;
  existingSavedProgress?: boolean;
  onSaveStateChange?: (state: SaveReadResult) => void;
  onSwitchMode?: () => void;
  onBack: () => void;
}

type PendingOperation = "start" | "resume" | "turn" | null;
type FailedOperation = Exclude<PendingOperation, null>;
type BriefingStatus = "idle" | "loading" | "ready" | "failed";

export function ClassicGameplayScreen({
  catalogEntry,
  scenarioDefinition,
  resumeSave = null,
  existingSavedProgress = false,
  onSaveStateChange,
  onSwitchMode,
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
    if (
      (session !== null || (existingSavedProgress && resumeSave === null)) &&
      !window.confirm("Start a new Classic Simulation? This will replace the saved progress on this device.")
    ) {
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

  function persistRun(save: SavedScriptedRun) {
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
  const liveBriefings = hasAIFeature(catalogEntry, "live-briefings");

  return (
    <section aria-labelledby="gameplay-title" className="pb-12" data-scenario-category={catalogEntry.category}>
      <button
        className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-secondary transition-colors hover:text-primary focus-visible:outline-offset-4"
        onClick={onBack}
        type="button"
      >
        <span aria-hidden="true">←</span> Scenario library
      </button>

      {session === null && resumeSave === null && onSwitchMode !== undefined && (
        <button
          className="mb-4 ml-4 min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-secondary transition-colors hover:bg-tint hover:text-primary focus-visible:outline-offset-4"
          onClick={onSwitchMode}
          type="button"
        >
          Choose gameplay mode
        </button>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{humanize(catalogEntry.category)} scenario</p>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-primary sm:text-4xl" id="gameplay-title">
            {scenarioTitle}
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-secondary sm:text-base">{objective}</p>
        </div>
        {session !== null && (
          <dl className="flex flex-wrap gap-2 text-xs font-semibold text-secondary">
            <div className="rounded-full border border-line bg-tint px-3 py-1.5">Classic Simulation</div>
            <div className="rounded-full border border-line bg-tint px-3 py-1.5">
              <dt className="sr-only">Replay seed</dt><dd>Seed {session.seed}</dd>
            </div>
            <div className="rounded-full border border-line bg-tint px-3 py-1.5">
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
                The backend is replaying the saved decisions from the original seed.{" "}
                {liveBriefings ? "Past turns will not request AI briefings." : "Past turns will not request new briefings."}
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
          liveBriefings={liveBriefings}
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
  liveBriefings: boolean;
  persistenceStatus: SaveWriteResult | "idle";
  onSelectAction: (actionId: string) => void;
  onSubmit: () => void;
  onRestart: () => void;
}

type BoardView = "decide" | "trends";

function GameBoard({
  session,
  definition,
  briefing,
  briefingsByTurn,
  briefingStatus,
  selectedActionId,
  isPending,
  liveBriefings,
  persistenceStatus,
  onSelectAction,
  onSubmit,
  onRestart,
}: GameBoardProps) {
  const [view, setView] = useState<BoardView>("decide");
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
  const unit = session.scenario.turn.unit;
  const unitPlural = unit === "month" ? "turns" : `${unit}s`;
  const metricsById = new Map(session.scenario.metrics.map((metric) => [metric.metric_id, metric]));
  const selectedAction = session.availableActions.find((action) => action.action_id === selectedActionId);

  return (
    <div className="mt-6 flex flex-wrap items-start gap-5">
      <aside
        aria-label="Simulation status"
        className="flex min-w-0 shrink grow basis-[300px] flex-col gap-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:max-w-[340px] xl:overflow-y-auto"
      >
        <section aria-labelledby="turn-progress-heading" className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-secondary">Simulation progress</p>
              <h2 aria-live="polite" className="metric-number mt-1 text-xl font-bold tabular-nums text-primary" id="turn-progress-heading">
                {turnLabel(unit)} {session.state.current_turn} of {session.state.max_turns}
              </h2>
            </div>
            <StatusBadge status={session.state.status} />
          </div>
          <div aria-hidden="true" className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${session.state.max_turns}, minmax(0, 1fr))` }}>
            {Array.from({ length: session.state.max_turns }, (_, index) => (
              <span
                className={`h-2 rounded-sm ${
                  index < completedTurns
                    ? "bg-accent"
                    : index === completedTurns && !terminal
                      ? "bg-accent/20 ring-1 ring-inset ring-accent"
                      : "bg-inset"
                }`}
                key={index}
              />
            ))}
          </div>
          <label className="sr-only" htmlFor="turn-progress">
            {completedTurns} of {session.state.max_turns} {unitPlural} complete
          </label>
          <progress className="sr-only" id="turn-progress" max={session.state.max_turns} value={completedTurns} />
          <p className="mt-2 text-xs text-secondary">
            {completedTurns} {completedTurns === 1 ? "decision" : "decisions"} completed
          </p>
        </section>
        <MetricRail
          changes={latestChanges}
          metrics={session.scenario.metrics}
          series={metricSeries}
          showChange={session.lastResult !== null}
          turnUnit={unit}
          values={session.state.metric_values}
        />
      </aside>

      <div className="flex min-w-0 shrink grow-[999] basis-[520px] flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div aria-label="Simulation views" className="flex gap-1 rounded-xl bg-inset p-1" role="tablist">
            <ViewTab active={view === "decide"} label={terminal ? "Report" : "Decide"} onSelect={() => setView("decide")} />
            <ViewTab active={view === "trends"} label="Trends" onSelect={() => setView("trends")} />
          </div>
          <span className="text-xs text-secondary">Values and outcomes come from the simulation engine</span>
        </div>

        {view === "trends" ? (
          <MetricCharts series={metricSeries} />
        ) : (
          <>
            {session.lastResult !== null ? (
              <section
                aria-label="Latest turn explanation"
                className="console-enter rounded-2xl border border-accent/40 bg-surface p-5"
              >
                <div className="grid gap-5 xl:grid-cols-2">
                  <TurnSummary metricsById={metricsById} result={session.lastResult} turnUnit={unit} />
                  <AIBriefingPanel
                    briefing={briefing}
                    completedTurn={session.lastResult.completed_turn_index}
                    liveBriefings={liveBriefings}
                    restored={briefing === null && briefingStatus === "idle"}
                    status={briefingStatus}
                    turnUnit={unit}
                  />
                </div>
              </section>
            ) : (
              <section aria-labelledby="situation-heading" className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">{turnLabel(unit)} 1 · Scenario briefing</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-primary" id="situation-heading">Your first decision</h2>
                <p className="mt-2 max-w-[68ch] text-sm leading-6 text-secondary">{definition.description}</p>
              </section>
            )}

            {!terminal && (
              <section aria-labelledby="decisions-heading" className="flex flex-col gap-3">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-secondary" id="decisions-heading">
                  Available decisions
                </h2>
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="sr-only">Choose one available decision</legend>
                  {session.availableActions.map((action) => (
                    <DecisionCard
                      action={action}
                      disabled={isPending}
                      key={action.action_id}
                      metricsById={metricsById}
                      onSelect={onSelectAction}
                      selected={action.action_id === selectedActionId}
                    />
                  ))}
                </fieldset>
                <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3 pl-4 shadow-xl shadow-black/10">
                  <p className="min-w-0 text-sm text-secondary">
                    {selectedAction === undefined ? "Select a decision to continue" : (
                      <>Selected: <span className="font-semibold text-primary">{selectedAction.title}</span></>
                    )}
                    {persistenceStatus === "saved" && (
                      <span className="mt-0.5 block text-xs">Saved automatically on this device</span>
                    )}
                  </p>
                  <button
                    className="min-h-11 rounded-xl bg-accent px-6 font-bold text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={selectedActionId === null || isPending}
                    onClick={onSubmit}
                    type="button"
                  >
                    {isPending ? "Resolving Decision…" : "Confirm Decision"}
                  </button>
                </div>
              </section>
            )}

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
          </>
        )}
      </div>

      <aside
        aria-label="Decision log"
        className="flex min-w-0 shrink grow basis-[270px] flex-col xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:max-w-[320px] xl:overflow-y-auto"
      >
        <DecisionHistory
          briefingsByTurn={briefingsByTurn}
          definition={definition}
          liveBriefings={liveBriefings}
          records={session.state.decision_history}
          turnUnit={unit}
        />
      </aside>
    </div>
  );
}

function ViewTab({ active, label, onSelect }: { active: boolean; label: string; onSelect: () => void }) {
  return (
    <button
      aria-selected={active}
      className={`min-h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${active ? "bg-surface text-primary shadow-sm" : "text-secondary hover:text-primary"}`}
      onClick={onSelect}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}

function DecisionCard({
  action,
  disabled,
  metricsById,
  onSelect,
  selected,
}: {
  action: ScenarioAction;
  disabled: boolean;
  metricsById: Map<string, MetricDefinition>;
  onSelect: (actionId: string) => void;
  selected: boolean;
}) {
  const chips = (action.effects ?? []).flatMap((effect) => {
    const metric = metricsById.get(effect.metric_id);
    if (metric === undefined) return [];
    if (effect.operator === "add" || effect.operator === "subtract") {
      const delta = effect.operator === "add" ? effect.value : -effect.value;
      const favorability = getFavorability(metric, delta);
      return [{
        key: `${effect.metric_id}-${effect.operator}`,
        text: `${metric.title} ${formatMetricDelta(metric, delta)}`,
        tone: favorability === "favorable" ? "text-success" : favorability === "unfavorable" ? "text-danger" : "text-secondary",
      }];
    }
    return [{ key: `${effect.metric_id}-${effect.operator}`, text: effect.description, tone: "text-secondary" }];
  });
  return (
    <label
      className={`group flex min-h-32 cursor-pointer flex-col gap-2.5 rounded-2xl border-[1.5px] p-4 transition-colors focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-canvas ${selected ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-accent/50"}`}
    >
      <input
        checked={selected}
        className="sr-only"
        disabled={disabled}
        name="decision"
        onChange={() => onSelect(action.action_id)}
        type="radio"
        value={action.action_id}
      />
      <span className="flex items-start gap-3 font-bold leading-snug text-primary">
        <span aria-hidden="true" className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-accent" : "border-muted"}`}>
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
        </span>
        {action.title}
      </span>
      <span className="block text-sm leading-6 text-secondary">{action.description}</span>
      {chips.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span className={`metric-number rounded-md bg-inset px-2 py-0.5 text-xs font-semibold tabular-nums ${chip.tone}`} key={chip.key}>
              {chip.text}
            </span>
          ))}
        </span>
      )}
    </label>
  );
}

function TurnSummary({
  metricsById,
  result,
  turnUnit,
}: {
  metricsById: Map<string, MetricDefinition>;
  result: TurnResult;
  turnUnit: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">Latest authoritative result</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-primary" id="turn-summary-heading">
        {turnLabel(turnUnit)} {result.completed_turn_index} resolved
      </h2>
      <p className="mt-1 text-sm text-secondary">
        <span className="sr-only">Selected decision: </span>
        <span className="font-semibold text-primary">{result.selected_action.title}</span>
        <span> · {humanize(result.resulting_status)}</span>
      </p>
      {result.triggered_event !== null ? (
        <div className="mt-3 rounded-xl bg-warning/10 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-warning">Simulation event</p>
          <h3 className="mt-0.5 font-bold text-primary">{result.triggered_event.title}</h3>
          <p className="mt-1 text-sm leading-6 text-secondary">{result.triggered_event.description}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-secondary">No event triggered this turn.</p>
      )}
      {result.metric_changes.length > 0 && (
        <ul aria-label="Metric changes this turn" className="mt-3">
          {result.metric_changes.map((change) => {
            const metric = metricsById.get(change.metric_id);
            if (metric === undefined) return null;
            const favorability = getFavorability(metric, change.delta);
            const tone = favorability === "favorable" ? "text-success" : favorability === "unfavorable" ? "text-danger" : "text-secondary";
            return (
              <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-t border-line py-1.5 text-sm" key={change.metric_id}>
                <span className="font-semibold text-primary">{metric.title}</span>
                <span className={`metric-number text-right font-bold tabular-nums ${change.exhausted ? "text-danger" : tone}`}>
                  {change.exhausted ? "Exhausted" : formatMetricDelta(metric, change.delta)}
                </span>
                <span className="metric-number col-span-2 text-xs tabular-nums text-secondary">
                  {`${formatMetricValue(metric, change.previous_value)} → ${formatMetricValue(metric, change.new_value)}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AIBriefingPanel({
  briefing,
  completedTurn,
  liveBriefings,
  restored,
  status,
  turnUnit,
}: {
  briefing: AIBriefingResponse | null;
  completedTurn: number;
  liveBriefings: boolean;
  restored: boolean;
  status: BriefingStatus;
  turnUnit: string;
}) {
  // Scenarios without a live-briefing opt-in only ever receive authored fallback
  // text from the backend, so they are never labeled as AI-generated.
  const eyebrow = liveBriefings ? "AI strategic briefing" : "Strategic briefing";
  const turnName = liveBriefings ? "Turn" : turnLabel(turnUnit);
  if (status === "loading") {
    return (
      <section aria-labelledby="ai-briefing-heading" aria-live="polite" className="rounded-3xl border border-briefing/20 bg-briefing/5 p-5 sm:p-6">
        <p className="text-sm font-semibold text-briefing">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-primary" id="ai-briefing-heading">{turnName} {completedTurn} briefing</h2>
        <p className="mt-3 text-sm text-secondary" role="status">Preparing briefing…</p>
      </section>
    );
  }
  if (status === "failed") {
    return (
      <section aria-labelledby="ai-briefing-heading" aria-live="polite" className="rounded-3xl border border-line bg-tint p-5 sm:p-6">
        <p className="text-sm font-semibold text-secondary">{liveBriefings ? "AI briefing unavailable" : "Briefing unavailable"}</p>
        <h2 className="mt-1 text-xl font-bold text-primary" id="ai-briefing-heading">{turnName} {completedTurn} remains authoritative</h2>
        <p className="mt-3 text-sm leading-6 text-secondary">The engine result is complete. You can continue playing without a briefing.</p>
      </section>
    );
  }
  if (briefing === null) {
    return (
      <section aria-labelledby="ai-briefing-heading" className="rounded-3xl border border-briefing/15 bg-briefing/5 p-5 sm:p-6">
        <p className="text-sm font-semibold text-briefing">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-primary" id="ai-briefing-heading">Narrative explanation</h2>
        <p className="mt-3 text-sm leading-6 text-secondary">
          {restored
            ? liveBriefings
              ? "Past turns were restored from the authoritative replay. No AI requests were made during resume; a new briefing will follow your next decision."
              : "Past turns were restored from the authoritative replay. A new authored briefing will follow your next decision."
            : "A briefing will appear after an accepted decision."}
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="ai-briefing-heading" className="rounded-3xl border border-briefing/20 bg-briefing/5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-briefing">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-bold text-primary" id="ai-briefing-heading">{briefing.headline}</h2>
        </div>
        <span className="rounded-full border border-line bg-tint px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
          {!liveBriefings ? "Authored briefing" : briefing.source === "live" ? "Live AI" : "Deterministic fallback"}
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
        <p className="text-xs font-bold uppercase tracking-wider text-secondary">{liveBriefings ? "Next-turn teaser" : `Next ${turnUnit} outlook`}</p>
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

function saveFromSession(session: GameSession): SavedScriptedRun {
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
