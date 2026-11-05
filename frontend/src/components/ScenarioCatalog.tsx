import { useEffect, useState } from "react";

import {
  getScenarioCatalog,
  getScenarioDefinition,
  type ScenarioCatalogEntry,
  type ScenarioDefinition,
} from "../lib/api";
import type { SaveReadResult, SavedRun } from "../lib/savedRun";

type CatalogState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; scenarios: ScenarioCatalogEntry[] };

type DetailState =
  | { status: "idle" }
  | { status: "loading"; scenarioId: string }
  | { status: "error"; scenarioId: string }
  | { status: "ready"; definition: ScenarioDefinition };

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h14m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ScenarioCard({
  scenario,
  onOpenScenario,
}: {
  scenario: ScenarioCatalogEntry;
  onOpenScenario: ((scenario: ScenarioCatalogEntry, definition: ScenarioDefinition) => void) | undefined;
}) {
  const [detailState, setDetailState] = useState<DetailState>({ status: "idle" });
  const isAvailable = scenario.availability === "available";

  async function loadDetails() {
    if (!isAvailable || detailState.status === "loading") {
      return;
    }

    setDetailState({ status: "loading", scenarioId: scenario.scenario_id });
    try {
      const definition = await getScenarioDefinition(scenario.scenario_id);
      setDetailState({ status: "ready", definition });
    } catch {
      setDetailState({ status: "error", scenarioId: scenario.scenario_id });
    }
  }

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border p-7 ${
        isAvailable
          ? "border-teal-300/20 bg-gradient-to-br from-slate-900 to-slate-900/60 shadow-2xl shadow-black/20"
          : "border-white/10 bg-white/[0.025]"
      }`}
      data-scenario-id={scenario.scenario_id}
    >
      <div
        aria-hidden="true"
        className={`absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl ${
          isAvailable ? "bg-teal-400/10" : "bg-slate-400/5"
        }`}
      />
      <div className="relative flex h-full min-h-80 flex-col">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {scenario.category}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isAvailable
                ? "bg-emerald-400/10 text-emerald-200"
                : "bg-white/5 text-slate-500"
            }`}
          >
            {isAvailable ? "Available" : "Coming Soon"}
          </span>
        </div>

        <h3 className={`mt-7 text-2xl font-bold ${isAvailable ? "text-white" : "text-slate-300"}`}>
          {scenario.title}
        </h3>
        <p className="mt-3 leading-7 text-slate-400">{scenario.description}</p>
        <div className="mt-5 rounded-2xl border border-white/5 bg-black/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Objective
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{scenario.objective}</p>
        </div>

        <div className="mt-auto pt-7">
          {isAvailable ? (
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-teal-200 disabled:cursor-wait disabled:opacity-70"
              disabled={detailState.status === "loading"}
              onClick={() => void loadDetails()}
              type="button"
            >
              {detailState.status === "loading" ? "Loading Details" : "View Details"}
              <ArrowIcon />
            </button>
          ) : (
            <button
              className="cursor-not-allowed rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-600"
              disabled
              type="button"
            >
              Coming Soon
            </button>
          )}

          {detailState.status === "ready" && (
            <div className="mt-5 border-t border-white/10 pt-5 text-sm text-slate-400">
              <p className="font-semibold text-teal-200">Definition validated</p>
              <p className="mt-2">
                {detailState.definition.turn.max_turns} {detailState.definition.turn.unit}
                -long turns · {detailState.definition.metrics.length} tracked metrics
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Ready for deterministic browser play.
              </p>
              {onOpenScenario !== undefined && (
                <button
                  className="mt-4 rounded-xl bg-teal-300 px-4 py-2 font-bold text-slate-950 transition-colors hover:bg-teal-200"
                  onClick={() => onOpenScenario(scenario, detailState.definition)}
                  type="button"
                >
                  Open Simulation
                </button>
              )}
            </div>
          )}
          {detailState.status === "error" && (
            <p className="mt-4 text-sm text-rose-300" role="alert">
              Scenario details are unavailable right now.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export function ScenarioCatalog({
  onOpenScenario,
  saveState = { status: "missing" },
  onClearSavedRun,
}: {
  onOpenScenario?: (scenario: ScenarioCatalogEntry, definition: ScenarioDefinition, resumeSave?: SavedRun) => void;
  saveState?: SaveReadResult;
  onClearSavedRun?: () => void;
}) {
  const [catalogState, setCatalogState] = useState<CatalogState>({
    status: "loading",
  });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogState({ status: "loading" });

    void getScenarioCatalog(controller.signal)
      .then((scenarios) => setCatalogState({ status: "ready", scenarios }))
      .catch(() => {
        if (!controller.signal.aborted) {
          setCatalogState({ status: "error" });
        }
      });

    return () => controller.abort();
  }, [requestVersion]);

  if (catalogState.status === "loading") {
    return (
      <div
        className="mt-7 rounded-3xl border border-white/10 bg-white/[0.025] px-6 py-16 text-center text-sm text-slate-400"
        role="status"
      >
        Loading scenarios…
      </div>
    );
  }

  if (catalogState.status === "error") {
    return (
      <div
        className="mt-7 rounded-3xl border border-rose-300/20 bg-rose-300/5 px-6 py-10 text-center"
        role="alert"
      >
        <p className="font-semibold text-rose-200">Scenario catalog unavailable</p>
        <p className="mt-2 text-sm text-slate-400">
          Check the API connection and try again.
        </p>
        <button
          className="mt-5 rounded-xl border border-rose-200/20 px-4 py-2 text-sm font-bold text-rose-100"
          onClick={() => setRequestVersion((version) => version + 1)}
          type="button"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="mt-7 space-y-5">
      {saveState.status === "valid" && onOpenScenario !== undefined && (
        <SavedRunPanel
          {...(onClearSavedRun === undefined ? {} : { onClear: onClearSavedRun })}
          onOpenScenario={onOpenScenario}
          save={saveState.save}
          scenarios={catalogState.scenarios}
        />
      )}
      {saveState.status === "invalid" && (
        <div className="flex flex-col gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <div>
            <p className="font-semibold text-amber-100">Saved progress could not be read</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              The save is left untouched. Clear it to start a fresh run on this device.
            </p>
          </div>
          {onClearSavedRun !== undefined && (
            <button className="rounded-xl border border-amber-200/20 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-200/10" onClick={onClearSavedRun} type="button">
              Clear Saved Progress
            </button>
          )}
        </div>
      )}
      {saveState.status === "unavailable" && (
        <p className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-6 text-amber-100" role="status">
          Local progress storage is unavailable. You can play, but this run will not be saved on this device.
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {catalogState.scenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.scenario_id}
            onOpenScenario={onOpenScenario}
            scenario={scenario}
          />
        ))}
      </div>
    </div>
  );
}

function SavedRunPanel({
  onClear,
  onOpenScenario,
  save,
  scenarios,
}: {
  onClear?: () => void;
  onOpenScenario: (scenario: ScenarioCatalogEntry, definition: ScenarioDefinition, resumeSave?: SavedRun) => void;
  save: SavedRun;
  scenarios: ScenarioCatalogEntry[];
}) {
  const [busy, setBusy] = useState<"continue" | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scenario = scenarios.find((item) => item.scenario_id === save.scenario_id);

  async function openSavedScenario(mode: "continue" | "new") {
    if (busy !== null) {
      return;
    }
    if (scenario === undefined || scenario.availability !== "available") {
      setError("The saved scenario is no longer available. Its progress has been preserved.");
      return;
    }
    setBusy(mode);
    setError(null);
    try {
      const definition = await getScenarioDefinition(scenario.scenario_id);
      if (mode === "continue" && definition.version !== save.scenario_version) {
        setError(
          `Saved version ${save.scenario_version} is incompatible with available version ${definition.version}. Clear the save or start a new game.`,
        );
        return;
      }
      if (mode === "continue") {
        onOpenScenario(scenario, definition, save);
      } else {
        onOpenScenario(scenario, definition);
      }
    } catch {
      setError("Scenario details are unavailable. Saved progress has not changed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="saved-run-heading" className="rounded-3xl border border-teal-300/20 bg-teal-300/[0.06] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-teal-200">Saved on this device</p>
          <h3 className="mt-1 text-xl font-bold text-white" id="saved-run-heading">
            Continue {scenario?.title ?? save.scenario_id}
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            {save.action_history.length} completed {save.action_history.length === 1 ? "decision" : "decisions"} · scenario version {save.scenario_version}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Resume rebuilds the run from its seed and ordered decisions through the game API.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-xl bg-teal-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-teal-200 disabled:cursor-wait disabled:opacity-60"
            disabled={busy !== null}
            onClick={() => void openSavedScenario("continue")}
            type="button"
          >
            {busy === "continue" ? "Loading Saved Run…" : "Continue Saved Game"}
          </button>
          {scenario?.availability === "available" && (
            <button
              className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => void openSavedScenario("new")}
              type="button"
            >
              {busy === "new" ? "Loading Scenario…" : "New Game"}
            </button>
          )}
          {onClear !== undefined && (
            <button
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5"
              disabled={busy !== null}
              onClick={onClear}
              type="button"
            >
              Clear Saved Progress
            </button>
          )}
        </div>
      </div>
      {error !== null && <p className="mt-4 text-sm leading-6 text-amber-100" role="alert">{error}</p>}
    </section>
  );
}
