# ScenarioLab Architecture

## 1. Goals and constraints

ScenarioLab must run many decision simulations through one engine. Startup Survival is the first content package, not an engine special case. A scenario is declarative, portable, versioned data. Python calculates authoritative outcomes; AI supplies optional content and explanations inside a strict validation boundary.

The design optimizes for:

- deterministic, replayable numeric transitions;
- scenario extensibility without executing scenario-authored code;
- safe validation of curated, generated, and imported content;
- continued gameplay during AI provider failure;
- auditable explanations grounded in engine results; and
- a clear path from local-only persistence to server persistence later.

## 2. System boundaries

```text
React client
  displays state, decisions, charts, history, saves
       |
       | typed HTTP requests (untrusted)
       v
FastAPI application layer
  authentication later, run orchestration, provider selection, DTO validation
       |
       +---------------------> LLM adapter
       |                         candidate JSON/text only
       |                               |
       |                         schema + semantic validation
       |                               |
       v                               v
Deterministic Python engine <---- approved event/narrative inputs
  scenario-agnostic validation, calculations, triggers, terminal state
       |
       v
Outcome record + authoritative run state
```

The engine has no dependency on FastAPI, React, an LLM SDK, or a specific scenario. It consumes validated domain objects and returns new state plus an outcome record. The application layer coordinates persistence and optional AI calls.

## 3. `ScenarioDefinition` contract

### 3.1 Contract policy

- The canonical definition is validated by Pydantic and exported as JSON Schema for tooling and TypeScript type generation.
- `schema_version` versions the envelope/contract. `version` versions the scenario content. They are independent.
- Stable IDs use a conservative pattern such as `^[a-z][a-z0-9_]{0,63}$`. Display text is stored separately.
- Unknown fields are rejected in authoritative models so misspellings and model hallucinations do not silently pass.
- Definitions are immutable once used by a saved run. A content change requires a new scenario version.
- Definitions contain data only: no source code, scripts, dynamic templates, regular-expression execution, or free-form expressions.

### 3.2 Top-level shape

The following is a normative field outline, not application code:

```yaml
schema_version: "1.0"
scenario_id: startup_survival
version: "1.0.0"
title: Startup Survival
description: Manage a startup through its first year.
content_locale: en-US
tags: [business, startup]

turn:
  duration:
    value: 1
    unit: month
  limit: 12

metrics: []
initial_state: {}
decisions: []
events: []
terminal_rules: []

calculation:
  parameter_values: {}
  effect_order: []
  rounding: {}
  clamp_after_each_effect: false
  random_streams: []

fallback:
  event_ids: []
  no_event_allowed: true

metadata:
  author: ScenarioLab
  created_at: "2026-10-29T00:00:00Z"
  source_provenance: []
```

### 3.3 Identity and version

| Field | Type | Requirement |
| --- | --- | --- |
| `schema_version` | string | Supported contract major/minor version |
| `scenario_id` | stable ID | Globally stable scenario identity |
| `version` | SemVer string | Immutable content version |
| `title` | bounded string | Player-facing name |
| `description` | bounded string | Player-facing summary |
| `content_locale` | locale string | Locale for authored text |
| `tags` | unique stable strings | Optional discovery metadata |

A run pins both `schema_version` and the pair (`scenario_id`, `version`). Saved runs never resolve “latest.”

### 3.4 Turn model

`turn.duration` contains a positive numeric `value` and an allowlisted display `unit` such as `day`, `week`, `month`, or `year`. `turn.limit` is a bounded positive integer. Startup Survival uses one month per turn and a limit of 12.

The unit communicates simulated time; it does not schedule wall-clock jobs. The engine advances exactly one turn after an accepted decision and all ordered consequences for that turn complete.

### 3.5 Metrics, resources, and initial state

All measurable state uses a `MetricDefinition`:

| Field | Type | Purpose |
| --- | --- | --- |
| `metric_id` | stable ID | Effect and condition target |
| `label` / `description` | bounded text | Display content |
| `kind` | enum | `resource`, `score`, `rate`, `count`, or `index` |
| `number_type` | enum | `integer` or `decimal` |
| `unit` | object | Machine unit code, display symbol/name, optional scale |
| `bounds` | object | Inclusive `min` and `max` |
| `capacity` | optional value/reference | Operational capacity at or below the hard maximum |
| `initial_value` | number | Canonical starting value |
| `display` | object | Precision, chart visibility, favorable direction |

`initial_state` maps every declared `metric_id` to its initial value and may contain only declared metrics. For a fixed initial value it should equal `initial_value`; keeping the explicit map makes run initialization and future scenario variants auditable. A later version may remove duplication after implementation experience.

Money should use integer minor units (for example cents) where practical. Other decimals use decimal arithmetic and an explicit rounding policy. Every initial value and capacity must lie inside its metric bounds.

Capacity and bounds have distinct meanings:

- **Bounds** define valid state and are enforced by the engine.
- **Capacity** is a scenario rule or operating threshold. It may be shown to the player or referenced by conditions, but exceeding it has no implicit effect unless the definition declares one.

### 3.6 Decisions and allowed effects

A `DecisionDefinition` contains:

- `decision_id`, label, description, and optional category;
- `availability`, a predicate tree evaluated against the pre-decision state;
- `usage`, such as `once`, `once_per_turn`, or bounded total uses;
- `effects`, an ordered list of allowlisted numeric effects;
- optional bounded presentation metadata; and
- optional explanation hints that contain no calculations.

Allowed effect operations for contract v1:

| Operation | Meaning |
| --- | --- |
| `add` | Add a literal or parameter value to a metric |
| `subtract` | Subtract a literal or parameter value from a metric |
| `multiply` | Multiply a metric by a literal or parameter factor |
| `set` | Set a metric to a literal or parameter value |
| `transfer` | Subtract from one metric and add to another with explicit conversion and rounding |

Each effect identifies declared targets, an operation, an operand expressed as either a validated literal or a key in `calculation.parameter_values`, and an optional `when` predicate. No effect may contain executable formulas or refer to undeclared state.

For v1, derived formulas should be represented as a small, explicitly designed future contract addition rather than smuggled into strings. If Startup Survival requires cross-metric calculations, add a narrowly scoped allowlisted operation with documented operands and tests before scenario content uses it.

### 3.7 Events and triggers

An `EventDefinition` contains:

- stable `event_id`, title, narrative setup, and optional tags;
- `trigger`, a bounded predicate tree;
- `window`, with optional earliest/latest turn;
- `weight` and `priority` for deterministic seeded selection;
- `cooldown_turns` and `max_occurrences`;
- ordered effects, using the same effect contract as decisions;
- optional player response choices, each with its own allowed effects; and
- `fallback_eligible`, identifying curated events safe for provider-failure use.

Trigger predicates use a closed recursive structure:

- leaf: metric comparison (`lt`, `lte`, `eq`, `gte`, `gt`) against a literal or declared parameter;
- leaf: turn comparison;
- leaf: history fact such as a declared decision/event occurrence count; or
- group: bounded `all`, `any`, or `not` children.

Predicate depth and child count are limited. Strings are never evaluated as expressions. References must resolve during semantic validation.

If several events are eligible, selection uses the scenario's declared priority, weight, maximum-per-turn rule, and named seeded random stream. The engine records the eligible set and chosen event so the run can be reproduced.

### 3.8 Win, loss, and ending criteria

`terminal_rules` is an ordered list of `TerminalRule` objects:

- `rule_id`;
- `outcome`: `win`, `loss`, or an explicitly supported ending category;
- `priority` for simultaneous matches;
- `when`, using the same predicate contract;
- player-facing title and bounded summary; and
- optional report guidance that cannot change the result.

The scenario must define behavior at the turn limit, either with a matching terminal rule or an explicit default ending. Terminal priority and tie-breaking are deterministic. Once terminal, the engine rejects further decisions.

### 3.9 Deterministic calculation parameters

`calculation` makes hidden numeric assumptions explicit:

- `parameter_values`: named, typed constants used by effects;
- `effect_order`: the phase order, for example decision effects, automatic rules, event effects, clamping, turn advance, terminal checks;
- `rounding`: mode and precision per unit or metric;
- `clamp_after_each_effect`: whether bounds apply after each effect or at the declared clamp phase;
- `random_streams`: stable stream names and selection algorithms; and
- optional `engine_compatibility`: supported engine contract range.

The engine owns the algorithms. A definition chooses only allowlisted algorithm identifiers and supplies bounded parameters. A run records its seed, engine version, scenario identity/version, accepted actions, generated-event snapshot or ID, and outcomes.

## 4. Validation pipeline

Validation is identical in principle for curated and AI-generated definitions, with stricter provenance and limits for external content:

1. **Transport limits:** enforce payload size, content type, timeouts, and maximum collection/string lengths.
2. **Parse:** accept JSON-compatible data, never code or serialized objects with constructors.
3. **Structural validation:** Pydantic validates types, enums, required fields, ranges, strict unknown-field rejection, and predicate depth.
4. **Semantic validation:** verify unique IDs, resolved references, complete initial state, bounds/capacities, valid effect targets, event windows, terminal coverage, and supported engine compatibility.
5. **Policy validation:** reject executable/code-like fields, unsafe URLs or markup, secret-like data, disallowed content, and imported instructions masquerading as scenario data.
6. **Feasibility diagnostics:** simulate or analyze representative paths to flag impossible wins, unavoidable immediate losses, dead decisions, and extreme balance issues. These are errors or warnings by policy, not model judgment.
7. **Freeze:** compute a content digest and persist the exact accepted definition with provenance.

Validation returns machine-readable issue codes and paths. It must never partially accept a definition or mutate a run.

## 5. Authoritative turn lifecycle

For each decision request, the application layer supplies the current run revision and idempotency key. The engine performs one atomic transition:

1. Verify run is active, revision matches, and decision exists.
2. Evaluate availability and usage limits against pre-decision state.
3. Apply decision effects in declared order with exact numeric and rounding rules.
4. Apply declared automatic phases and bounds at the specified points.
5. Evaluate eligible events; use validated generated content if available, otherwise the fallback catalog or no-event policy.
6. Apply event effects in declared order.
7. Advance the turn at the defined phase.
8. Evaluate terminal rules by priority, including turn-limit behavior.
9. Return a new immutable state snapshot and an outcome record containing before/after values, deltas, selected event, predicates matched, warnings, and terminal result.

The application persists the transition atomically. Repeated idempotency keys return the prior result instead of applying the turn twice.

## 6. AI boundary and fallback behavior

### Candidate scenario definitions

The LLM receives a constrained schema and may return candidate JSON. The candidate goes through the full validation pipeline. Imported PDF, document, and URL content is delimited as untrusted source material; instructions found inside it are not followed. Provenance stores source references and extraction metadata.

### Candidate events

The LLM receives a minimal, redacted state summary, permitted metric IDs, allowed operations, numeric limits, already-used events, and output schema. Generated events cannot introduce metrics, operations, or effects outside those limits. Failure, timeout, invalidity, or policy rejection falls back without blocking the turn.

### Explanations

The LLM receives the engine's outcome record and produces presentation text. Numeric claims must correspond to supplied values. The application may additionally verify mentioned numbers or use deterministic templates when the provider fails. Explanation generation never changes state.

### Provider abstraction

Provider-specific SDK calls live behind an interface with operations such as `generate_event`, `generate_scenario_candidate`, and `explain_outcome`. Timeouts, retries, model identifiers, and credentials belong in server configuration. Tests use a deterministic fake provider.

### Fallback contract

Every production scenario provides either:

- enough curated `fallback_eligible` events for normal play, selected by the seeded engine; or
- an explicit `no_event_allowed` policy plus deterministic narrative templates.

The UI may disclose that a fallback was used, but gameplay remains valid and numeric results remain authoritative.

## 7. Persistence and versioning

Initial persistence uses browser `localStorage` for a versioned save envelope containing a save-schema version, pinned scenario identity/version/digest, engine version, run ID, revision, seed, current state, action/event history, and timestamps. Treat loaded saves as untrusted: validate before use and reject incompatible or corrupt data with a recoverable UI path.

Because Python is authoritative, a resumed local save should be sent to the API for validation before the next transition. The client must not modify stored numeric state as a game action. A later server store can preserve the same domain shape while adding accounts, concurrency, and durable audit logs.

Do not persist provider credentials, raw hidden prompts, or sensitive imported document content in `localStorage`.

## 8. Testing strategy

- **Contract tests:** minimal/full valid definitions; one focused invalid fixture per invariant; JSON Schema compatibility.
- **Property tests:** state remains in bounds, invalid actions do not mutate state, terminal runs cannot advance, and identical inputs/seeds produce identical outputs.
- **Golden scenario tests:** fixed Startup Survival decision sequences with exact metric outcomes and endings.
- **Provider tests:** malformed JSON, unknown fields, oversized content, timeouts, numeric overreach, and prompt-injected source text all fall back safely.
- **API tests:** idempotency, stale revision conflicts, validation errors, and atomic transitions.
- **UI tests:** server-state rendering, history, chart accessibility, save recovery, restart, and terminal report.
- **End-to-end tests:** 12 turns with a fake AI provider and with forced provider failure.

## 9. Decisions deferred beyond Brick 1

- Exact monorepo/workspace tooling and generated-type workflow
- Final Startup Survival metric list and balance values
- Whether generated event content is persisted in full or by digest plus snapshot
- The concrete LLM provider interface and initial provider
- Hosting, authentication, server-side persistence, and observability
- Supported PDF/document formats and URL-fetching security policy
- Migration policy across scenario and save-schema versions

These decisions should be resolved in later bricks without weakening the boundaries defined here.
