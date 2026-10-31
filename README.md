# ScenarioLab

ScenarioLab is an AI-powered decision simulation platform. Players make bounded decisions, a deterministic simulation engine calculates their numeric consequences, and AI adds validated events and explanations without becoming the source of truth.

The first playable definition is **Startup Survival**: manage a startup over 12 monthly turns, balance resources and operating metrics, respond to events, and receive an ending report. The official catalog also includes **Cybersecurity Crisis** and **Space Colony**, which remain clearly marked as planned until their complete definitions and tests exist.

## Project status

**Brick 5: playable simulation API and frontend** is complete. Startup Survival can now be started, played through all 12 authoritative turns, and restarted in the browser. The FastAPI layer remains stateless: every turn reconstructs the prior state from the pinned scenario version, seed, and ordered action history before calling the deterministic engine. Persistence, AI integration, custom generation, and additional playable scenarios remain out of scope.

## Official predefined scenarios

| Scenario | Objective | Status |
| --- | --- | --- |
| Startup Survival | Keep a startup alive for 12 simulated months | Playable in the browser |
| Cybersecurity Crisis | Respond to a company security incident | Planned |
| Space Colony | Keep a Mars colony of 50 astronauts operational | Planned |

Catalog metadata makes all three concepts discoverable. Only an `available` entry may be resolved to a full `ScenarioDefinition`; the API returns HTTP 409 for planned entries rather than presenting incomplete content as playable.

## MVP

- Startup Survival with 12 turns
- Decision cards with explicit, allowed effects
- Current metrics, resource displays, and charts
- Validated AI-generated events and narratives
- Deterministic Python calculations for authoritative outcomes
- Decision and event history
- Local save, resume, and restart
- Win/loss evaluation and an ending report
- Built-in fallback events when the configured AI provider is unavailable

Implementation order is Startup Survival first, then Cybersecurity Crisis and Space Colony after the reusable engine and MVP loop are proven. Prompt, document, and URL scenario generation remain stretch work after the predefined MVP is stable.

## Architecture at a glance

ScenarioLab separates authored or AI-generated content from calculation:

1. A versioned `ScenarioDefinition` describes a scenario as validated data.
2. Separate `ScenarioCatalogEntry` records advertise available and planned scenarios without exposing incomplete definitions.
3. An initial immutable `GameState` copies metric values from a definition without evaluating a decision or turn.
4. The Python engine validates actions, applies declared effects and recurring rules, enforces bounds, selects predefined events, advances turns, evaluates terminal criteria, and returns immutable outcome records.
5. The stateless gameplay API replays accepted action IDs and returns server-calculated state and outcomes; the React client only renders those authoritative values.
6. Future AI integrations may propose definitions, events, and explanations, but output must pass the same schema and semantic validation. AI-generated code is never executed.

See [docs/architecture.md](docs/architecture.md) for the contract and trust boundaries.

## Intended stack

| Area | Technology |
| --- | --- |
| Web | React, TypeScript, Vite, Tailwind CSS, Recharts |
| API and engine | Python, FastAPI, Pydantic |
| AI | Configurable LLM provider behind an application-owned interface |
| Persistence | `localStorage` initially |
| Tests | Pytest, Vitest, Playwright |

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

Planned scenario details return HTTP 409 with `scenario_not_available`; unknown IDs return HTTP 404 with `scenario_not_found`.

Start the frontend in a second terminal:

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`. The header reports **API Connected** when the health endpoint returns the expected contract and **API Unavailable** when it cannot be reached.

## Run tests and builds

```powershell
cd backend
uv run pytest

cd ../frontend
npm test
npm run build
```

Frontend tests use Vitest and React Testing Library. Backend endpoint tests use Pytest and HTTPX.

## Project structure

```text
frontend/
  src/
    components/           Reusable React UI, including API status
    lib/                  Browser API client and response validation
    test/                 Shared Vitest setup
  .env.example            Public Vite configuration template
  package.json            Frontend scripts and dependencies
  vite.config.ts          Vite, Tailwind CSS, and Vitest configuration
backend/
  src/scenariolab_api/
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

The scenario library continues to show all three predefined cards and the planned custom-scenario feature. Startup Survival can open a responsive gameplay screen; the other predefined scenarios remain disabled as **Coming Soon**.

The player starts a run, reviews definition-driven metrics and available decisions, selects and confirms one action, then sees the exact state, deltas, event, status, and outcome returned by FastAPI. Currency formatting converts integer cents only for presentation. Delta color uses each metric's `favorable_direction`; an increase is not assumed to be beneficial. While a request is pending, duplicate submission is blocked. Failed requests preserve the prior accepted state and expose a retry action. Terminal games disable decisions and offer a fresh restart through `/api/games/start`.

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
- The normal gameplay loop has no hard dependency on a successful AI request.

## Planning and compliance

- [ROADMAP.md](ROADMAP.md) contains daily milestones from October 29 through November 27, 2026.
- [docs/hackathon-compliance.md](docs/hackathon-compliance.md) distinguishes project requirements from hackathon rules that still need confirmation against the official source.

The internal submission target is **November 25, 2026**. The official Devpost deadline is **November 27, 2026 at 5:00 PM Eastern Standard Time**. See the compliance tracker for confirmed requirements and remaining personal eligibility checks.

## Contributing

Read [AGENTS.md](AGENTS.md) before making changes. Implement work one reviewed brick at a time, preserve the engine/content boundary, and add tests for every state-transition rule.
