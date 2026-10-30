import { ApiStatus } from "./components/ApiStatus";

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

export function App() {
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
            <p className="text-sm text-slate-500">1 scenario in development</p>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-2">
            <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-900/60 p-7 shadow-2xl shadow-black/20">
              <div
                aria-hidden="true"
                className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl"
              />
              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-200">
                    Business
                  </span>
                  <span className="text-xs font-semibold text-slate-500">12 months</span>
                </div>
                <h3 className="mt-8 text-2xl font-bold text-white">
                  Startup Survival
                </h3>
                <p className="mt-3 max-w-md leading-7 text-slate-400">
                  Guide an early-stage company through a year of hard tradeoffs.
                  Protect runway, grow the team, and build something customers
                  need.
                </p>
                <button
                  className="mt-8 inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-slate-300"
                  disabled
                  type="button"
                >
                  Gameplay coming next
                  <ArrowIcon />
                </button>
              </div>
            </article>

            <article className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-7">
              <div className="flex h-full min-h-64 flex-col justify-between">
                <div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Future feature
                  </span>
                  <h3 className="mt-8 text-2xl font-bold text-slate-300">
                    Create Custom Scenario
                  </h3>
                  <p className="mt-3 max-w-md leading-7 text-slate-500">
                    Turn a prompt, document, or URL into a validated simulation
                    built on the same deterministic engine.
                  </p>
                </div>
                <button
                  className="mt-8 w-fit cursor-not-allowed rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-600"
                  disabled
                  type="button"
                >
                  Coming later
                </button>
              </div>
            </article>
          </div>
        </section>
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
