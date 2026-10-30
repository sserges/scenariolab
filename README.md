# ScenarioLab

ScenarioLab is an AI-powered decision simulation platform. Players make bounded decisions, a deterministic simulation engine calculates their numeric consequences, and AI adds validated events and explanations without becoming the source of truth.

The first scenario is **Startup Survival**: manage a startup over 12 monthly turns, balance resources and operating metrics, respond to events, and receive an ending report. The same engine is intended to support future predefined and generated scenarios, including document- or URL-grounded scenarios and concepts such as a 50-astronaut Mars colony.

## Project status

This repository is at **Brick 1: repository foundation and architecture**. This brick contains documentation and repository policy only; no application code or dependencies have been added.

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

## Planned repository shape

The exact workspace layout will be established in a later brick. The expected boundaries are:

```text
apps/web/                 React user interface
apps/api/                 FastAPI transport and orchestration
packages/                 Shared generated types or schemas, if needed
scenario_definitions/     Versioned scenario data
tests/                    Cross-application and end-to-end tests
docs/                     Architecture and project documentation
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

The working dates currently supplied to the project are an internal submission target of **November 25, 2026** and an official deadline of **November 27, 2026 at 3:00 PM Mountain Time**. These dates are not yet independently verified.

## Contributing

Read [AGENTS.md](AGENTS.md) before making changes. Implement work one reviewed brick at a time, preserve the engine/content boundary, and add tests for every state-transition rule.
