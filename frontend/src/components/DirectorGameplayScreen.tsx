import { useEffect, useRef, useState } from "react";

import {
  ApiError,
  getDirectorProposal,
  playDirectorTurn,
  replayDirectorRun,
  startGame,
  type DirectorProposalResponse,
  type DirectorReplayHistory,
  type DirectorTurnRecord,
  type GameState,
  type ScenarioCatalogEntry,
  type ScenarioDefinition,
  type ScenarioDisplayMetadata,
  type TurnResult,
} from "../lib/api";
import { buildMetricSeries } from "../lib/metrics";
import {
  DIRECTOR_SAVE_FORMAT_VERSION,
  isSavedDirectorRun,
  writeSavedRun,
} from "../lib/savedRun";
import type { SaveReadResult, SavedDirectorRun, SaveWriteResult } from "../lib/savedRun";
import { EndGameReport } from "./EndGameReport";
import { MetricCharts } from "./MetricCharts";
import { MetricRail } from "./MetricRail";
import {
  DirectorChoiceList,
  DirectorHistory,
  DirectorLatestResult,
  DirectorSituationCard,
} from "./DirectorComponents";

interface DirectorSession {
  scenario: ScenarioDisplayMetadata;
  scenarioId: string;
  scenarioVersion: string;
  seed: number;
  initialMetricValues: Record<string, number>;
  state: GameState;
  turnRecords: DirectorTurnRecord[];
  proposal: DirectorProposalResponse | null;
  selectedChoiceId: string | null;
  lastResult: TurnResult | null;
}

type PendingOperation = "start" | "resume" | "proposal" | "turn" | null;
type FailedOperation = Exclude<PendingOperation, null>;

interface DirectorGameplayScreenProps {
  catalogEntry: ScenarioCatalogEntry;
  scenarioDefinition: ScenarioDefinition;
  resumeSave: SavedDirectorRun | null;
  existingSavedProgress: boolean;
  onSaveStateChange?: (state: SaveReadResult) => void;
  onSwitchMode: () => void;
  onBack: () => void;
}

const DIRECTOR_PROFILE_ID = "startup-survival-director";
const DIRECTOR_PROFILE_VERSION = "1.0.0";

export function DirectorGameplayScreen({
  catalogEntry,
  scenarioDefinition,
  resumeSave,
  existingSavedProgress,
  onSaveStateChange,
  onSwitchMode,
  onBack,
}: DirectorGameplayScreenProps) {
  const [session, setSession] = useState<DirectorSession | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedOperation, setFailedOperation] = useState<FailedOperation>("start");
  const [persistenceStatus, setPersistenceStatus] = useState<SaveWriteResult | "idle">("idle");
  const [directorUnavailable, setDirectorUnavailable] = useState(false);
  const [view, setView] = useState<"decide" | "trends">("decide");
  const requestInFlight = useRef(false);
  const resumeStarted = useRef(false);
  const requestGeneration = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (resumeSave !== null && !resumeStarted.current) {
      resumeStarted.current = true;
      void restoreSavedSimulation();
    }
  }, [resumeSave]);

  const isPending = pendingOperation !== null;
  const scenarioTitle = session?.scenario.title ?? scenarioDefinition.title ?? catalogEntry.title;
  const objective = session?.scenario.objective ?? scenarioDefinition.metadata.objective ?? catalogEntry.objective;

  async function startDirectorSimulation() {
    if (requestInFlight.current) return;
    if (
      (session !== null || (existingSavedProgress && resumeSave === null)) &&
      !window.confirm("Start a new AI Scenario Director run? This will replace the saved progress on this device.")
    ) return;

    requestInFlight.current = true;
    const version = nextRequestVersion();
    setPendingOperation("start");
    setErrorMessage(null);
    setDirectorUnavailable(false);
    try {
      const signal = getController().signal;
      const started = await startGame(catalogEntry.scenario_id, undefined, signal);
      assertStartMatchesDefinition(started.scenario_id, started.scenario_version, started.seed, scenarioDefinition);
      const history = emptyDirectorHistory(started.scenario_id, started.scenario_version, started.seed);
      const proposal = await fetchProposal(history, started.state, version, signal);
      if (!isCurrentRequest(version)) return;
      const fresh: DirectorSession = {
        scenario: started.scenario,
        scenarioId: started.scenario_id,
        scenarioVersion: started.scenario_version,
        seed: started.seed,
        initialMetricValues: { ...started.state.metric_values },
        state: started.state,
        turnRecords: [],
        proposal,
        selectedChoiceId: null,
        lastResult: null,
      };
      setSession(fresh);
      setFailedOperation("proposal");
      persistRun(makeSave(fresh));
    } catch (error) {
      if (!isCurrentRequest(version)) return;
      setFailedOperation("start");
      setDirectorUnavailable(isDirectorUnavailableError(error));
      setErrorMessage(describeDirectorError(error, false));
    } finally {
      if (isCurrentRequest(version)) {
        requestInFlight.current = false;
        setPendingOperation(null);
      }
    }
  }

  async function restoreSavedSimulation() {
    if (requestInFlight.current || resumeSave === null) return;
    requestInFlight.current = true;
    const version = nextRequestVersion();
    setPendingOperation("resume");
    setErrorMessage(null);
    setFailedOperation("resume");
    try {
      if (
        !isSavedDirectorRun(resumeSave) ||
        resumeSave.scenario_id !== scenarioDefinition.scenario_id ||
        resumeSave.scenario_version !== scenarioDefinition.version ||
        resumeSave.profile_id !== DIRECTOR_PROFILE_ID ||
        resumeSave.profile_version !== DIRECTOR_PROFILE_VERSION
      ) {
        throw new Error("The saved Director run is incompatible with the available scenario or profile. The save has not been changed.");
      }
      const signal = getController().signal;
      const started = await startGame(resumeSave.scenario_id, resumeSave.seed, signal);
      assertStartMatchesDefinition(started.scenario_id, started.scenario_version, started.seed, scenarioDefinition);
      if (started.seed !== resumeSave.seed) throw new Error("The backend returned a different replay seed.");
      const replay = await replayDirectorRun(resumeSave, signal);
      if (!isCurrentRequest(version)) return;
      assertReplayMatchesSave(replay, resumeSave, started.state);
      const restoredProposal = replay.pending_proposal == null
        ? null
        : {
            scenario_id: replay.scenario_id,
            scenario_version: replay.scenario_version,
            seed: replay.seed,
            state: replay.state,
            proposal: replay.pending_proposal,
            previews: replay.pending_previews ?? [],
          };
      const restored: DirectorSession = {
        scenario: started.scenario,
        scenarioId: replay.scenario_id,
        scenarioVersion: replay.scenario_version,
        seed: replay.seed,
        initialMetricValues: { ...started.state.metric_values },
        state: replay.state,
        turnRecords: [...resumeSave.turn_records],
        proposal: restoredProposal,
        selectedChoiceId: null,
        lastResult: replay.latest_turn_result,
      };
      setSession(restored);
      setPersistenceStatus("saved");
      onSaveStateChange?.({ status: "valid", save: resumeSave });
      setErrorMessage(null);
      if (!isTerminal(replay.state) && restoredProposal === null) {
        await loadProposal(restored, version, true);
      }
    } catch (error) {
      if (!isCurrentRequest(version)) return;
      setFailedOperation("resume");
      setDirectorUnavailable(isDirectorUnavailableError(error));
      setErrorMessage(describeDirectorError(error, true));
    } finally {
      if (isCurrentRequest(version)) {
        requestInFlight.current = false;
        setPendingOperation(null);
      }
    }
  }

  async function loadProposal(forSession: DirectorSession, version?: number, keepRestoredState = false) {
    const requestVersion = version ?? nextRequestVersion();
    if (!keepRestoredState) {
      requestInFlight.current = true;
      setPendingOperation("proposal");
    }
    setErrorMessage(null);
    try {
      const proposal = await fetchProposal(makeHistory(forSession), forSession.state, requestVersion, controller.current?.signal);
      if (!isCurrentRequest(requestVersion)) return;
      if (forSession.state.current_turn !== proposal.state.current_turn || !sameState(forSession.state, proposal.state)) return;
      const updated: DirectorSession = { ...forSession, proposal, selectedChoiceId: null };
      setSession((current) => current === null || !sameState(current.state, proposal.state) ? current : updated);
      persistRun(makeSave(updated));
      setFailedOperation("proposal");
      setDirectorUnavailable(false);
    } catch (error) {
      if (!isCurrentRequest(requestVersion)) return;
      setFailedOperation("proposal");
      setDirectorUnavailable(isDirectorUnavailableError(error));
      setErrorMessage(describeDirectorError(error, false));
    } finally {
      if (!keepRestoredState && isCurrentRequest(requestVersion)) {
        requestInFlight.current = false;
        setPendingOperation(null);
      }
    }
  }

  async function submitChoice() {
    if (
      requestInFlight.current || session === null || session.proposal === null ||
      session.selectedChoiceId === null || isTerminal(session.state)
    ) return;

    const current = session;
    if (current.proposal === null || current.selectedChoiceId === null) return;
    requestInFlight.current = true;
    const version = nextRequestVersion();
    const signedProposal = current.proposal.proposal;
    const selectedChoiceId = current.selectedChoiceId;
    setPendingOperation("turn");
    setErrorMessage(null);
    try {
      const response = await playDirectorTurn({
        ...makeHistory(current),
        proposal: signedProposal,
        selected_choice_id: selectedChoiceId,
      }, getController().signal);
      if (!isCurrentRequest(version)) return;
      assertTurnMatchesRequest(response, current, selectedChoiceId);
      const accepted: DirectorSession = {
        ...current,
        state: response.state,
        turnRecords: [...current.turnRecords, response.turn_record],
        proposal: null,
        selectedChoiceId: null,
        lastResult: response.turn_result,
      };
      setSession(accepted);
      setFailedOperation("proposal");
      persistRun(makeSave(accepted));
      if (!isTerminal(accepted.state)) {
        // A new proposal is requested only for the newly active, incomplete turn.
        await loadProposal(accepted, version, true);
      }
    } catch (error) {
      if (!isCurrentRequest(version)) return;
      setFailedOperation("proposal");
      setDirectorUnavailable(isDirectorUnavailableError(error));
      if (isStaleProposalError(error)) {
        setSession((currentSession) => currentSession === null ? null : {
          ...currentSession,
          proposal: null,
          selectedChoiceId: null,
        });
        setErrorMessage("This signed proposal is stale or invalid. Load a fresh situation before choosing again.");
      } else {
        setErrorMessage(describeDirectorError(error, false));
      }
    } finally {
      if (isCurrentRequest(version)) {
        requestInFlight.current = false;
        setPendingOperation(null);
      }
    }
  }

  function retryLastRequest() {
    if (failedOperation === "resume") {
      void restoreSavedSimulation();
    } else if (failedOperation === "proposal" && session !== null) {
      void loadProposal(session);
    } else {
      void startDirectorSimulation();
    }
  }

  function leaveToLibrary() {
    invalidatePendingRequests();
    onBack();
  }

  function leaveToModeSelection() {
    invalidatePendingRequests();
    onSwitchMode();
  }

  function invalidatePendingRequests() {
    requestGeneration.current += 1;
    controller.current?.abort();
    requestInFlight.current = false;
  }

  function persistRun(save: SavedDirectorRun) {
    const result = writeSavedRun(save);
    setPersistenceStatus(result);
    if (result === "saved") onSaveStateChange?.({ status: "valid", save });
    else if (result === "invalid") onSaveStateChange?.({ status: "invalid" });
    else onSaveStateChange?.({ status: "unavailable" });
  }

  const completedTurns = session?.turnRecords.length ?? 0;
  const metrics = session?.scenario.metrics ?? scenarioDefinition.metrics;
  const latestMetricChanges = new Map(session?.lastResult?.metric_changes.map((change) => [change.metric_id, change]) ?? []);
  const metricSeries = session === null
    ? []
    : buildMetricSeries(session.scenario.metrics, session.initialMetricValues, session.state.decision_history);
  const terminal = session !== null && isTerminal(session.state);
  const activeProposal = session?.proposal ?? null;

  return (
    <section aria-labelledby="director-gameplay-title" className="pb-12" data-scenario-category={catalogEntry.category}>
      <div className="mb-4 flex flex-wrap gap-3">
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-secondary transition-colors hover:text-primary focus-visible:outline-offset-4"
          onClick={leaveToLibrary}
          type="button"
        ><span aria-hidden="true">←</span> Scenario library</button>
        <button
          className="min-h-11 rounded-lg border border-line px-4 text-sm font-semibold text-secondary transition-colors hover:bg-tint hover:text-primary focus-visible:outline-offset-4"
          onClick={leaveToModeSelection}
          type="button"
        >Choose another mode</button>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">AI Scenario Director · live generation optional</p>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-primary sm:text-4xl" id="director-gameplay-title">{scenarioTitle}</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-secondary sm:text-base">{objective}</p>
        </div>
        {session !== null && <dl className="flex flex-wrap gap-2 text-xs font-semibold text-secondary">
          <div className="rounded-full border border-line bg-tint px-3 py-1.5">Director mode</div>
          <div className="rounded-full border border-line bg-tint px-3 py-1.5">Seed {session.seed}</div>
          <div className="rounded-full border border-line bg-tint px-3 py-1.5">Version {session.scenarioVersion}</div>
        </dl>}
      </header>

      {persistenceStatus === "unavailable" && session !== null && <p className="mt-4 rounded-2xl border border-warning/20 bg-warning/5 p-4 text-sm leading-6 text-warning" role="status">Local storage is unavailable. This run is active, but progress could not be saved on this device.</p>}
      {errorMessage !== null && <div className="mt-4 rounded-2xl border border-danger/20 bg-danger/5 p-5" role="alert">
        <p className="font-bold text-danger">{failedOperation === "resume" ? "Saved Director game could not resume" : directorUnavailable ? "Director mode unavailable" : "Director request failed"}</p>
        <p className="mt-2 text-sm leading-6 text-secondary">{errorMessage}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {!(directorUnavailable && session === null) && <button className="min-h-10 rounded-xl border border-danger/30 px-4 py-2 text-sm font-bold text-danger hover:bg-danger/10 disabled:cursor-wait disabled:opacity-60" disabled={isPending} onClick={retryLastRequest} type="button">{isPending ? "Retrying…" : failedOperation === "proposal" ? "Load Fresh Situation" : "Try Again"}</button>}
          {directorUnavailable && <button className="min-h-10 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-on-accent hover:bg-accent-hover" onClick={leaveToModeSelection} type="button">Play Classic Simulation</button>}
          {failedOperation === "resume" && <button className="min-h-10 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-secondary hover:bg-tint" onClick={leaveToLibrary} type="button">Back to Scenario Library</button>}
        </div>
      </div>}

      {session === null ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-7 text-center sm:p-12">
          {pendingOperation === "resume" ? <div aria-live="polite" className="mx-auto max-w-xl" role="status"><h2 className="text-2xl font-bold text-primary">Verifying signed Director history</h2><p className="mt-3 leading-7 text-secondary">The backend is replaying every signed turn record from the original seed. Completed turns will not request new proposals.</p></div> : (
            <><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">New Director run</p><h2 className="mt-2 text-2xl font-bold text-primary">Ready for a Director run?</h2><p className="mx-auto mt-3 max-w-xl leading-7 text-secondary">The backend will validate a signed situation and authoritative previews before the run begins. If live generation is disabled or unavailable, authored fallback content keeps the run moving.</p><button className="mt-7 min-h-12 rounded-xl bg-accent px-6 py-3 font-bold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60" disabled={isPending} onClick={() => void startDirectorSimulation()} type="button">{pendingOperation === "start" ? "Starting Director…" : "Start Director Simulation"}</button></>
          )}
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-start gap-5">
          <aside
            aria-label="Simulation status"
            className="flex min-w-0 shrink grow basis-[300px] flex-col gap-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:max-w-[340px] xl:overflow-y-auto"
          >
            <section aria-labelledby="director-progress-heading" className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-secondary">Director progress</p>
                  <h2 aria-live="polite" className="metric-number mt-1 text-xl font-bold tabular-nums text-primary" id="director-progress-heading">Turn {session.state.current_turn} of {session.state.max_turns}</h2>
                </div>
                <span aria-label={`Game status: ${humanize(session.state.status)}`} className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${session.state.status === "won" ? "bg-success/10 text-success" : session.state.status === "lost" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`} role="status">{humanize(session.state.status)}</span>
              </div>
              <div aria-hidden="true" className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${session.state.max_turns}, minmax(0, 1fr))` }}>
                {Array.from({ length: session.state.max_turns }, (_, index) => (
                  <span
                    className={`h-2 rounded-sm ${index < completedTurns ? "bg-accent" : index === completedTurns && !terminal ? "bg-accent/20 ring-1 ring-inset ring-accent" : "bg-inset"}`}
                    key={index}
                  />
                ))}
              </div>
              <label className="sr-only" htmlFor="director-progress">{completedTurns} of {session.state.max_turns} turns complete</label>
              <progress aria-label="Director simulation progress" className="sr-only" id="director-progress" max={session.state.max_turns} value={completedTurns} />
              <p className="mt-2 text-xs text-secondary">{completedTurns} {completedTurns === 1 ? "decision" : "decisions"} completed · signed replay history</p>
            </section>
            <MetricRail
              changes={latestMetricChanges}
              metrics={metrics}
              series={metricSeries}
              showChange={session.lastResult !== null}
              turnUnit="turn"
              values={session.state.metric_values}
            />
          </aside>

          <div className="flex min-w-0 shrink grow-[999] basis-[520px] flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div aria-label="Simulation views" className="flex gap-1 rounded-xl bg-inset p-1" role="tablist">
                {(["decide", "trends"] as const).map((tab) => (
                  <button
                    aria-selected={view === tab}
                    className={`min-h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${view === tab ? "bg-surface text-primary shadow-sm" : "text-secondary hover:text-primary"}`}
                    key={tab}
                    onClick={() => setView(tab)}
                    role="tab"
                    type="button"
                  >
                    {tab === "trends" ? "Trends" : terminal ? "Report" : "Decide"}
                  </button>
                ))}
              </div>
              <span className="text-xs text-secondary">Signed proposals · outcomes from the simulation engine</span>
            </div>

            {view === "trends" ? <MetricCharts series={metricSeries} /> : <>
              {session.lastResult !== null && session.turnRecords.length > 0 && session.turnRecords[session.turnRecords.length - 1] !== undefined && <DirectorLatestResult record={session.turnRecords[session.turnRecords.length - 1]!} result={session.lastResult} metrics={session.scenario.metrics} />}

              {!terminal && activeProposal !== null && <>
                <DirectorSituationCard situation={activeProposal.proposal.payload.situation} source={activeProposal.proposal.payload.source} turn={activeProposal.proposal.payload.turn} />
                <DirectorChoiceList choices={activeProposal.proposal.payload.choices} previews={activeProposal.previews} selectedChoiceId={session.selectedChoiceId} disabled={isPending} onSelect={(selectedChoiceId) => setSession((current) => current === null ? null : { ...current, selectedChoiceId })} metrics={session.scenario.metrics} />
                <section aria-labelledby="director-confirm-heading" className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3 pl-4 shadow-xl shadow-black/10">
                  <div className="min-w-0 flex-1 basis-64">
                    <h2 className="sr-only" id="director-confirm-heading">Confirm your choice</h2>
                    {session.selectedChoiceId === null ? <p className="text-sm text-secondary">Select one response to review its preview and submit the signed proposal.</p> : <p className="text-sm text-secondary"><span className="font-semibold text-primary">Selected: {activeProposal.proposal.payload.choices.find((choice) => choice.choice_id === session.selectedChoiceId)?.title ?? "Director choice"}.</span> The backend verifies the signature and resolves the turn before anything changes.</p>}
                    {persistenceStatus === "saved" && <span className="mt-0.5 block text-xs text-secondary">Signed history saved on this device</span>}
                  </div>
                  <button className="min-h-11 rounded-xl bg-accent px-6 font-bold text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50" disabled={session.selectedChoiceId === null || isPending} onClick={() => void submitChoice()} type="button">{pendingOperation === "turn" ? "Verifying and resolving…" : "Confirm Director Choice"}</button>
                </section>
              </>}

              {!terminal && activeProposal === null && errorMessage === null && <section aria-live="polite" className="rounded-2xl border border-line bg-surface p-7 text-center" role="status"><h2 className="text-xl font-bold text-primary">Loading a validated situation</h2><p className="mt-2 text-sm text-secondary">The backend is preparing a proposal for the current incomplete turn.</p></section>}

              {terminal && <EndGameReport definition={scenarioDefinition} initialValues={session.initialMetricValues} metricSeries={metricSeries} onRestart={() => void startDirectorSimulation()} restarting={isPending} state={session.state} />}
            </>}
          </div>

          <aside
            aria-label="Director log"
            className="flex min-w-0 shrink grow basis-[270px] flex-col xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:max-w-[320px] xl:overflow-y-auto"
          >
            <DirectorHistory records={session.turnRecords} state={session.state} definition={scenarioDefinition} />
          </aside>
        </div>
      )}
    </section>
  );

  function getController(): AbortController {
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    return nextController;
  }

  function nextRequestVersion(): number {
    requestGeneration.current += 1;
    return requestGeneration.current;
  }

  function isCurrentRequest(version: number): boolean {
    return requestGeneration.current === version;
  }
}

async function fetchProposal(
  history: DirectorReplayHistory,
  expectedState: GameState,
  requestVersion: number,
  signal?: AbortSignal,
): Promise<DirectorProposalResponse> {
  const response = await getDirectorProposal(history, signal);
  if (
    response.scenario_id !== history.scenario_id ||
    response.scenario_version !== history.scenario_version ||
    response.seed !== history.seed ||
    !sameState(response.state, expectedState) ||
    response.proposal.payload.turn !== expectedState.current_turn ||
    response.proposal.payload.profile_id !== history.profile_id ||
    response.proposal.payload.profile_version !== history.profile_version ||
    response.proposal.payload.context_snapshot.turn !== expectedState.current_turn ||
    JSON.stringify(response.proposal.payload.context_snapshot.metric_values) !== JSON.stringify(expectedState.metric_values) ||
    response.previews.length !== response.proposal.payload.choices.length ||
    !response.proposal.payload.choices.every((choice) => response.previews.some((preview) => preview.choice_id === choice.choice_id))
  ) {
    throw new Error(`Director proposal ${requestVersion} does not match the current authoritative state.`);
  }
  return response;
}

function emptyDirectorHistory(scenarioId: string, scenarioVersion: string, seed: number): SavedDirectorRun {
  return {
    format_version: DIRECTOR_SAVE_FORMAT_VERSION,
    mode: "director",
    scenario_id: scenarioId,
    scenario_version: scenarioVersion,
    seed,
    profile_id: DIRECTOR_PROFILE_ID,
    profile_version: DIRECTOR_PROFILE_VERSION,
    turn_records: [],
  };
}

function makeHistory(session: Pick<DirectorSession, "scenarioId" | "scenarioVersion" | "seed" | "turnRecords">): DirectorReplayHistory {
  return {
    format_version: 2,
    mode: "director",
    scenario_id: session.scenarioId,
    scenario_version: session.scenarioVersion,
    seed: session.seed,
    profile_id: DIRECTOR_PROFILE_ID,
    profile_version: DIRECTOR_PROFILE_VERSION,
    turn_records: [...session.turnRecords],
  };
}

function makeSave(session: Pick<DirectorSession, "scenarioId" | "scenarioVersion" | "seed" | "turnRecords" | "proposal">): SavedDirectorRun {
  const history = makeHistory(session);
  return {
    ...history,
    ...(session.proposal === null ? {} : { pending_proposal: session.proposal.proposal }),
  };
}

function assertStartMatchesDefinition(
  scenarioId: string,
  scenarioVersion: string,
  seed: number,
  definition: ScenarioDefinition,
) {
  if (scenarioId !== definition.scenario_id || scenarioVersion !== definition.version || !Number.isSafeInteger(seed) || seed < 0) {
    throw new Error("The scenario version or seed changed. Return to the library and load the current definition.");
  }
}

function assertReplayMatchesSave(
  replay: Awaited<ReturnType<typeof replayDirectorRun>>,
  save: SavedDirectorRun,
  initialState: GameState,
) {
  const expectedPending = save.pending_proposal ?? null;
  if (
    replay.scenario_id !== save.scenario_id || replay.scenario_version !== save.scenario_version || replay.seed !== save.seed ||
    replay.state.decision_history.length !== save.turn_records.length ||
    replay.state.seed.seed !== save.seed ||
    replay.state.scenario_id !== initialState.scenario_id ||
    replay.state.scenario_version !== initialState.scenario_version ||
    JSON.stringify(replay.pending_proposal ?? null) !== JSON.stringify(expectedPending)
  ) {
    throw new Error("The backend returned a replay inconsistent with the saved Director records.");
  }
  if (save.turn_records.length === 0) {
    if (replay.latest_turn_record !== null || replay.latest_turn_result !== null || !sameState(replay.state, initialState)) throw new Error("The backend returned an unexpected latest turn result.");
  } else {
    const last = save.turn_records[save.turn_records.length - 1];
    if (
      replay.latest_turn_record === null || replay.latest_turn_result === null ||
      JSON.stringify(replay.latest_turn_record) !== JSON.stringify(last) ||
      replay.latest_turn_result.completed_turn_index !== save.turn_records.length ||
      replay.latest_turn_result.new_state.current_turn !== replay.state.current_turn ||
      JSON.stringify(replay.latest_turn_result.new_state.metric_values) !== JSON.stringify(replay.state.metric_values)
    ) throw new Error("The backend returned a replay inconsistent with the saved Director records.");
  }
  if (expectedPending !== null) {
    if (
      replay.pending_proposal === null || replay.pending_proposal === undefined ||
      replay.pending_previews === undefined ||
      replay.pending_previews.length !== replay.pending_proposal.payload.choices.length ||
      !replay.pending_proposal.payload.choices.every((choice) =>
        replay.pending_previews?.some((preview) => preview.choice_id === choice.choice_id),
      )
    ) throw new Error("The backend did not restore the pending proposal with authoritative previews.");
  }
}

function assertTurnMatchesRequest(
  response: Awaited<ReturnType<typeof playDirectorTurn>>,
  session: DirectorSession,
  choiceId: string,
) {
  const expectedTurn = session.turnRecords.length + 1;
  if (
    response.scenario_id !== session.scenarioId || response.scenario_version !== session.scenarioVersion || response.seed !== session.seed ||
    response.turn_result.completed_turn_index !== expectedTurn || response.state.decision_history.length !== expectedTurn ||
    response.state.decision_history[expectedTurn - 1]?.action_id !== choiceId ||
    response.turn_record.selected_choice_id !== choiceId || response.turn_record.proposal.payload.turn !== expectedTurn ||
    JSON.stringify(response.turn_record.proposal) !== JSON.stringify(session.proposal?.proposal) ||
    response.turn_record.receipt.signature.key_id !== response.turn_record.proposal.signature.key_id ||
    JSON.stringify(response.turn_result.new_state) !== JSON.stringify(response.state)
  ) throw new Error("The Director turn response did not match the submitted signed choice.");
}

function sameState(first: GameState, second: GameState): boolean {
  return first.scenario_id === second.scenario_id &&
    first.scenario_version === second.scenario_version &&
    first.current_turn === second.current_turn &&
    first.max_turns === second.max_turns &&
    first.status === second.status &&
    first.seed.seed === second.seed.seed &&
    JSON.stringify(first.metric_values) === JSON.stringify(second.metric_values) &&
    JSON.stringify(first.decision_history) === JSON.stringify(second.decision_history);
}

function isDirectorUnavailableError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "director_disabled" || error.code === "director_signing_unavailable");
}

function isStaleProposalError(error: unknown): boolean {
  return error instanceof ApiError && (
    error.code === "stale_director_proposal" || error.code === "invalid_director_signature" ||
    error.code === "invalid_director_proposal" || error.code === "invalid_director_choice"
  );
}

function describeDirectorError(error: unknown, restoring: boolean): string {
  if (isDirectorUnavailableError(error)) {
    return "Director mode is disabled or its backend signing configuration is unavailable. Choose Classic Simulation to continue. Any saved run remains unchanged.";
  }
  if (error instanceof ApiError) {
    if (restoring) return `The backend rejected the saved signed history (${error.code}). The saved data was preserved.`;
    if (error.code === "stale_director_proposal") return "The signed proposal no longer matches the current run. Load a fresh situation before choosing again.";
    return error.message;
  }
  if (error instanceof TypeError) return "Could not reach the ScenarioLab API. Check the connection and retry.";
  if (error instanceof Error && error.message.includes("response did not match the expected contract")) return "The API returned unexpected Director data. Retry before continuing.";
  return error instanceof Error ? error.message : "The API returned unexpected Director data. Retry before continuing.";
}

function isTerminal(state: GameState): boolean {
  return state.status === "won" || state.status === "lost";
}

function humanize(value: string): string {
  return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
