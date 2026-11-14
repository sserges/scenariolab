import { useState } from "react";

import { hasAIFeature, type ScenarioCatalogEntry, type ScenarioDefinition } from "../lib/api";
import { isSavedDirectorRun } from "../lib/savedRun";
import { describeTurnLength } from "../lib/turns";
import type { SaveReadResult, SavedDirectorRun, SavedRun, SavedScriptedRun } from "../lib/savedRun";
import { ClassicGameplayScreen } from "./ClassicGameplayScreen";
import { DirectorGameplayScreen } from "./DirectorGameplayScreen";
import { ScenarioIcon } from "./ScenarioIcon";

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
      <section aria-labelledby="gameplay-mode-heading" className="pb-12" data-scenario-category={catalogEntry.category}>
        <button
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-secondary transition-colors hover:text-primary focus-visible:outline-offset-4"
          onClick={onBack}
          type="button"
        >
          <span aria-hidden="true">←</span> Scenario library
        </button>
        <header className="flex flex-wrap items-start gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
            <ScenarioIcon category={catalogEntry.category} className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1 basis-72">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{humanizeCategory(catalogEntry.category)} scenario</p>
            <h1 className="mt-1.5 text-3xl font-black tracking-tight text-primary sm:text-4xl" id="gameplay-mode-heading">
              {scenarioDefinition.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary sm:text-base">{scenarioDefinition.metadata.objective}</p>
            <dl className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-secondary">
              <div className="rounded-full border border-line bg-tint px-3 py-1.5"><dt className="sr-only">Length</dt><dd>{describeTurnLength(scenarioDefinition.turn)}</dd></div>
              <div className="rounded-full border border-line bg-tint px-3 py-1.5"><dt className="sr-only">Metrics</dt><dd>{scenarioDefinition.metrics.length} tracked metrics</dd></div>
              <div className="rounded-full border border-line bg-tint px-3 py-1.5"><dt className="sr-only">Version</dt><dd>Version {scenarioDefinition.version}</dd></div>
            </dl>
          </div>
        </header>
        <div className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-secondary">Choose your simulation mode</h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-secondary">
            {directorSupported
              ? "Choose a familiar scripted run or let the Scenario Director present signed situations and choices."
              : "This scenario plays as a deterministic Classic Simulation with authored situations and replayable results."}
          </p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ModeCard
            badge="Ready to play"
            description="The established set of validated decisions, deterministic events, charts, and replayable results."
            features={["Every decision shows its declared effects", "Seeded events you can replay exactly", "Saved automatically on this device"]}
            onClick={() => setMode("classic")}
            title="Classic Simulation"
          />
          {directorSupported ? (
            <ModeCard
              badge="Authored fallback situations"
              description="A signed Director proposal presents situation-specific choices and authoritative previews. Live generation is optional and off by default."
              features={["Signed, situation-specific choices", "Engine previews before you commit", "Tamper-checked replay of every turn"]}
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
        <p className="mt-4 rounded-2xl border border-line bg-tint p-4 text-sm leading-6 text-secondary">
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
      className="flex flex-col rounded-2xl border border-dashed border-line bg-tint p-6 text-left sm:p-7"
      data-testid="director-unavailable"
    >
      <span className="w-fit rounded-full border border-line px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-secondary">
        Not available for this scenario
      </span>
      <span className="mt-4 block text-2xl font-bold tracking-tight text-secondary">{title}</span>
      <span className="mt-2 block text-sm leading-6 text-secondary">{description}</span>
    </div>
  );
}

function humanizeCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replaceAll("-", " ");
}

function ModeCard({
  badge,
  description,
  features,
  onClick,
  title,
}: {
  badge: string;
  description: string;
  features: string[];
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className="group flex flex-col rounded-2xl border-[1.5px] border-line bg-surface p-6 text-left transition-colors hover:border-accent hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus sm:p-7"
      onClick={onClick}
      type="button"
    >
      <span className="w-fit rounded-full bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-accent">
        {badge}
      </span>
      <span className="mt-4 block text-2xl font-bold tracking-tight text-primary">{title}</span>
      <span className="mt-2 block text-sm leading-6 text-secondary">{description}</span>
      <span className="mt-4 flex flex-col gap-1.5">
        {features.map((feature) => (
          <span className="flex items-start gap-2 text-sm text-primary" key={feature}>
            <span aria-hidden="true" className="mt-0.5 text-accent">✓</span>
            {feature}
          </span>
        ))}
      </span>
      <span className="mt-6 inline-flex w-fit rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-on-accent transition-colors group-hover:bg-accent-hover">
        Choose {title}
      </span>
    </button>
  );
}
