# ScenarioLab Roadmap

This schedule runs daily from October 29 through November 27, 2026. It targets a reviewable MVP before the November 25 internal submission, leaving November 26 for contingency and November 27 for final submission only.

The official Devpost deadline is confirmed as November 27, 2026 at 5:00 PM EST. Personal eligibility and completed Devpost registration remain unconfirmed; see `docs/hackathon-compliance.md`.

## Verified progress

- ✅ **Brick 7.5 — Classic and Dark Mode — Complete:** centralized light/dark tokens, system-preference default, accessible in-app switching, independent preference persistence, themed charts and screens, and responsive visual/accessibility coverage are verified by Vitest, Playwright, and the production frontend build.
- ✅ **Brick 9A — AI Scenario Director architecture — Complete:** repository contracts and security controls were reviewed; the Startup Survival-only Director design, signed replay records, APIs, fallback, risks, acceptance criteria, and Brick 9B plan are documented in `docs/ai-scenario-director.md`.
- ✅ **Brick 9B-1 — Director engine, signed records, and deterministic replay — Complete:** fallback-only Startup Survival proposals, profile-bounded effects, shared transient engine path, HMAC proposal/receipt verification, stateless replay APIs, and tamper rejection are verified by 98 Pytest, 52 Vitest, production build, and 14 Playwright tests. No live AI or Director UI is included.
- ⬜ **Brick 9B-2 — Director provider integration, browser saves, and UI — Planned:** add only after review; use fake providers in automated tests, require both AI flags, and preserve the Brick 8A security controls.

- ✅ **Brick 1 — Complete:** repository policy, product architecture, scenario contract, roadmap, and compliance tracker are documented.
- ✅ **Brick 2 — Complete:** React/Vite/Tailwind application shell, FastAPI health service, environment configuration, CORS, dependency locks, frontend tests, backend tests, and production frontend build are verified.
- ✅ **Brick 3 — Complete:** immutable Pydantic domain models, semantic validation, the Startup Survival definition, three-entry catalog, initial game state, scenario APIs, and catalog-driven frontend are verified.
- ✅ **Brick 4 — Complete:** pure deterministic turn resolution, recurring calculations, seeded predefined events, immutable outcome history, terminal evaluation, and generic-resource behavior are verified.
- ✅ **Brick 5 — Complete:** stateless replay-backed game APIs and a tested responsive Startup Survival browser flow are verified; planned scenarios remain unavailable.
- ✅ **Brick 6 — Complete:** OpenAI-compatible provider configuration, stateless grounded briefings, strict output validation, deterministic fallback, independent frontend loading, cost guards, and mocked failure coverage are verified. A single credentialed live-provider smoke test passed with the configured `gpt-4.1-mini` model.
- ✅ **Brick 7 — Complete:** Responsive scenario-driven dashboard, metadata-formatted KPI cards and accessible trend charts, authoritative decision/event history, versioned local save/resume through backend replay, terminal report, and AI briefing presentation are implemented and verified. Automated AI briefings remain mocked.
- ✅ **Brick 8A application/security prep — Verified:** Production settings validation, bounded request bodies/provider concurrency, safe AI-off default, static hosting configuration, security findings, submission/privacy notes, and all application test suites pass. No infrastructure has been provisioned or deployed.
- ⬜ **Brick 8A container build validation:** Dockerfile is prepared but not verified; the local Docker CLI cannot connect to the Docker Desktop Linux engine. Rerun image validation when the engine is available.
- ⬜ **Brick 8B — Public deployment:** Configure and verify hosting, HTTPS, edge rate limiting, origin protection, operational monitoring, and public browser journeys after approval.
- ⬜ **Devpost submission:** Prepare and submit final project materials after the internal November 25 target and before the official November 27 deadline.
- ✅ **Playwright E2E setup — Complete:** Playwright 1.64.1 and Chromium use isolated FastAPI/Vite startup on dedicated ports, protected AI-route mocking, deterministic real-engine gameplay, desktop/mobile coverage, save/resume after reload, terminal restoration/restart, and final-report journeys.

## Daily milestones

| Date | Check / Status | Milestone | Exit evidence |
| --- | --- | --- | --- |
| Oct 29 | ✅ Complete | **Brick 1:** repository foundation and architecture | Six foundation documents reviewed; contract and trust boundaries documented |
| Oct 30 | ✅ Official links recorded; ⬜ remaining confirmation | Confirm hackathon rules and lock MVP acceptance criteria | Official-source links recorded; open compliance questions resolved or assigned |
| Oct 31 | ✅ Complete | **Brick 2:** scaffold frontend/API workspaces and developer commands | React build and tests pass; FastAPI health test and live smoke test pass; commands documented |
| Nov 1 | ✅ Complete | **Brick 3:** implement Pydantic `ScenarioDefinition` and game-state models | Full definition validates, serializes, exports schema, and remains deeply immutable |
| Nov 2 | ✅ Complete | **Brick 3:** add semantic validation and predefined catalog | Cross-reference, bounds, predicate, effect, catalog, and API behavior covered by Pytest |
| Nov 3 | ✅ Complete | **Brick 3:** define Startup Survival v1 scenario data | 12-turn definition validates with seven metrics, three actions, events, and terminal criteria |
| Nov 4 | ✅ Complete | Implement deterministic state-transition core | Pure transition tests pass for effect order, strict bounds, resource exhaustion, and turn advance |
| Nov 5 | ✅ Complete | Implement event triggers, seeded selection, and fallback catalog | Replays are stable by seed; predefined events work without an AI provider |
| Nov 6 | ✅ Complete | Add stateless FastAPI game lifecycle endpoints | Start, replay, decide, restart-via-start, terminal, and validation-error flows have API tests |
| Nov 7 | ✅ Complete | Add engine outcome records and terminal evaluation | Every transition is auditable; win/loss/turn-limit cases are tested |
| Nov 8 | ✅ Complete | Build app shell and core responsive gameplay layout | Navigation, scenario header, turn indicator, and empty/loading/error states render |
| Nov 9 | ✅ Complete | Build decision-card interaction | Allowed decisions display and submit once; disabled and rejected states are clear |
| Nov 10 | ✅ Complete | Build responsive metrics and resource dashboard | Metadata-driven KPI cards show server values, units, and favorable-direction deltas |
| Nov 11 | ✅ Complete | Add reusable metric trend charts | Accessible SVG charts show initial and recorded turn values without inferred data or new dependencies |
| Nov 12 | ✅ Complete | Add decision and event history | Ordered timeline displays accepted decisions, authoritative events, metric changes, status, and separate briefing text |
| Nov 13 | ✅ Complete | Add versioned `localStorage` save/resume/restart | Exact replay identity is saved; resume validates scenario version and reconstructs through stateless endpoints |
| Nov 14 | ✅ Complete | Introduce configurable LLM provider interface | Provider config stays server-side; mocked provider and deterministic fallback tests pass |
| Nov 15 | ⬜ Upcoming | Prepare the Brick 9B implementation gate | Confirm the pinned Startup Survival profile, strict candidate schema, and fake-provider-only verification plan |
| Nov 16 | ✅ Complete | Generate grounded turn narratives | Stateless replay grounds validated briefings; one live configured-provider smoke request returned a validated briefing |
| Nov 17 | ✅ Complete | Complete full 12-turn Startup Survival loop | Browser run reaches an engine-defined terminal state; saved action history restores the same result |
| Nov 18 | ✅ Complete | Build ending report | Terminal report shows authoritative reason, turns, initial/final metrics, decision/event recap, and final trends |
| Nov 19 | ✅ Complete | MVP integration and failure-mode pass | Rejected turns preserve the accepted state/save; storage, corrupt save, incompatible version, and AI failure paths are covered |
| Nov 20 | ✅ Complete | Accessibility and responsive usability pass | Keyboard controls, focus indicators, announcements, chart alternatives, contrast, mobile layout, and overflow are reviewed |
| Nov 21 | ✅ Complete | Expand Pytest and Vitest coverage | Backend and frontend suites pass; charts, persistence, replay, and report behavior have direct assertions |
| Nov 22 | ✅ Complete | Complete Playwright critical journeys | Dedicated-port Chromium suite passes dashboard, three-turn history/charts, reload/resume, terminal restoration/restart, mocked AI, and mobile checks |
| Nov 23 | ⬜ Upcoming | Brick 9B security and deployment-readiness review | Public Director generation stays off pending shared edge limits, origin protection, and provider spend controls |
| Nov 24 | ⬜ Upcoming | Brick 9B release freeze or defer | Include Director only if every acceptance criterion passes; otherwise keep the existing MVP release candidate |
| Nov 25 | ⬜ Upcoming | **Internal submission:** release candidate and demo freeze | Clean-machine runbook, demo script, compliance checklist, and RC tag candidate ready |
| Nov 26 | ⬜ Upcoming | Contingency, rehearsal, and submission packaging | Only release-blocking fixes; backup demo and required assets prepared |
| Nov 27 | ⬜ Upcoming | **Official submission by 5:00 PM EST (confirmed)** | Submit early, capture confirmation, and preserve final artifact references |

## Brick 9 delivery milestones

Brick 9A is complete as an architecture review. Brick 9B is the only planned implementation and remains optional to the November 25 submission: if its security, replay, or regression gates slip, keep Director disabled and proceed with the existing MVP. Brick 8B public deployment can proceed independently and must not wait for Brick 9.

| Target date | Brick 9 milestone | Exit evidence |
| --- | --- | --- |
| Nov 6 | ✅ **Brick 9A:** complete architecture review | `docs/ai-scenario-director.md` covers current contracts, proposed policy and APIs, signed replay, lifecycle, threat mitigations, test plan, and 9B scope |
| Nov 6 | ✅ **Brick 9B-1:** implement and verify fallback Director engine/replay foundation | 98 Pytest, 52 Vitest, TypeScript production build, 14 Playwright; three-turn fallback replay and tampered-record rejection pass |
| Nov 16–18 | **Brick 9B-2:** add provider-owned structured proposals behind both backend flags | Candidate JSON is validated against the pinned profile; provider remains mocked in automated tests |
| Nov 19–20 | **Brick 9B-2:** add strict v2 browser save/resume and pending proposal persistence | Signed records replay without regeneration; v1 scripted saves continue unchanged |
| Nov 21 | **Brick 9B-2:** present situations, choices, previews, source badge, and history in existing themed UI | No redesign; generated and curated events remain separate; resume/restart behavior verified |
| Nov 22 | **Brick 9B-2:** run focused and full regression suites | Effect boundaries, lifecycle, replay, security, accessibility, frontend, backend, and Playwright suites pass with fake providers only |
| Nov 23 | **Brick 9B:** security and deployment-readiness review | Request-size and per-process limits are retained; public live generation remains disabled pending shared edge controls, origin protection, and provider spend controls |
| Nov 24 | **Brick 9B:** release freeze or defer | Merge only if acceptance criteria pass; otherwise defer Director and freeze the current MVP |
| Nov 25 | **Internal submission:** choose the verified release candidate | Director may be included only if Brick 9B passed every gate; Brick 8B proceeds on its own schedule |

## Scope gates

### MVP gate

The existing MVP is complete when Startup Survival supports 12 authoritative turns, decision cards, metrics and charts, deterministic scripted events, grounded AI briefings, history, save/resume/restart, fallback gameplay, and an ending report. AI generated situations and choices belong to optional Brick 9B and are not a prerequisite for Brick 8B public deployment.

### Stretch gate

Brick 9B is the only planned stretch feature before the submission freeze. Do not begin prompt-to-scenario generation, document/URL ingestion, or support for additional scenarios during Brick 9B. The Director remains optional: incomplete replay integrity, effect validation, security, or regression work means defer it and submit the existing MVP.

## Schedule risks

- **Eligibility:** event-level student eligibility is confirmed, but personal eligibility and completed Devpost registration must be confirmed before submission.
- **AI latency or access:** use a fake provider during development and keep fallback events on the critical path.
- **Contract churn:** freeze `ScenarioDefinition` v1 after semantic validation and Startup Survival fixtures pass.
- **Save compatibility:** store contract and save-schema versions from the first persistence implementation.
- **Stretch pressure:** timebox spikes and prefer a polished, replayable MVP over partially integrated ingestion.
