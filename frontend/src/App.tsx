import { useState } from "react";

import { ApiStatus } from "./components/ApiStatus";
import { GameplayScreen } from "./components/GameplayScreen";
import { ScenarioCatalog } from "./components/ScenarioCatalog";
import type { ScenarioCatalogEntry } from "./lib/api";

export function App() {
  const [selectedScenario, setSelectedScenario] =
    useState<ScenarioCatalogEntry | null>(null);

  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.14),transparent_45%),radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_40%)]"
      />

      <header className="relative border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <a
            aria-label="ScenarioLab home"
            className="flex items-center gap-3 font-semibold tracking-tight"
            href="/"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-400 font-black text-slate-950 shadow-lg shadow-teal-950/40">
              S
            </span>
            <span>ScenarioLab</span>
          </a>
          <ApiStatus />
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:px-8 sm:pt-20 lg:px-10">
        {selectedScenario === null ? (
          <>
            <section className="max-w-3xl" aria-labelledby="page-title">
              <div className="mb-5 inline-flex rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-teal-200">
                Decision simulation platform
              </div>
              <h1
                className="text-balance text-5xl font-black tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl"
                id="page-title"
              >
                ScenarioLab
              </h1>
              <p className="mt-5 max-w-2xl text-xl leading-relaxed text-slate-300 sm:text-2xl">
                Make decisions. Explore consequences.
              </p>
              <p className="mt-5 max-w-2xl leading-7 text-slate-400">
                Step into high-stakes scenarios, balance competing priorities, and
                see how each choice shapes what comes next.
              </p>
            </section>

            <section className="mt-16" aria-labelledby="scenario-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-teal-300">Scenario library</p>
                  <h2
                    className="mt-1 text-2xl font-bold tracking-tight text-white"
                    id="scenario-heading"
                  >
                    Choose your challenge
                  </h2>
                </div>
                <p className="text-sm text-slate-500">3 official scenarios</p>
              </div>

              <ScenarioCatalog onOpenScenario={setSelectedScenario} />

              <article className="mt-5 rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-7">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Planned feature
                    </span>
                    <h3 className="mt-5 text-xl font-bold text-slate-300">
                      Create Custom Scenario
                    </h3>
                    <p className="mt-2 max-w-2xl leading-7 text-slate-500">
                      Turn a prompt, document, or URL into a validated simulation built
                      on the same ScenarioDefinition contract.
                    </p>
                  </div>
                  <button
                    className="w-fit shrink-0 cursor-not-allowed rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-600"
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
            catalogEntry={selectedScenario}
            onBack={() => setSelectedScenario(null)}
          />
        )}
      </main>

      <footer className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <span>ScenarioLab · Build Your First AI App 2026</span>
          <span>Deterministic outcomes. Validated AI.</span>
        </div>
      </footer>
    </div>
  );
}
