# ScenarioLab Roadmap

This schedule runs daily from October 29 through November 27, 2026. It targets a reviewable MVP before the November 25 internal submission, leaving November 26 for contingency and November 27 for final submission only.

The official Devpost deadline is confirmed as November 27, 2026 at 5:00 PM EST. Personal eligibility and completed Devpost registration remain unconfirmed; see `docs/hackathon-compliance.md`.

## Verified progress

- **Brick 1 — Complete:** repository policy, product architecture, scenario contract, roadmap, and compliance tracker are documented.
- **Brick 2 — Complete:** React/Vite/Tailwind application shell, FastAPI health service, environment configuration, CORS, dependency locks, frontend tests, backend tests, and production frontend build are verified.
- **Next:** Brick 3 may begin only after Brick 2 review. No simulation engine or gameplay logic is included yet.

## Daily milestones

| Date | Milestone | Exit evidence |
| --- | --- | --- |
| Oct 29 | **Brick 1:** repository foundation and architecture | Six foundation documents reviewed; contract and trust boundaries documented |
| Oct 30 | Confirm hackathon rules and lock MVP acceptance criteria | Official-source links recorded; open compliance questions resolved or assigned |
| Oct 31 | **Brick 2:** scaffold frontend/API workspaces and developer commands | React build and tests pass; FastAPI health test and live smoke test pass; commands documented |
| Nov 1 | Implement Pydantic `ScenarioDefinition` models | Minimal and full definitions validate; invalid fixtures fail clearly |
| Nov 2 | Add semantic scenario validator and JSON Schema export | Cross-reference, bounds, predicate, and effect validation covered by Pytest |
| Nov 3 | Define Startup Survival v1 scenario data | 12-turn definition validates with initial resources, decisions, events, and criteria |
| Nov 4 | Implement deterministic state-transition core | Pure transition tests pass for effect order, rounding, clamping, and turn advance |
| Nov 5 | Implement event triggers, seeded selection, and fallback catalog | Replays are stable by seed; fallback events work without an AI provider |
| Nov 6 | Add FastAPI run lifecycle endpoints | Create, inspect, decide, restart, and validation-error flows have API tests |
| Nov 7 | Add engine outcome records and terminal evaluation | Every transition is auditable; win/loss/turn-limit cases are tested |
| Nov 8 | Build app shell and core responsive layout | Navigation, scenario header, turn indicator, and empty/loading/error states render |
| Nov 9 | Build decision-card interaction | Allowed decisions display and submit once; disabled and rejected states are clear |
| Nov 10 | Build metrics and resource dashboard | Units, bounds, capacity, and deltas display from server-returned state |
| Nov 11 | Add Recharts trends | Metric history charts are readable, responsive, and accessible without color alone |
| Nov 12 | Add decision and event history | Ordered audit trail matches engine outcomes and survives page navigation |
| Nov 13 | Add `localStorage` save/resume/restart | Versioned saves restore safely; corrupt or incompatible saves fail gracefully |
| Nov 14 | Introduce configurable LLM provider interface | Provider config stays server-side; fake provider supports deterministic tests |
| Nov 15 | Generate and validate AI event candidates | Invalid, unsafe, late, and out-of-contract responses are rejected |
| Nov 16 | Generate grounded turn narratives | Narratives receive only recorded results and cannot alter numeric state |
| Nov 17 | Complete full 12-turn Startup Survival loop | A player can start, play, save, resume, and reach an ending without AI access |
| Nov 18 | Build ending report | Report summarizes result, metric trends, pivotal decisions, and event history |
| Nov 19 | MVP integration and failure-mode pass | Provider timeout, malformed output, refresh, duplicate action, and API errors tested |
| Nov 20 | Accessibility and responsive usability pass | Keyboard flow, focus, labels, contrast, mobile, and reduced-motion issues addressed |
| Nov 21 | Expand Pytest and Vitest coverage | Critical engine invariants and UI state branches have meaningful assertions |
| Nov 22 | Complete Playwright critical journeys | Happy path, save/resume, restart, fallback, and ending-report journeys pass |
| Nov 23 | Stretch spike: prompt-to-scenario generation | Timeboxed validated prototype or documented deferral; MVP remains unchanged |
| Nov 24 | Stretch spike: PDF/document/URL ingestion | Timeboxed provenance and injection-resistant pipeline prototype or deferral |
| Nov 25 | **Internal submission:** release candidate and demo freeze | Clean-machine runbook, demo script, compliance checklist, and RC tag candidate ready |
| Nov 26 | Contingency, rehearsal, and submission packaging | Only release-blocking fixes; backup demo and required assets prepared |
| Nov 27 | **Official submission by 5:00 PM EST (confirmed)** | Submit early, capture confirmation, and preserve final artifact references |

## Scope gates

### MVP gate

The MVP is complete only when Startup Survival supports 12 authoritative turns, decision cards, metrics and charts, validated AI events and grounded narratives, history, save/resume/restart, fallback gameplay, and an ending report.

### Stretch gate

Stretch work starts only after the November 22 critical journeys pass. In priority order:

1. Prompt-to-scenario generation
2. PDF and document-based scenarios
3. URL-based scenarios

Every generated scenario must pass the same structural and semantic validation as a curated scenario. Stretch work must not weaken offline/fallback behavior or destabilize the MVP.

## Schedule risks

- **Eligibility:** event-level student eligibility is confirmed, but personal eligibility and completed Devpost registration must be confirmed before submission.
- **AI latency or access:** use a fake provider during development and keep fallback events on the critical path.
- **Contract churn:** freeze `ScenarioDefinition` v1 after semantic validation and Startup Survival fixtures pass.
- **Save compatibility:** store contract and save-schema versions from the first persistence implementation.
- **Stretch pressure:** timebox spikes and prefer a polished, replayable MVP over partially integrated ingestion.
