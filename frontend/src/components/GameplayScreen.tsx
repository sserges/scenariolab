import { useState } from "react";

import { hasAIFeature, type ScenarioCatalogEntry, type ScenarioDefinition } from "../lib/api";
import { isSavedDirectorRun } from "../lib/savedRun";
import type { SaveReadResult, SavedDirectorRun, SavedRun, SavedScriptedRun } from "../lib/savedRun";
import { ClassicGameplayScreen } from "./ClassicGameplayScreen";
import { DirectorGameplayScreen } from "./DirectorGameplayScreen";

type GameplayMode = "classic" | "director";

interface GameplayScreenProps {
  catalogEntry: ScenarioCatalogEntry;
  scenarioDefinition: ScenarioDefinition;
  resumeSave?: SavedRun | null;
  existingSave?: SavedRun | null;
  onSaveStateChange?: (state: SaveReadResult) => void;
  onBack: () => void;
}

export function GameplayScreen({
  catalogEntry,
  scenarioDefinition,
  resumeSave = null,
  existingSave = null,
  onSaveStateChange,
  onBack,
}: GameplayScreenProps) {
  const [mode, setMode] = useState<GameplayMode | null>(() =>
    resumeSave === null ? null : isSavedDirectorRun(resumeSave) ? "director" : "classic",
  );
  const directorSave = resumeSave !== null && isSavedDirectorRun(resumeSave)
    ? resumeSave as SavedDirectorRun
    : null;
  const classicSave = resumeSave !== null && !isSavedDirectorRun(resumeSave)
    ? resumeSave as SavedScriptedRun
    : null;
  const directorSupported = hasAIFeature(catalogEntry, "scenario-director");

  if (mode === null) {
    return (
      <section aria-labelledby="gameplay-mode-heading" className="pb-12">
        <button
          className="mb-7 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-secondary transition-colors hover:text-primary focus-visible:outline-offset-4"
          onClick={onBack}
          type="button"
        >
          <span aria-hidden="true">←</span> Scenario library
        </button>
        <header className="rounded-3xl border border-accent/20 bg-surface p-6 shadow-2xl shadow-black/20 sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{humanizeCategory(catalogEntry.category)} scenario</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-primary sm:text-5xl" id="gameplay-mode-heading">
            {scenarioDefinition.title}
          </h1>
          <h2 className="mt-2 text-xl font-bold text-primary">Choose your simulation mode</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-secondary sm:text-lg sm:leading-8">
            {directorSupported
              ? "Choose a familiar scripted run or let the Scenario Director present signed situations and choices."
              : "This scenario plays as a deterministic Classic Simulation with authored situations and replayable results."}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary">{scenarioDefinition.metadata.objective}</p>
        </header>
        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <ModeCard
            badge="Ready to play"
            description="The established set of validated decisions, deterministic events, charts, and replayable results."
            onClick={() => setMode("classic")}
            title="Classic Simulation"
          />
          {directorSupported ? (
            <ModeCard
              badge="Authored fallback situations"
              description="A signed Director proposal presents situation-specific choices and authoritative previews. Live generation is optional and off by default."
              onClick={() => setMode("director")}
              title="AI Scenario Director"
            />
          ) : (
            <UnavailableModeCard
              description={`AI Scenario Director is not available for ${scenarioDefinition.title}. Director profiles currently exist only for Startup Survival, so this scenario uses Classic Simulation.`}
              title="AI Scenario Director"
            />
          )}
        </div>
        <p className="mt-5 rounded-2xl border border-line bg-tint p-4 text-sm leading-6 text-secondary">
          {directorSupported
            ? "Director availability is controlled by the backend. If it is disabled, the API will say so and Classic Simulation remains available."
            : "No AI requests are made to generate situations or decisions in this scenario. Events, decisions, and outcomes come from its validated scenario definition."}
        </p>
      </section>
    );
  }

  const switchMode = () => setMode(null);
  const hasExistingProgress = existingSave !== null;

  if (mode === "director" && directorSupported) {
    return (
      <DirectorGameplayScreen
        catalogEntry={catalogEntry}
        existingSavedProgress={hasExistingProgress && directorSave === null}
        onBack={onBack}
        {...(onSaveStateChange === undefined ? {} : { onSaveStateChange })}
        onSwitchMode={switchMode}
        resumeSave={directorSave}
        scenarioDefinition={scenarioDefinition}
      />
    );
  }

  return (
    <ClassicGameplayScreen
      catalogEntry={catalogEntry}
      existingSavedProgress={hasExistingProgress && classicSave === null}
      onBack={onBack}
      {...(onSaveStateChange === undefined ? {} : { onSaveStateChange })}
      onSwitchMode={switchMode}
      resumeSave={classicSave}
      scenarioDefinition={scenarioDefinition}
    />
  );
}

function UnavailableModeCard({ description, title }: { description: string; title: string }) {
  return (
    <div
      aria-disabled="true"
      className="rounded-3xl border border-dashed border-line bg-tint p-6 text-left sm:p-8"
      data-testid="director-unavailable"
    >
      <span className="inline-flex rounded-full border border-line px-3 py-1 text-xs font-bold uppercase tracking-wider text-secondary">
        Not available for this scenario
      </span>
      <span className="mt-5 block text-2xl font-bold tracking-tight text-secondary">{title}</span>
      <span className="mt-3 block text-sm leading-7 text-secondary">{description}</span>
    </div>
  );
}

function humanizeCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replaceAll("-", " ");
}

function ModeCard({
  badge,
  description,
  onClick,
  title,
}: {
  badge: string;
  description: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className="group rounded-3xl border border-line bg-surface p-6 text-left shadow-xl shadow-black/10 transition-colors hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus sm:p-8"
      onClick={onClick}
      type="button"
    >
      <span className="inline-flex rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
        {badge}
      </span>
      <span className="mt-5 block text-2xl font-bold tracking-tight text-primary">{title}</span>
      <span className="mt-3 block text-sm leading-7 text-secondary">{description}</span>
      <span className="mt-6 inline-flex rounded-xl bg-accent px-4 py-3 text-sm font-bold text-on-accent transition-colors group-hover:bg-accent-hover">
        Choose {title}
      </span>
    </button>
  );
}
