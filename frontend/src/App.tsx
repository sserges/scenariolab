import { useEffect, useState } from "react";

import { ApiStatus } from "./components/ApiStatus";
import { GameplayScreen } from "./components/GameplayScreen";
import { ScenarioCatalog } from "./components/ScenarioCatalog";
import { ThemeToggle } from "./components/ThemeToggle";
import type { ScenarioCatalogEntry, ScenarioDefinition } from "./lib/api";
import { clearSavedRun, readSavedRun } from "./lib/savedRun";
import type { SaveReadResult, SavedRun } from "./lib/savedRun";
import { applyTheme, getInitialTheme, saveThemePreference } from "./lib/theme";
import type { Theme } from "./lib/theme";

interface SelectedScenario {
  entry: ScenarioCatalogEntry;
  definition: ScenarioDefinition;
  resumeSave: SavedRun | null;
}

export function App() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [selectedScenario, setSelectedScenario] = useState<SelectedScenario | null>(null);
  const [saveState, setSaveState] = useState<SaveReadResult>(() => readSavedRun());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    saveThemePreference(nextTheme);
  }

  function clearProgress() {
    setSaveState(clearSavedRun() ? { status: "missing" } : { status: "unavailable" });
  }

  function returnToCatalog() {
    setSelectedScenario(null);
    setSaveState(readSavedRun());
  }

  return (
    <div className="min-h-screen overflow-hidden bg-canvas text-primary">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--theme-accent)_10%,transparent),transparent_45%),radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--theme-accent)_7%,transparent),transparent_40%)]"
      />

      <header className="relative border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8 lg:px-10">
          <a
            aria-label="ScenarioLab home"
            className="flex items-center gap-3 font-semibold tracking-tight"
            href="/"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent font-black text-on-accent shadow-lg">
              S
            </span>
            <span>ScenarioLab</span>
          </a>
          <div className="flex items-center gap-2">
            <ThemeToggle onToggle={toggleTheme} theme={theme} />
            <ApiStatus />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:px-8 sm:pt-20 lg:px-10">
        {selectedScenario === null ? (
          <>
            <section className="max-w-3xl" aria-labelledby="page-title">
              <div className="mb-5 inline-flex rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-accent">
                Decision simulation platform
              </div>
              <h1
                className="text-balance text-5xl font-black tracking-[-0.04em] text-primary sm:text-6xl lg:text-7xl"
                id="page-title"
              >
                ScenarioLab
              </h1>
              <p className="mt-5 max-w-2xl text-xl leading-relaxed text-secondary sm:text-2xl">
                Make decisions. Explore consequences.
              </p>
              <p className="mt-5 max-w-2xl leading-7 text-secondary">
                Step into high-stakes scenarios, balance competing priorities, and
                see how each choice shapes what comes next.
              </p>
            </section>

            <section className="mt-16" aria-labelledby="scenario-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-accent">Scenario library</p>
                  <h2
                    className="mt-1 text-2xl font-bold tracking-tight text-primary"
                    id="scenario-heading"
                  >
                    Choose your challenge
                  </h2>
                </div>
                <p className="text-sm text-secondary">3 official scenarios</p>
              </div>

              <ScenarioCatalog
                onClearSavedRun={clearProgress}
                onOpenScenario={(entry, definition, resumeSave) =>
                  setSelectedScenario({
                    entry,
                    definition,
                    resumeSave: resumeSave ?? null,
                  })
                }
                saveState={saveState}
              />

              <article className="mt-5 rounded-3xl border border-dashed border-line bg-tint p-7">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="rounded-full border border-line px-3 py-1 text-xs font-bold uppercase tracking-wider text-secondary">
                      Planned feature
                    </span>
                    <h3 className="mt-5 text-xl font-bold text-primary">
                      Create Custom Scenario
                    </h3>
                    <p className="mt-2 max-w-2xl leading-7 text-secondary">
                      Turn a prompt, document, or URL into a validated simulation built
                      on the same ScenarioDefinition contract.
                    </p>
                  </div>
                  <button
                    className="w-fit shrink-0 cursor-not-allowed rounded-xl border border-line px-4 py-3 text-sm font-bold text-secondary"
                    disabled
                    type="button"
                  >
                    Planned
                  </button>
                </div>
              </article>
            </section>
          </>
        ) : (
          <GameplayScreen
            catalogEntry={selectedScenario.entry}
            onBack={returnToCatalog}
            onSaveStateChange={setSaveState}
            resumeSave={selectedScenario.resumeSave}
            scenarioDefinition={selectedScenario.definition}
          />
        )}
      </main>

      <footer className="relative border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <span>ScenarioLab · Build Your First AI App 2026</span>
          <span>Deterministic outcomes. Validated AI.</span>
        </div>
      </footer>
    </div>
  );
}
