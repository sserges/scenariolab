# ScenarioLab

ScenarioLab is a decision-simulation platform. Players make bounded decisions, a deterministic simulation engine calculates their numeric consequences, and optional AI can supply validated explanations and candidate Director situations without becoming the source of truth. Game events are curated scenario data; AI does not generate or select events.

The first playable definition is **Startup Survival**: manage a startup over 12 monthly turns, balance resources and operating metrics, respond to events, and receive an ending report. The official catalog also includes **Cybersecurity Crisis** and **Space Colony**, which remain clearly marked as planned until their complete definitions and tests exist.

## Project status

**Bricks 1–6 are complete and verified.** Brick 6's real-provider smoke test succeeded once with the configured `gpt-4.1-mini` model. After each accepted turn, the browser independently requests a grounded strategic briefing; metrics update without waiting for AI, and provider failure never blocks play.

**Brick 7: gameplay dashboard and persistence** is complete. The gameplay screen includes metadata-driven KPI cards and accessible trend charts, an authoritative decision timeline, versioned local save/resume through deterministic backend replay, and an engine-grounded terminal report. AI briefings remain explanatory and are mocked in automated tests. No additional scenarios, event generation, or document imports were added.

**Brick 8A: deployment and security readiness** is prepared locally: safe production configuration, request and provider concurrency bounds, container and static-host guidance, and submission documentation are in place. The Render backend service has been created, but its first startup failed during runtime settings loading and it has not passed health checks. The initial Pages frontend deployment is tracked under Brick 8B. Shared edge rate limiting and origin protection remain required before enabling billable AI on a public endpoint.

**Brick 8B: public release candidate preparation** is complete at release commit `d47c68c`. Cloudflare Pages created the `scenariolab` project and reported its first deployment successful at [`https://scenariolab-38a.pages.dev`](https://scenariolab-38a.pages.dev). The Render Free service [`https://scenariolab.onrender.com`](https://scenariolab.onrender.com) was created from `d47c68c`; its remote Docker image built successfully, but the first startup failed during runtime settings loading and `/api/health` did not pass. Pages is not connected to a healthy API and public browser smoke tests remain pending. The workspace overage protection was confirmed by the user; the Render service remains on the `$0/month` Free plan. The fallback configuration keeps `SCENARIOLAB_AI_ENABLED=false` and `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED=false`; no provider key is configured and no provider requests were made. See [docs/deployment.md](docs/deployment.md) for the verified checkpoint, startup recovery, stable signing key handling, smoke plan, and rollback steps. Brick 8B public deployment remains unchecked; local Docker image verification is pending because the Docker engine is unavailable.

**Brick 9B-2A and Brick 9B-2B: Director gameplay and mocked live-generation integration** are implemented and verified. One separately authorized live smoke request returned HTTP 200, but the generated candidate was rejected and authored fallback was returned; live generation remains unverified. Startup Survival offers Classic Simulation and an optional AI Scenario Director mode. Director stays disabled unless `SCENARIOLAB_DIRECTOR_ENABLED=true` and signing keys are configured. Live proposal generation also requires `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED=true` and `SCENARIOLAB_AI_ENABLED=true`; both live flags default to false. Valid AI candidates are signed only after strict profile validation and deterministic engine previews. Provider failure or invalid output selects deterministic authored fallback. Version-2 saves preserve the signed pending proposal and completed records; version-1 Classic saves remain unchanged. Public billable generation remains blocked on shared rate limits, origin-bypass protection, and provider spending controls.

**Brick 9C: multi-scenario expansion** is implemented and locally verified. Cybersecurity Crisis (12 rounds) and Space Colony (12 mission cycles) are now playable as validated `ScenarioDefinition` data on the unchanged engine. Startup Survival keeps both of its modes. The catalog's `ai_features` field scopes the AI Scenario Director and live briefings to Startup Survival. The new scenarios use deterministic Classic Simulation with authored briefings, and they never call an AI provider. Local verification: 154 Pytest, 80 Vitest, 27 Playwright Chromium tests, and the production build. This change has not been deployed. See [docs/scenarios.md](docs/scenarios.md).

## Official predefined scenarios

| Scenario | Objective | Status |
| --- | --- | --- |
| Startup Survival | Keep a startup alive for 12 simulated months | Playable: Classic and optional AI Scenario Director |
| Cybersecurity Crisis | Contain an escalating attack within 12 rounds while keeping operations running | Playable: Classic Simulation |
| Space Colony | Sustain a 50-astronaut Mars colony for 12 mission cycles | Playable: Classic Simulation |

Only an `available` entry may be resolved to a full `ScenarioDefinition`. The API still returns HTTP 409 for any entry marked `planned`. Mechanics, metrics, decisions, events, victory and failure conditions, and balance evidence are in [docs/scenarios.md](docs/scenarios.md).

## MVP

- Startup Survival with 12 turns
- Decision cards with explicit, allowed effects
- Current metrics, resource displays, and charts
- Curated deterministic events and validated AI narrative briefings
- Deterministic Python calculations for authoritative outcomes
- Decision and event history
- Local save, resume, and restart
- Win/loss evaluation and an ending report
- Deterministic fallback briefings when the configured AI provider is unavailable
- Optional AI Scenario Director mode for Startup Survival with signed live proposals or deterministic authored fallback

Implementation order is Startup Survival first, then Cybersecurity Crisis and Space Colony after the reusable engine and MVP loop are proven. Prompt, document, and URL scenario generation remain stretch work after the predefined MVP is stable.

## Architecture at a glance

ScenarioLab separates scenario data from calculation:

1. A versioned `ScenarioDefinition` describes a scenario as validated data.
2. Separate `ScenarioCatalogEntry` records advertise available and planned scenarios without exposing incomplete definitions.
3. An initial immutable `GameState` copies metric values from a definition without evaluating a decision or turn.
4. The Python engine validates actions, applies declared effects and recurring rules, enforces bounds, selects predefined events, advances turns, evaluates terminal criteria, and returns immutable outcome records.
5. The stateless gameplay API replays accepted action IDs and returns server-calculated state and outcomes; the React client only renders those authoritative values.
6. Optional AI services receive only bounded replayed facts. The briefing service validates narrative output; the Director validates candidate choices against its profile and previews them through the deterministic engine. Both use deterministic fallback and neither can alter authoritative state or choose curated events.

See [docs/architecture.md](docs/architecture.md) for the contract and trust boundaries.

## Demo instructions

1. Start the FastAPI backend and Vite frontend using the local run commands below.
2. Select **Startup Survival**, then choose **Classic Simulation** or **AI Scenario Director**. Director is backend-gated and labels each situation **AI generated** or **Authored fallback**.
3. Complete at least three decisions, then inspect KPI cards, trend charts, events, source indicators, and the decision timeline.
4. Reload the browser and choose **Continue Saved Game** to demonstrate replay-based resume. Classic saves replay ordered action IDs; Director saves replay signed records.
5. Continue until the engine ends the run, review the terminal report, then restart after confirming replacement of saved progress.

The demo works with all live AI disabled: Classic gameplay and briefings use deterministic behavior, and Director gameplay uses authored fallback situations when its independent mode flag and signing key are configured. Cybersecurity Crisis and Space Colony are fully playable in Classic Simulation with authored content and never call an AI provider.

## AI implementation and assisted-development disclosure

The Python engine owns all state and numeric outcomes. After a completed turn, the briefing path can send a minimal engine-grounded context to the configured OpenAI-compatible endpoint and validate five narrative fields. The Director proposal path can send sanitized Startup Survival state and policy context, then validate a bounded situation and two to four proposed choices. It does not accept model-generated state values, metrics, rules, events, or calculations. The Python application checks affordability and effect limits, previews every choice through the deterministic engine, signs only the fully valid proposal, and falls back to authored content on any live-path failure. The configured example model is `gpt-4.1-mini`; Brick 6's briefing smoke request was verified once. One separately authorized Director smoke request returned HTTP 200, but its candidate was rejected and signed authored fallback was returned. No further live request is authorized; all diagnostics tests use fake providers or HTTP mocks.

OpenAI Codex was used as a coding assistant for application implementation, tests, and documentation. The developer directed the work and reviewed the resulting changes. Direct dependencies are credited by the package manifests and lockfiles: React, TypeScript, Vite, Tailwind CSS, FastAPI, Pydantic, HTTPX, Uvicorn, Pytest, Vitest, Testing Library, and Playwright. Exact resolved versions are recorded in `frontend/package-lock.json` and `backend/uv.lock`. There are no bundled third-party image or font assets.

## Privacy notes

ScenarioLab has no accounts, authentication, analytics SDK, or user profile fields. The browser stores one run at a time in local storage. Classic format 1 contains scenario ID/version, seed, and accepted action IDs. Director format 2 contains scenario/version, original seed, mode/profile identity, completed signed turn records, and an optional signed pending proposal for the current unselected turn. Neither format stores metrics or status; Director saves contain no signing secrets, provider credentials, raw prompts, or unsigned effects. Game requests send replay inputs to the backend. If live AI is enabled, the backend sends a compact simulation context to the configured provider; do not include personal or confidential information in scenario content. Hosting providers may retain request metadata in operational logs, so review retention and access settings before a public release. The app does not promise provider-side retention behavior.

## Known limitations

- AI Scenario Director and live briefings are limited to Startup Survival. Cybersecurity Crisis and Space Colony use authored, deterministic content only.
- One local save slot is shared by all scenarios. Starting a new run in any scenario replaces it after confirmation.
- Startup Survival (unchanged in Brick 9C) can reach a non-terminal turn with no affordable decision when cash runs very low. About 42% of uniformly random runs hit this. The two new scenarios are tested to never reach such a state.
- Saves are local to one browser profile; there is no account, server persistence, or cross-device sync.
- Public API authentication and shared distributed rate limiting are not implemented.
- Production live AI must remain disabled until the API origin is protected by effective shared edge limits, provider project budgets, and an operator-reviewed monitoring plan.
- No healthy backend or API-integrated public release has passed smoke tests; no Devpost submission has been performed.

## Intended stack

| Area | Technology |
| --- | --- |
| Web | React, TypeScript, Vite, Tailwind CSS, accessible SVG charts |
| API and engine | Python, FastAPI, Pydantic |
| AI | OpenAI-compatible Chat Completions API behind an application-owned interface |
| Persistence | `localStorage` initially |
| Tests | Pytest, Vitest, Playwright |

Third-party technology credits: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/), [FastAPI](https://fastapi.tiangolo.com/), [Pydantic](https://docs.pydantic.dev/), [HTTPX](https://www.python-httpx.org/), [Uvicorn](https://www.uvicorn.org/), [Pytest](https://pytest.org/), [Vitest](https://vitest.dev/), [Testing Library](https://testing-library.com/), and [Playwright](https://playwright.dev/). Exact resolved versions are in the checked-in lockfiles; this is a direct-dependency credit list, not a full license or vulnerability audit.

## Prerequisites

- Node.js 24 and npm 11 (the versions verified for Brick 2)
- Python 3.12 through 3.14
- [`uv`](https://docs.astral.sh/uv/) 0.13 or newer for Python environment and dependency management

`uv` can locate or provision a compatible Python runtime without changing the system-wide Python configuration.

## Installation

Install each application's dependencies from the repository root:

```powershell
cd frontend
npm install

cd ../backend
uv sync --dev
```

Install the Chromium binary used by Playwright after frontend dependencies are installed:

```powershell
cd frontend
npx playwright install chromium
```

Both applications provide an environment template. The checked-in defaults work together locally, so copying them is optional until a value needs to change:

```powershell
Copy-Item frontend/.env.example frontend/.env
Copy-Item backend/.env.example backend/.env
```

Only variables prefixed with `VITE_` are exposed to browser code. Keep backend configuration and secrets out of the frontend environment.

## Run locally

Start the backend in one terminal:

```powershell
cd backend
uv run uvicorn scenariolab_api.main:app --reload
```

The API is available at `http://localhost:8000`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Service availability |
| `GET /api/scenarios` | Metadata for all three official scenarios |
| `GET /api/scenarios/{scenario_id}` | Validated definition for an available scenario |
| `POST /api/games/start` | Start a fresh stateless simulation |
| `POST /api/games/turn` | Replay prior actions and resolve one new decision |
| `POST /api/ai/briefing` | Replay completed actions and narrate the latest outcome |
| `POST /api/ai/director/proposal` | Replay Director history and return a signed live or authored-fallback proposal with engine previews |
| `POST /api/ai/director/turn` | Verify and resolve one selected signed Director choice |
| `POST /api/ai/director/replay` | Verify signed Director history, optionally verify/preview a pending proposal, and reconstruct authoritative state |

Planned scenario details return HTTP 409 with `scenario_not_available`; unknown IDs return HTTP 404 with `scenario_not_found`.

Start the frontend in a second terminal:

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`. The header reports **API Connected** when the health endpoint returns the expected contract and **API Unavailable** when it cannot be reached.

## Optional live AI configuration

The backend uses an OpenAI-compatible Chat Completions endpoint. Copy `backend/.env.example` to the ignored `backend/.env`, then set these backend-only values:

| Variable | Purpose | Default/limit |
| --- | --- | --- |
| `SCENARIOLAB_ENVIRONMENT` | Settings validation profile; production requires HTTPS origins | `development` |
| `SCENARIOLAB_AI_ENABLED` | Explicit live-AI switch; false always selects fallback | `false` |
| `SCENARIOLAB_DIRECTOR_ENABLED` | Independently enables the signed Director mode | `false` |
| `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED` | Enables live Director candidate generation when AI is also enabled | `false` |
| `SCENARIOLAB_AI_API_KEY` | Provider credential; inject only on the backend | empty |
| `SCENARIOLAB_AI_MODEL` | Provider model identifier | `gpt-4.1-mini` example |
| `SCENARIOLAB_AI_BASE_URL` | Operator-controlled API root | `https://api.openai.com/v1` |
| `SCENARIOLAB_AI_TIMEOUT_SECONDS` | Whole provider request timeout | `10`, allowed `1..30` |
| `SCENARIOLAB_AI_MAX_RESPONSE_TOKENS` | Briefing output cap | `500`, allowed `100..800` |
| `SCENARIOLAB_DIRECTOR_MAX_RESPONSE_TOKENS` | Director structured-proposal output cap | `800`, allowed `100..800` |
| `SCENARIOLAB_AI_PROVIDER_CALLS_PER_MINUTE` | Per-process, per-caller provider-attempt guard | `20`, allowed `1..120` |
| `SCENARIOLAB_AI_MAX_CONCURRENT_PROVIDER_CALLS` | Per-process in-flight provider limit | `2`, allowed `1..32` |
| `SCENARIOLAB_MAX_REQUEST_BODY_BYTES` | API request body limit | `65536`, allowed `1024..1048576` |

Live AI is disabled by default even when a key and model are present. Set `SCENARIOLAB_AI_ENABLED=true` deliberately to enable briefings. Live Director generation has an additional independent gate: both `SCENARIOLAB_DIRECTOR_ENABLED=true` and `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED=true` are required, along with a valid signing key ring and provider credentials. Production mode requires an HTTPS frontend origin and HTTPS provider URL. Never place the key in `frontend/.env`, a `VITE_` variable, source control, logs, saves, image build arguments, or prompts. The browser cannot select the model or provider URL. Automated tests use mocked providers or fallback-only configuration.

For local live-provider use only, explicitly set `SCENARIOLAB_AI_ENABLED=true` in the ignored backend environment file and provide the configured model and secret key. The one authorized Director smoke request returned fallback; its exact rejection cause remains unknown because the harness did not preserve `finish_reason` or a diagnostic code. The diagnostics revision is verified with mocks only. Automated tests never require provider settings.

## Optional AI Scenario Director

Director mode is available only for Startup Survival and only when `SCENARIOLAB_DIRECTOR_ENABLED` and HMAC signing configuration are present. The mode flag defaults to false and is independent from `SCENARIOLAB_AI_ENABLED`; live generation additionally requires `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED`, also false by default. The frontend respects structured disabled responses and never receives provider or signing keys.

For controlled local fallback validation, set these backend-only values:

```text
SCENARIOLAB_DIRECTOR_ENABLED=true
SCENARIOLAB_DIRECTOR_ACTIVE_SIGNING_KEY_ID=director-local
SCENARIOLAB_DIRECTOR_SIGNING_KEYS={"director-local":"<at least 32 random UTF-8 bytes>"}
```

Signing keys stay on the backend. The browser never receives them. A v2 save may include the current signed, unselected proposal. On restore, `/api/ai/director/replay` reconstructs completed history, verifies the proposal's HMAC and state/turn/seed/history bindings, and returns fresh authoritative previews without an LLM request. If no pending proposal is saved, the browser requests one only for the current incomplete turn. Completed turns are never regenerated. The proposal endpoint accepts only a strict JSON situation and 2–4 choices; the backend assigns stable IDs, rejects unknown metrics/operators, repeated families/headlines, unsupported numeric narrative claims, unaffordable or over-budget effects, and any option that fails full-turn preview. It signs only after all choices pass. Any disabled, unavailable, timed-out, malformed, oversized, schema-invalid, or semantically invalid live response falls back to the deterministic authored catalog. The UI labels each proposal as **AI generated** or **Authored fallback**.

Director requests strict JSON Schema output from the candidate Pydantic model, then runs the same authoritative profile and engine checks. `finish_reason: "length"` is logged as `output_truncated`; provider and validation diagnostics expose only stable codes. The prior smoke response used 494 of 500 completion tokens, but its finish reason was not captured, so truncation is unconfirmed. Director now has a separate bounded output cap (`SCENARIOLAB_DIRECTOR_MAX_RESPONSE_TOKENS`, default 800); the briefing cap stays at 500.

Generation uses one provider attempt per proposal request, the existing bounded provider timeout/token/rate/concurrency controls, a 12 KB prompt-context cap, a 16 KB provider-response cap, and a bounded exact-context cache of semantically valid candidates. It makes no automatic retries. Limits and cache are process-local and do not enforce a global or per-run cost ceiling. To immediately disable live Director generation, set `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED=false` and restart every API process; `SCENARIOLAB_AI_ENABLED=false` also disables it. Live public generation remains off until shared rate limiting, direct-origin bypass protection, and provider spending controls are in place. Do not use a public live endpoint before those blockers are resolved.

### Live-provider smoke result and diagnostics

One authorized smoke request returned HTTP 200 but the live candidate was rejected; deterministic authored fallback succeeded. No further real requests are authorized. The diagnostics work is mocked only. It records a sanitized failure category and handles `finish_reason` for future local diagnostics; it does not expose raw provider content. Any future live request requires new explicit authorization and should use the one-request harness, with retries disabled and no browser-triggered generation.

`POST /api/ai/briefing` accepts only replay identity, never metrics or narrative claims:

```json
{
  "scenario_id": "startup-survival",
  "scenario_version": "1.0.0",
  "seed": 42,
  "action_history": ["reduce-operating-expenses"]
}
```

```json
{
  "source": "fallback",
  "headline": "Reduce Operating Expenses Sets the Course",
  "situation_summary": "The team chose Reduce Operating Expenses: Cut discretionary spending and renegotiate services to extend the company's runway.",
  "consequence_explanation": "The authoritative engine recorded these movements: Cash decreased, Monthly Expenses decreased, Customer Satisfaction decreased, Team Morale decreased.",
  "strategic_insight": "Keep close watch on Cash, Customer Satisfaction, Team Morale after this tradeoff.",
  "next_turn_teaser": "A future turn may test whether this choice remains resilient as conditions change."
}
```

The server reconstructs the exact latest `TurnResult`, supplies the scenario objective, action, optional triggered event, metric changes, current metrics, status, and outcome reason as established facts, then accepts only the five bounded response strings. Malformed JSON, timeouts, rate limits, HTTP errors, oversized responses, unsupported numeric claims, and missing configuration all produce `source: "fallback"` without exposing provider details.

The browser requests at most one briefing after each accepted turn in a single 12-turn run. Identical live contexts are cached in a bounded per-process cache, provider output is token-limited, provider concurrency is bounded, and requests are not retried. These are per-instance cost controls, not a public abuse guarantee: attackers can submit distinct histories, and multiple replicas multiply the in-process limits. Before enabling live AI publicly, place a shared gateway/WAF in front of the API, ensure the origin cannot be reached around it, and configure provider project/model restrictions, spend alerts, and a hard spending limit. A spend alert alone does not stop API traffic, and hard-limit enforcement can lag slightly; see [OpenAI's spend limits guide](https://developers.openai.com/api/docs/guides/spend-limits).

## Deployment readiness

See [docs/deployment.md](docs/deployment.md) for exact Render and Cloudflare Pages settings, the verified Pages checkpoint, fallback-only production variables, stable signing key handling, HTTPS/CORS, health checks, release smoke plan, and rollback steps. Pages is deployed and its initial build reported successful; the Render Free service's remote image build succeeded, but its first startup and health check failed. The API-integrated public release remains unverified.

## Run tests and builds

```powershell
cd backend
uv run pytest

cd ../frontend
npm test
npm run build
npm run test:e2e
```

Frontend component tests use Vitest and React Testing Library. Backend endpoint tests use Pytest and HTTPX. Playwright starts an isolated FastAPI server on `127.0.0.1:8010` and Vite on `127.0.0.1:5174`; it does not target a deployed or production environment.

### Playwright browser tests

The Chromium project runs headlessly by default with screenshots on failure, trace capture on the first retry, and an HTML report:

```powershell
cd frontend

# Headless Chromium suite
npm run test:e2e

# Visible Chromium browser
npm run test:e2e:headed

# Interactive Playwright UI
npm run test:e2e:ui

# Open the most recent HTML report
npm run test:e2e:report
```

The E2E fixture injects seed `42` into the real game-start request for repeatability while all start and turn calculations still execute in FastAPI. It intercepts every browser `POST /api/ai/briefing`, validates the replay identity/history, and returns a schema-valid mock briefing. The Playwright backend process also overrides `SCENARIOLAB_AI_API_KEY` to empty as defense in depth. The real key in ignored `backend/.env` is never read into the E2E provider, printed, recorded in traces, or sent over the network. Tests that expect a briefing assert the mocked headline and call count, so a missing interception fails rather than silently passing.

The Playwright backend receives a fixed test-only Director signing key from `playwright.config.ts`; it is server-side test configuration and is never sent to the browser. Both AI switches are explicitly disabled, so no automated browser journey can make a provider request. The suite exercises signed proposal/turn/replay endpoints, pending-proposal reload restoration without regeneration, tamper rejection, a disabled-Director response, Classic regression journeys, and mobile theme layouts.

If Chromium is missing or Playwright reports an executable error, run:

```powershell
cd frontend
npx playwright install chromium
npx playwright install --list
```

On Windows, allow the browser download and user-cache write if prompted. If an E2E server port is already occupied, stop the stale local process on `5174` or `8010` and rerun. Generated reports, traces, screenshots, and `test-results` are ignored by Git.

## Project structure

```text
frontend/
  e2e/                   Playwright browser journeys and protected AI mock fixture
  src/
    components/           Reusable React UI, including API status
    lib/                  Browser API client and response validation
    test/                 Shared Vitest setup
  .env.example            Public Vite configuration template
  package.json            Frontend scripts and dependencies
  playwright.config.ts    Isolated Chromium and local web-server configuration
  vite.config.ts          Vite, Tailwind CSS, and Vitest configuration
backend/
  src/scenariolab_api/
    ai/                   Grounding, provider adapter, validated output, cache, and fallback
    domain/               Immutable Pydantic v2 contracts and game-state initialization
    engine/               Pure deterministic turn resolution and outcome records
    routes/               FastAPI route modules
    scenarios/            Curated definitions and catalog metadata
    config.py             Backend-only environment settings
    main.py               Application factory and entry point
    schemas.py            Pydantic transport models
  tests/                  Pytest and HTTPX endpoint tests
  .env.example            Backend configuration template
  pyproject.toml           Python project and dependency configuration
docs/                     Architecture and compliance documentation
```

Scenario definitions should remain data, not executable plugins. Engine code must not import or branch on a scenario name.

## Scenario contract and numeric conventions

`ScenarioDefinition` contains identity and schema versions, metadata, bounded metric definitions, an explicit initial-state map, turn configuration, declarative actions and effects, recurring rules, triggered events, prioritized win/loss conditions, deterministic calculation policy, and fallback-event metadata. Definitions and nested values are immutable after validation.

Authoritative metric values are strict integers in contract v1:

- money uses integer cents;
- resource and money minima cannot be negative;
- scores and percentages use inclusive 0–100 bounds;
- capacities and critical thresholds must be inside metric bounds; and
- effects use only `add`, `subtract`, `multiply`, `set`, or `transfer` and must reference declared metrics.

Startup Survival begins with $150,000 cash, $15,000 monthly revenue, $45,000 monthly expenses, 2,000 active users, 12 employees, 82/100 customer satisfaction, and 75/100 team morale. After action effects, its declarative monthly rule calculates `cash = cash + monthly-revenue - monthly-expenses`, producing an initial net cash burn of $30,000 per turn.

`initialize_game_state()` creates a separate immutable snapshot with the pinned scenario version, current/max turns, copied metric values, `not-started` status, empty decision history, and deterministic seed metadata. Initialization does not evaluate a turn.

## Deterministic engine

The public interface is in `scenariolab_api.engine`:

```python
from scenariolab_api.engine import (
    get_available_actions,
    initialize_game,
    resolve_turn,
)
from scenariolab_api.scenarios.startup_survival import STARTUP_SURVIVAL

state = initialize_game(STARTUP_SURVIVAL, seed=42)
actions = get_available_actions(STARTUP_SURVIVAL, state)
result = resolve_turn(
    STARTUP_SURVIVAL,
    state,
    action_id="reduce-operating-expenses",
)
state = result.new_state
```

An accepted turn uses this fixed order:

1. Validate the definition/state pairing and reject terminal games or invalid actions.
2. Evaluate action preconditions against the pre-action snapshot.
3. Apply action effects in declaration order.
4. Apply recurring rules in declaration order.
5. Evaluate event eligibility and choose at most one event with the stable seeded stream.
6. Apply the chosen event's effects.
7. Evaluate failures, successes, and the turn limit.
8. Return a new state and one complete `DecisionRecord`.

The turn number used by predicates is the turn being completed. Active states point to the next playable turn. Terminal states retain the final completed index, so Startup Survival ends at turn 12 and never exposes a turn 13.

All authoritative values use Python integers; money is integer cents. Action and event effects reject underflow or overflow atomically. A recurring rule may explicitly declare `exhaust-at-minimum`: the engine then records both the attempted value and exhaustion, sets the resource to its declared minimum, and evaluates configured failures. No other clamping or rounding occurs. Contract-v1 transfers are exact 1:1 transfers between metrics with the same unit.

Events are filtered by turn window, trigger predicates, occurrence limit, and effect feasibility in definition order. A SHA-256-derived draw over the pinned seed, scenario identity/version, completed turn, and eligible event IDs performs stable integer-weighted selection. The eligible IDs, draw, and chosen event are recorded; no eligible event is a valid deterministic result.

Matched non-turn-only failures always take precedence over wins. Priorities resolve multiple failures or wins; a success may beat a lower-priority turn-only fallback loss, and a loss wins an equal-priority tie. If no authored condition resolves the maximum turn, the engine returns `turn-limit-reached` as a loss.

Replay requires the exact scenario ID/version, seed, and action sequence. Each successful turn stores one immutable decision record containing metric changes, event selection metadata, status, and outcome reason. Rejected operations never alter the supplied state.

## Playable stateless API

The game routes store no server-side session and accept no client-calculated metrics. `POST /api/games/start` resolves an available definition, uses the supplied JSON-safe nonnegative seed or generates one, initializes the engine, and returns state, available actions, and display metadata.

```json
{
  "scenario_id": "startup-survival",
  "seed": 42
}
```

Representative start response fields:

```json
{
  "scenario_id": "startup-survival",
  "scenario_version": "1.0.0",
  "seed": 42,
  "state": {
    "current_turn": 1,
    "max_turns": 12,
    "status": "not-started",
    "metric_values": {
      "cash": 15000000,
      "monthly-revenue": 1500000,
      "monthly-expenses": 4500000
    }
  },
  "available_actions": [
    { "action_id": "invest-in-marketing", "title": "Invest in Marketing" }
  ],
  "scenario": {
    "title": "Startup Survival",
    "objective": "Keep the startup alive and operational for 12 simulated months."
  }
}
```

`POST /api/games/turn` pins the returned scenario version and seed, replays the ordered history, then resolves exactly one new action through the engine:

```json
{
  "scenario_id": "startup-survival",
  "scenario_version": "1.0.0",
  "seed": 42,
  "action_history": ["reduce-operating-expenses"],
  "action_id": "invest-in-marketing"
}
```

The response contains the reconstructed `TurnResult`, updated `GameState`, complete action-ID history, and actions available for the next turn. Histories longer than the scenario turn limit are rejected before replay. Unknown, ineligible, or terminal histories do not partially advance a game.

Errors use a stable envelope:

```json
{
  "detail": {
    "code": "scenario_not_available",
    "message": "Scenario 'space-colony' is planned but is not available for play."
  }
}
```

Important codes include `invalid_request`, `scenario_not_found`, `scenario_not_available`, `scenario_version_mismatch`, `invalid_replay_history`, `invalid_action`, `action_not_eligible`, and `game_already_complete`.

## Frontend gameplay flow

The scenario library shows all three predefined scenarios as playable, along with the planned custom-scenario feature. Each scenario uses its own turn vocabulary (Month, Round, or Cycle), metric labels and formats, decisions, events, and outcome titles. All of these come from its definition. Startup Survival offers Classic Simulation and AI Scenario Director. For Cybersecurity Crisis and Space Colony, the mode screen marks the Director as **Not available for this scenario**. Their briefings are labeled **Strategic briefing** / **Authored briefing**, never as AI.

The player starts a run, reviews definition-driven metrics and available decisions, selects and confirms one action, then sees the exact state, deltas, event, status, and outcome returned by FastAPI. Currency formatting converts integer cents only for presentation. Delta color uses each metric's `favorable_direction`; an increase is not assumed to be beneficial. While a request is pending, duplicate submission is blocked. Failed requests preserve the prior accepted state and expose a retry action. Terminal games disable decisions and offer a fresh restart through `/api/games/start`.

### Dashboard and browser saves

The responsive gameplay dashboard iterates the active scenario's metric metadata for KPI cards and chart series. Charts include the server-provided initial values and accepted `DecisionRecord.metric_changes`; they do not invent intermediate values. The `cents` unit is divided by 100 only by presentation formatters. Decision history is rendered in backend order, with authoritative events and metric changes displayed separately from optional AI narrative.

The MVP save uses the `scenariolab.saved-run` localStorage key and contains only replay identity:

```json
{
  "format_version": 1,
  "scenario_id": "startup-survival",
  "scenario_version": "1.0.0",
  "seed": 42,
  "action_history": ["reduce-operating-expenses"]
}
```

The browser validates the exact save shape and never saves metric values, status, event outcomes, credentials, or provider configuration. It writes after a successful start or accepted turn. Continue calls `/api/games/start` with the saved seed and replays each saved action through `/api/games/turn`; the response version must match the pinned version. Resume makes no AI requests for historical turns. Corrupt, incompatible, or unavailable storage is reported without preventing play. Saves stay on the current browser profile and are not synchronized across devices.

## Run checks

Run the backend suite from the repository root so the test process uses project defaults rather than a backend-local dotenv file:

```powershell
uv run --project backend --no-sync pytest backend/tests
```

Run frontend checks from `frontend`:

```powershell
npm test
npm run build
npm run test:e2e
npm run test:e2e:headed -- --grep "homepage lists all predefined scenarios"
```

Playwright uses dedicated backend and frontend ports. Its backend process has AI disabled, and every automated briefing request is intercepted by the test fixture.

## Future generated scenarios

Prompt-, document-, and URL-based generation will use the same contract as curated content:

```text
User input or untrusted source
  -> AI-generated structured JSON
  -> Pydantic schema validation
  -> cross-reference validation
  -> semantic and safety validation
  -> accepted immutable ScenarioDefinition
  -> simulation engine
```

Generated code or expressions will never be executed. Documents and URLs remain untrusted source material with provenance and prompt-injection defenses.

## Core guarantees

- Python is authoritative for all numeric state transitions.
- Given the same scenario version, initial state, decision sequence, and random seed, a run is reproducible.
- All external and AI-produced data is untrusted until validated.
- Scenario content can express only allowlisted effects and trigger predicates.
- Explanations are grounded in recorded engine inputs and outputs.
- The normal gameplay loop has no hard dependency on a successful AI request. Briefing requests run separately after authoritative turn responses, and stale responses are discarded after another decision or restart.

## Planning and compliance

- [ROADMAP.md](ROADMAP.md) contains daily milestones from October 29 through November 27, 2026.
- [docs/hackathon-compliance.md](docs/hackathon-compliance.md) distinguishes project requirements from hackathon rules that still need confirmation against the official source.

The internal submission target is **November 25, 2026**. The official Devpost deadline is **November 27, 2026 at 5:00 PM Eastern Standard Time**. See the compliance tracker for confirmed requirements and remaining personal eligibility checks.

## Contributing

Read [AGENTS.md](AGENTS.md) before making changes. Implement work one reviewed brick at a time, preserve the engine/content boundary, and add tests for every state-transition rule.
