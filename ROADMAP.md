# ScenarioLab Roadmap

This schedule runs daily from October 29 through November 27, 2026. It targets a reviewable MVP before the November 25 internal submission, leaving November 26 for contingency and November 27 for final submission only.

The official Devpost deadline is confirmed as November 27, 2026 at 5:00 PM EST. Personal eligibility and completed Devpost registration remain unconfirmed; see `docs/hackathon-compliance.md`.

## Verified progress

- ✅ **Brick 7.5 — Classic and Dark Mode — Complete:** centralized light/dark tokens, system-preference default, accessible in-app switching, independent preference persistence, themed charts and screens, and responsive visual/accessibility coverage are verified by Vitest, Playwright, and the production frontend build.
- ✅ **Brick 9A — AI Scenario Director architecture — Complete:** repository contracts and security controls were reviewed; the Startup Survival-only Director design, signed replay records, APIs, fallback, risks, acceptance criteria, and Brick 9B plan are documented in `docs/ai-scenario-director.md`.
- ✅ **Brick 9B-1 — Director engine, signed records, and deterministic replay — Complete:** fallback-only Startup Survival proposals, profile-bounded effects, shared transient engine path, HMAC proposal/receipt verification, stateless replay APIs, and tamper rejection are verified by 98 Pytest, 52 Vitest, production build, and 14 Playwright tests.
- ✅ **Brick 9B-2A — Director UI and v2 save/resume — Complete:** optional Startup Survival mode selection, fallback-only signed proposals/choices/previews/history, strict v2 save/replay, v1 scripted compatibility, disabled-mode Classic fallback, confirmation before replacing progress, and terminal report reuse. Verified by 98 Pytest, 64 Vitest, production build, 19 Playwright Chromium tests, a headed Director smoke test, three-turn reload/replay, tamper rejection, and desktop/mobile light/dark screenshot review. No live AI calls were made.
- ✅ **Brick 9B-2B — Live Director generation and mocked testing — Complete:** Startup Survival proposal endpoint supports strict provider candidates behind independent default-off flags, atomic profile/engine validation, signed replay, deterministic fallback, and pending-proposal save/restore. The diagnostics revision distinguishes transport, timeout, truncation, JSON/schema, profile, affordability, and semantic rejection while preserving fallback. Verified with 116 Pytest, 68 Vitest, production build, and 19 Playwright Chromium tests. One authorized live request returned HTTP 200, but its candidate was rejected and fallback returned; live integration remains unverified. Public billable generation remains blocked by shared rate limiting, direct-origin protection, and provider spending controls.

- ✅ **Brick 1 — Complete:** repository policy, product architecture, scenario contract, roadmap, and compliance tracker are documented.
- ✅ **Brick 2 — Complete:** React/Vite/Tailwind application shell, FastAPI health service, environment configuration, CORS, dependency locks, frontend tests, backend tests, and production frontend build are verified.
- ✅ **Brick 3 — Complete:** immutable Pydantic domain models, semantic validation, the Startup Survival definition, three-entry catalog, initial game state, scenario APIs, and catalog-driven frontend are verified.
- ✅ **Brick 4 — Complete:** pure deterministic turn resolution, recurring calculations, seeded predefined events, immutable outcome history, terminal evaluation, and generic-resource behavior are verified.
- ✅ **Brick 5 — Complete:** stateless replay-backed game APIs and a tested responsive Startup Survival browser flow are verified; planned scenarios remain unavailable.
- ✅ **Brick 6 — Complete:** OpenAI-compatible provider configuration, stateless grounded briefings, strict output validation, deterministic fallback, independent frontend loading, cost guards, and mocked failure coverage are verified. A single credentialed live-provider smoke test passed with the configured `gpt-4.1-mini` model.
- ✅ **Brick 7 — Complete:** Responsive scenario-driven dashboard, metadata-formatted KPI cards and accessible trend charts, authoritative decision/event history, versioned local save/resume through backend replay, terminal report, and AI briefing presentation are implemented and verified. Automated AI briefings remain mocked.
- ✅ **Brick 8A application/security prep — Verified:** Production settings validation, bounded request bodies/provider concurrency, safe AI-off default, static hosting configuration, security findings, submission/privacy notes, and all application test suites pass. The Render backend was provisioned under Brick 8B; its first startup failed during runtime settings loading.
- ⬜ **Brick 8A container build validation:** Dockerfile is prepared but not verified; the local Docker CLI cannot connect to the Docker Desktop Linux engine. Rerun image validation when the engine is available.
- ✅ **Brick 8B release-candidate preparation — Verified:** Fallback-only production settings, stable Director key-ring requirements, Render and Cloudflare Pages dashboard values, CORS/connectivity steps, public smoke plan, and rollback procedure are documented and covered by regression checks. Release checkpoint `d47c68c` is on `main`.
- ✅ **Brick 8B — Public deployment and smoke tests — Verified November 14, 2026:** The fallback-only Pages and Render deployment passed the production browser smoke. Startup Survival completed all 12 Classic turns; save, resume, restart, signed Director replay, and invalid-signature rejection passed; desktop and mobile themes/layouts were usable. Detailed results and screenshots are recorded below. Public demo ready with live AI generation disabled.
- ✅ **Brick 9C — Multi-scenario expansion — Production verified November 14, 2026 (release `170958b`):** Render and Cloudflare Pages serve the release. The hosted smoke test passed 22 of 22 checks: Cybersecurity Crisis and Space Colony 12-turn victories with final metrics identical to the local engine, a Space Colony Crew Breakdown failure, save/resume/restart, Startup Survival Classic victory, signed Director replay and tamper rejection, Director scoping, mobile Classic and Dark layouts, and Pages/Render-only traffic with fallback briefings. Details are in `docs/deployment.md`. Earlier local verification: Cybersecurity Crisis (12 rounds) and Space Colony (12 mission cycles) are playable as declarative `ScenarioDefinition` data on the unchanged engine. The additive contract changes are the `round`/`cycle` turn units, the `hours`/`days` metric units, and catalog `ai_features`, which scopes Director and live briefings to Startup Survival. The UI uses scenario-specific turn labels, metric formats, chart groups, and authored-briefing labels, and the Director is marked unavailable for the new scenarios. Verified by 154 Pytest (37 new), 80 Vitest (12 new), 27 Playwright Chromium (8 new: two 12-turn victories, terminal resume, restart, save/resume, tamper rejection, a failure report, mobile Classic/Dark, and cross-scenario save handling), and the production build. Engine balance sweeps found no dead ends in 10,000 random runs. Mechanics are in `docs/scenarios.md`.
- ✅ **Classic gameplay console redesign — Merged to `main` (PR #1, `799bf08`):** three-column Classic gameplay screen (status rail, decide view with effect chips and a sticky confirm bar, compact decision log) with charts in a Trends tab and per-category scenario accents. Verified by 83 Vitest, 27 Playwright Chromium, and the production build.
- ⬜ **Follow-up defect — Startup Survival low-cash softlock (pre-existing, not fixed in Brick 9C):** when cash falls below every decision's cost while expenses are already below the cost-cutting threshold, the run is active but offers no available decision. About 42% of uniformly random runs reach this state. A fix requires a reviewed Startup Survival scenario-data change (for example, an always-affordable decision), a new scenario version, and save-compatibility review. The engine must not change without explicit review.
- ⬜ **Follow-up — Render auto-deploy:** Render shows Auto-Deploy On Commit but received no push events. Pages deploys every push, so API-contract releases must deploy Render manually first. During Brick 9C this ordering gap caused a frontend/backend mismatch of about 45 minutes. Repair the Render GitHub connection or gate Pages builds after review.
- ⬜ **Devpost submission:** Prepare and submit final project materials after the internal November 25 target and before the official November 27 deadline.
- ✅ **Playwright E2E setup — Complete:** Playwright 1.64.1 and Chromium use isolated FastAPI/Vite startup on dedicated ports, protected AI-route mocking, deterministic real-engine gameplay, desktop/mobile coverage, save/resume after reload, terminal restoration/restart, and final-report journeys.

### Brick 8C — Public deployment verification (November 14, 2026)

| Area | Verified result |
| --- | --- |
| Backend and frontend | Pages loaded over HTTPS and made browser requests to the deployed Render API. Health, scenario catalog, scenario definition, and game routes returned HTTP 200. Warm health calls measured 99–292 ms; FastAPI responded with its healthy status. Render private startup logs were not inspected. |
| Classic Simulation | Seeded production run completed 12/12 turns and reached the Victory report. Automatic save, reload/resume at turn 4, terminal resume, and restart to a fresh turn 1 all passed. |
| Authored-fallback Director | Choices and authoritative previews advanced across six turns. Proposal and receipt signatures used HMAC-SHA256; valid replay resumed at turn 4. The run reached the authoritative Bankruptcy loss at turn 6. A tampered signed receipt was rejected with HTTP 422 invalid_director_signature; the original local save remained intact. |
| Themes and layout | Classic and Dark themes rendered at desktop and 390×844 mobile sizes. Mobile gameplay had no horizontal overflow. |
| Browser errors and network | No uncaught JavaScript errors or unexpected API statuses/hosts. The only console errors were from deliberately simulated HTTP 503/422 responses; the UI showed recoverable errors and preserved game state. |
| Cold starts and outages | No real Render cold start occurred during the smoke; warm health calls completed in 99–292 ms. A controlled 8-second API delay left the loading state visible and then recovered. Simulated catalog and turn HTTP 503 responses exposed retry/error states; catalog retry succeeded and failed turn submission did not mutate the saved run. |
| AI and cost | Briefing and Director endpoints returned deterministic/authored fallback content; no external provider host was contacted by Chromium. No production flags or keys were changed. Provider usage dashboards and private Render logs were not inspected. |
| Screenshots | Chromium screenshots for home, Classic progress and final report, Director previews/history/report, and mobile light/dark gameplay are in artifacts/production-smoke-2026-11-14T19-34-37-473Z/. |

The deployed fallback-only app is ready for a public demonstration. This verifies the user-facing deployment paths tested above; it does not verify Render private logs, provider-usage dashboards, or an actual Free-instance cold start.

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

Brick 9A, 9B-1, 9B-2A, and the mocked 9B-2B implementation are complete. Director mode and live generation both stay backend-disabled by default. One authorized smoke request fell back after candidate rejection; diagnostics were improved and verified with mocked responses only. Live integration remains unverified. Brick 8B public deployment can proceed independently and must not wait for Brick 9.

| Target date | Brick 9 milestone | Exit evidence |
| --- | --- | --- |
| Nov 6 | ✅ **Brick 9A:** complete architecture review | docs/ai-scenario-director.md covers current contracts, proposed policy and APIs, signed replay, lifecycle, threat mitigations, test plan, and 9B scope |
| Nov 6 | ✅ **Brick 9B-1:** implement and verify fallback Director engine/replay foundation | 98 Pytest, 52 Vitest, TypeScript production build, 14 Playwright; three-turn fallback replay and tampered-record rejection pass |
| Nov 7 | ✅ **Brick 9B-2A:** Director UI and signed v2 save/resume | 98 Pytest, 64 Vitest, production build, 19 Playwright Chromium, headed Director smoke, three-turn reload/replay, tamper rejection, and desktop/mobile light/dark screenshots pass |
| Nov 8 (completed ahead of target) | ✅ **Brick 9B-2B:** implement and diagnose mocked provider-owned proposals | 116 Pytest, 68 Vitest, production build, and 19 Chromium E2E tests pass; provider path is mocked and all live flags default off |
| Nov 8 (completed ahead of target) | ✅ **Brick 9B-2B:** pending proposal persistence and replay | Signed pending proposal is restored through replay with recomputed authoritative previews and no generation request |
| Nov 8 (completed ahead of target) | ✅ **Brick 9B-2B:** desktop/mobile and regression verification | Production build and 19 Playwright Chromium tests pass; no real provider calls |
| Attempted; remains unverified | ⬜ **Brick 9B-2B:** one controlled live-provider smoke test | One HTTP 200 response fell back after candidate rejection; no retries or further live requests |
| Nov 23 | ⬜ **Brick 9B:** security and deployment-readiness review | Request-size and per-process limits remain; public live generation stays disabled pending shared edge controls, origin protection, and provider spend controls |
| Nov 24 | ⬜ **Brick 9B:** release freeze or defer | Keep live-provider smoke and public enablement pending unless separately reviewed; Brick 8B fallback-only public smoke is verified independently |
| Nov 25 | **Internal submission:** choose the verified release candidate | Director may be included only if Brick 9B passed every gate; Brick 8B proceeds on its own schedule |

## Scope gates

### MVP gate

The existing MVP is complete when Startup Survival supports 12 authoritative turns, decision cards, metrics and charts, deterministic scripted events, grounded AI briefings, history, save/resume/restart, fallback gameplay, and an ending report. AI generated situations and choices belong to optional Brick 9B and are not a prerequisite for Brick 8B public deployment.

### Stretch gate

Brick 9B remains optional before the submission freeze. Brick 9B-2A and the mocked 9B-2B integration are implemented; live provider smoke and public billable generation are still gated. Prompt-to-scenario generation, document/URL ingestion, and Director support for scenarios other than Startup Survival remain out of scope until separately reviewed. Cybersecurity Crisis and Space Colony were added in Brick 9C as Classic-only scenarios. The Director and live generation stay disabled by default.

## Schedule risks

- **Eligibility:** event-level student eligibility is confirmed, but personal eligibility and completed Devpost registration must be confirmed before submission.
- **AI latency or access:** use a fake provider during development and keep fallback events on the critical path.
- **Contract churn:** freeze `ScenarioDefinition` v1 after semantic validation and Startup Survival fixtures pass.
- **Save compatibility:** store contract and save-schema versions from the first persistence implementation.
- **Stretch pressure:** timebox spikes and prefer a polished, replayable MVP over partially integrated ingestion.
