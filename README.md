# ScenarioLab

ScenarioLab is an AI-powered decision simulation platform. Players make bounded decisions, a deterministic simulation engine calculates their numeric consequences, and AI adds validated events and explanations without becoming the source of truth.

The first scenario is **Startup Survival**: manage a startup over 12 monthly turns, balance resources and operating metrics, respond to events, and receive an ending report. The same engine is intended to support future predefined and generated scenarios, including document- or URL-grounded scenarios and concepts such as a 50-astronaut Mars colony.

## Project status

**Brick 2: frontend and backend scaffolding** is complete. The repository now contains a responsive React application shell, a FastAPI service with `GET /api/health`, and automated connection tests. Gameplay, the simulation engine, persistence, and AI integration intentionally remain out of scope.

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

## Architecture at a glance

ScenarioLab separates authored or AI-generated content from calculation:

1. A versioned `ScenarioDefinition` describes a scenario as validated data.
2. The React client submits a selected decision and displays returned state; it does not authoritatively calculate outcomes.
3. The Python engine validates the action, applies only declared effects using deterministic parameters, enforces bounds and capacities, advances the turn, evaluates triggers and terminal criteria, and returns an outcome record.
4. The AI integration may propose scenario definitions, events, and explanations, but its output must pass strict schemas and semantic validation. AI-generated code is never executed.
5. If AI generation fails, deterministic or seeded fallback events keep the simulation playable.

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

The API is available at `http://localhost:8000`; its health endpoint is `http://localhost:8000/api/health`.

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
    routes/               FastAPI route modules
    config.py             Backend-only environment settings
    main.py               Application factory and entry point
    schemas.py            Pydantic transport models
  tests/                  Pytest and HTTPX endpoint tests
  .env.example            Backend configuration template
  pyproject.toml           Python project and dependency configuration
docs/                     Architecture and compliance documentation
```

Scenario definitions should remain data, not executable plugins. Engine code must not import or branch on a scenario name.

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
