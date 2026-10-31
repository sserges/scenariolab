# ScenarioLab Architecture

## 1. Goals and constraints

ScenarioLab must run many decision simulations through one engine. Startup Survival is the first content package, not an engine special case. A scenario is declarative, portable, versioned data. Python calculates authoritative outcomes; AI supplies optional content and explanations inside a strict validation boundary.

The official predefined catalog contains Startup Survival, Cybersecurity Crisis, and Space Colony. Catalog presence is not playability: Startup Survival has a complete available definition, while Cybersecurity Crisis and the 50-astronaut Space Colony remain planned until their definitions and tests are complete. The implementation order is Startup Survival MVP first, followed by the two planned scenarios after the generic engine is proven.

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
  displays server state, decisions, deltas, events, and terminal results
       |
       | scenario identity/version + seed + ordered action IDs (untrusted)
       v
FastAPI application layer
  DTO validation, deterministic replay, structured errors
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
- Stable IDs use lowercase kebab case with the pattern `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`. Display text is stored separately.
- Unknown fields are rejected in authoritative models so misspellings and model hallucinations do not silently pass.
- Definitions are immutable once used by a saved run. A content change requires a new scenario version.
- Definitions contain data only: no source code, scripts, dynamic templates, regular-expression execution, or free-form expressions.

### 3.2 Top-level shape

The following is a normative field outline, not application code:

```yaml
schema_version: "1.0"
scenario_id: startup-survival
version: "1.0.0"
title: Startup Survival
description: Manage a startup through its first year.
category: business

metadata:
  objective: Keep the startup alive for 12 simulated months.
  author: ScenarioLab
  content_locale: en-US
  source: predefined
  tags: [business, startup]
  disclaimer: Fictional simulation; not financial advice.
  source_references: []

turn:
  duration: 1
  unit: month
  max_turns: 12

metrics: []
initial_state: {}
actions: []
recurring_rules: []
events: []
win_conditions: []
loss_conditions: []

calculation:
  numeric_mode: strict-integer-v1
  money_mode: integer-cents
  bound_violation: reject
  unsupported_operator: reject
  missing_reference: reject
  effect_order: [action-effects, recurring-rules, event-effects, outcome-evaluation]
  random_stream_version: scenario-seed-v1

fallback:
  event_ids: []
  no_event_allowed: true
```

### 3.3 Identity and version

| Field | Type | Requirement |
| --- | --- | --- |
| `schema_version` | string | Supported contract major/minor version |
| `scenario_id` | stable ID | Globally stable scenario identity |
| `version` | SemVer string | Immutable content version |
| `title` | bounded string | Player-facing name |
| `description` | bounded string | Player-facing summary |
| `category` | closed enum | `business`, `cybersecurity`, `space`, or `custom` |
| `metadata` | object | Objective, author, locale, source type, tags, disclaimer, and provenance references |

A run pins both `schema_version` and the pair (`scenario_id`, `version`). Saved runs never resolve “latest.”

### 3.4 Turn model

`turn.duration` is a positive integer and `turn.unit` is an allowlisted value such as `day`, `week`, `month`, or `year`. `turn.max_turns` is a bounded positive integer. Startup Survival uses one month per turn and a limit of 12.

The unit communicates simulated time; it does not schedule wall-clock jobs. The engine advances exactly one turn after an accepted decision and all ordered consequences for that turn complete.

### 3.5 Metrics, resources, and initial state

All measurable state uses a `MetricDefinition`:

| Field | Type | Purpose |
| --- | --- | --- |
| `metric_id` | stable ID | Effect and condition target |
| `label` / `description` | bounded text | Display content |
| `kind` | enum | `resource`, `score`, `rate`, `count`, or `index` |
| `unit` | enum | Machine unit such as `cents`, `people`, `users`, `percent`, `points`, or `units` |
| `min_value` / `max_value` | integers | Inclusive hard bounds |
| `capacity` | optional value/reference | Operational capacity at or below the hard maximum |
| `initial_value` | number | Canonical starting value |
| `critical_threshold` | optional integer | A value that outcome conditions may treat as exhaustion or failure |
| `format` | object | Display style, integer precision, currency code, and suffix |
| `favorable_direction` | enum | Whether higher, lower, or neither direction is generally favorable |

`initial_state` maps every declared `metric_id` to its initial value and may contain only declared metrics. For a fixed initial value it should equal `initial_value`; keeping the explicit map makes run initialization and future scenario variants auditable. A later version may remove duplication after implementation experience.

Contract v1 accepts strict integers only. Money uses integer cents. Resources and money are nonnegative; scores and percentages use inclusive 0–100 bounds. Every initial value, capacity, and critical threshold must lie inside its metric bounds. Booleans, floating-point values, missing metrics, and extra initial-state metrics are rejected.

Capacity and bounds have distinct meanings:

- **Bounds** define valid state and are enforced by the engine.
- **Capacity** is a scenario rule or operating threshold. It may be shown to the player or referenced by conditions, but exceeding it has no implicit effect unless the definition declares one.

### 3.6 Decisions and allowed effects

A `ScenarioAction` contains:

- `action_id`, title, and description;
- `preconditions`, evaluated against the pre-action state;
- `effects`, an ordered list of allowlisted numeric effects;
- no executable expressions or calculation callbacks.

Allowed effect operations for contract v1:

| Operation | Meaning |
| --- | --- |
| `add` | Add a literal or parameter value to a metric |
| `subtract` | Subtract a literal or parameter value from a metric |
| `multiply` | Multiply a metric by a literal or parameter factor |
| `set` | Set a metric to a literal or parameter value |
| `transfer` | Subtract from one metric and add to another with explicit conversion and rounding |

Each `ActionEffect` identifies a declared metric, a closed operator, a nonnegative integer operand, a bounded description, and—only for `transfer`—a distinct declared destination metric. No effect may contain executable formulas or refer to undeclared state. Brick 3 validates effects but does not execute them.

Effects execute in tuple order with strict integer arithmetic. `add`, `subtract`, `multiply`, and `set` update one metric; `transfer` moves an exact 1:1 integer amount between two metrics that share a unit. An action is atomic: insufficient source resources or any result outside a declared bound rejects the action without changing the supplied state. There is no implicit rounding or clamping.

### 3.6.1 Recurring rules

`recurring_rules` is a backward-compatible, optional tuple of declarative `RecurringRule` values. A rule names a target metric and an ordered tuple of metric terms, each allowlisted as `add` or `subtract`. All participating metrics must exist and share a unit. For each rule, the engine calculates:

```text
target_next = target_current + declared add terms - declared subtract terms
```

Rules execute after action effects and before event selection. Later rules see earlier rule results; all terms within one rule are read before its target is replaced. Startup Survival declares `monthly-net-cash-flow` as `cash + monthly-revenue - monthly-expenses`; no metric name or scenario identity is hardcoded in the engine.

The default underflow policy is `reject`. Money and resource targets may instead declare `exhaust-at-minimum`. That policy records the below-minimum attempted value, sets the target to its minimum, and continues to terminal evaluation so bankruptcy or generic resource exhaustion is visible. Overflow and all undeclared underflow behavior reject the transition. This is the only bounded saturation in contract v1.

### 3.7 Events and triggers

A `ScenarioEvent` contains:

- stable `event_id`, title, narrative setup, and optional tags;
- `trigger`, a bounded `EventTrigger`;
- earliest and optional latest turn;
- an integer `weight` for deterministic seeded selection;
- `max_occurrences`;
- ordered effects, using the same effect contract as decisions;
- optional player response choices, each with its own allowed effects; and
- `fallback_eligible`, identifying curated events safe for provider-failure use.

Brick 3 trigger and outcome clauses use a deliberately small closed structure:

- leaf: metric comparison (`lt`, `lte`, `eq`, `gte`, `gt`) against a literal or declared parameter;
- leaf: turn comparison;
- leaf: history fact such as a declared decision/event occurrence count; or
- group: a flat, bounded `all` or `any` collection.

Nested predicates and arbitrary negation are not part of contract v1. Strings are never evaluated as expressions. Metric and action references must resolve during semantic validation.

The engine preserves definition order while filtering events by turn window, predicate match, occurrence limit, and effect feasibility. If several remain, it derives an integer draw with SHA-256 from the stream version, seed, scenario ID/version, completed turn, and ordered eligible IDs, then performs weighted selection. At most one event occurs per turn. The eligible IDs, draw, and chosen event are recorded; an empty eligible set produces no event without consuming hidden mutable randomness.

### 3.8 Win, loss, and ending criteria

`win_conditions` and `loss_conditions` are immutable collections of `OutcomeCondition` objects:

- `rule_id`;
- collection membership defines whether the result is a win or loss;
- `priority` resolves simultaneous matches, with higher values taking precedence;
- `conditions`, using the same closed predicate contract;
- player-facing title and bounded summary; and
- optional report guidance that cannot change the result.

The scenario should define behavior at the turn limit. Matched failures containing a metric or history predicate are hard failures and always precede success. Priority resolves multiple hard failures and multiple successes. A success may beat a lower-priority, turn-only fallback loss; a loss wins an equal-priority tie. If no authored condition resolves the maximum turn, the engine returns the machine reason `turn-limit-reached` as a loss. Once terminal, a run rejects further decisions.

### 3.9 Deterministic calculation parameters

`calculation` makes hidden numeric assumptions explicit without implementing an engine:

- `numeric_mode` is strict integers;
- `money_mode` is integer cents;
- invalid bounds, unsupported operators, and missing references use a reject policy;
- `effect_order` declares action effects, recurring rules, event effects, then outcome evaluation; and
- `random_stream_version` pins deterministic seed metadata.

The engine owns algorithms and turn advancement. The definition chooses only allowlisted policy identifiers. Definitions serialized before recurring rules remain valid when they use the legacy action/event/outcome order and declare no recurring rules.

### 3.10 Catalog metadata versus playable definitions

`ScenarioCatalogEntry` is discovery metadata: ID, title, description, category, objective, availability, and planned key metrics. The catalog contains exactly three official entries:

- `startup-survival` — `available`;
- `cybersecurity-crisis` — `planned`; and
- `space-colony` — `planned`, with an intended initial population of 50 astronauts.

Catalog entries do not contain actions, events, or authoritative initial state. Only available entries may resolve to a `ScenarioDefinition`. `GET /api/scenarios/{scenario_id}` returns HTTP 409 with `scenario_not_available` for planned entries and HTTP 404 with `scenario_not_found` for unknown IDs.

### 3.11 Initial game state

`initialize_game_state(definition, seed=...)` creates a new immutable `GameState` with the pinned scenario ID/version, current turn 1, maximum turns, a copied metric-value mapping, `not-started` status, empty decision history, and `scenario-seed-v1` metadata. Initialization does not apply an action, event, cash flow, or turn transition. The copied mapping prevents future state snapshots from mutating the source definition.

Each accepted turn appends exactly one immutable `DecisionRecord` containing action identity, turn/sequence, eligible and selected event metadata, metric changes, resulting status, and outcome reason. Active states identify the next playable turn. Terminal states retain their last completed turn; a 12-turn scenario therefore never exposes turn 13.

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

The pure engine exports `initialize_game(definition, seed)`, `get_available_actions(definition, state)`, and `resolve_turn(definition, state, action_id)`. `resolve_turn` performs one transactional transition:

1. Validate definition policy and definition/state identity, version, turn limit, metric set, bounds, seed stream, status, and contiguous history.
2. Reject completed games and unknown actions.
3. Evaluate action preconditions against the pre-action state and the turn being completed.
4. Apply action effects in declaration order to a private integer map.
5. Apply recurring rules in declaration order.
6. Determine eligible predefined events and select at most one through the pinned seeded stream.
7. Apply the selected event effects.
8. Evaluate hard loss conditions.
9. Evaluate wins and turn-only fallback losses by priority, then enforce the absolute turn limit.
10. Return `TurnResult` with the previous state, new state, selected action, optional event, eligible event IDs and draw, metric changes, completed turn, status, reason, and the appended decision record.

Every accepted turn advances completion exactly once and appends exactly one record. The engine performs all work on local copies before constructing a new frozen state, so exceptions never partially mutate the caller's snapshot. HTTP revision checks, idempotency keys, and persistence remain application-layer work for a later brick.

### 5.1 Stateless game HTTP API

Brick 5 exposes two application routes without adding a session store:

- `POST /api/games/start` accepts an available `scenario_id` and optional nonnegative seed. It returns the pinned scenario identity/version, actual seed, initial `GameState`, currently available actions, turn metadata, and full metric definitions required for generic display.
- `POST /api/games/turn` accepts the scenario ID/version, original seed, ordered prior action IDs, and one new action ID. It never accepts metric values, status, event history, or a client-authored `GameState`.

For a turn request, FastAPI resolves the exact current predefined definition, verifies its version, rejects histories beyond `max_turns`, initializes the engine with the original seed, and replays each prior action through `resolve_turn`. Any unknown, unavailable, impossible, or post-terminal historical action rejects the entire request as `invalid_replay_history`. Only after successful reconstruction does the application resolve the new action. The response contains `TurnResult`, updated state, the appended action-ID history, and next actions from `get_available_actions`.

Identical scenario versions, seeds, histories, and new actions produce identical JSON-compatible domain results. Because JavaScript cannot exactly represent all signed 64-bit integers, the HTTP seed contract is bounded to `0..9007199254740991`; the engine's wider internal seed model remains unchanged.

Business failures use `ErrorResponse` with `detail.code` and `detail.message`. Unknown scenarios return 404, planned scenarios and version/terminal conflicts return 409, and malformed requests, bad histories, or invalid actions return 422. FastAPI request-validation errors are normalized to `invalid_request`. Route handlers contain replay orchestration only and do not duplicate effect, event, metric, or terminal logic.

### 5.2 Frontend authority boundary

React keeps only the accepted scenario metadata, seed, action-ID history, last `TurnResult`, and latest server state needed to render the current page. It never calculates new game state. Metric cards iterate returned `MetricDefinition` values and use `format.style`, currency code, suffix, and `favorable_direction` for presentation. Money is divided by 100 only while formatting cents for display.

The gameplay flow is scenario selection, explicit start, decision selection, confirmation, result display, and either the next decision or a terminal restart. Network, structured API, and response-validation failures leave the last accepted session unchanged and expose retry. A synchronous request guard and disabled controls prevent duplicate submissions. Cybersecurity Crisis, Space Colony, and custom generation remain noninteractive planned content.

## 6. AI boundary and fallback behavior

### Candidate scenario definitions

Predefined and generated scenarios use the identical `ScenarioDefinition` schema. The future generation flow is:

```text
User prompt
  -> AI-generated structured JSON
  -> Pydantic schema validation
  -> cross-reference validation
  -> semantic and safety validation
  -> accepted immutable ScenarioDefinition
  -> simulation engine
```

The LLM receives a constrained schema and may return candidate JSON only. The candidate goes through the full validation pipeline; model output is never executed. Imported PDF, document, and URL content is delimited as untrusted source material, and instructions found inside it are not followed. Provenance stores source references and extraction metadata. Brick 3 documents this boundary but implements no model provider, upload, extraction, or URL fetching.

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

Brick 5 intentionally has no persistence. Refreshing the page starts a new frontend session, and restart calls the stateless start route for a fresh seed and initial state.

Future browser persistence may use `localStorage` with a versioned save envelope containing a save-schema version, pinned scenario identity/version/digest, engine version, run ID, revision, seed, action/event history, and timestamps. Treat loaded saves as untrusted: validate before use and reject incompatible or corrupt data with a recoverable UI path.

Because Python is authoritative, a resumed local save should be sent to the API for validation before the next transition. The client must not modify stored numeric state as a game action. A later server store can preserve the same domain shape while adding accounts, concurrency, and durable audit logs.

Do not persist provider credentials, raw hidden prompts, or sensitive imported document content in `localStorage`.

## 8. Testing strategy

- **Contract tests:** minimal/full valid definitions; one focused invalid fixture per invariant; JSON Schema compatibility.
- **Property tests:** state remains in bounds, invalid actions do not mutate state, terminal runs cannot advance, and identical inputs/seeds produce identical outputs.
- **Golden scenario tests:** fixed Startup Survival decision sequences with exact metric outcomes and endings.
- **Provider tests:** malformed JSON, unknown fields, oversized content, timeouts, numeric overreach, and prompt-injected source text all fall back safely.
- **API tests:** stateless replay reproducibility, version pinning, malformed histories, terminal rejection, structured validation errors, and definition immutability.
- **UI tests:** server-state rendering, metric formatting, decision submission, duplicate prevention, event display, retry without state advance, restart, and terminal behavior.
- **End-to-end tests:** 12 turns with a fake AI provider and with forced provider failure.

## 9. Decisions deferred beyond Brick 5

- Balance validation for the illustrative Startup Survival values
- Complete Cybersecurity Crisis and Space Colony definitions
- Generated TypeScript types versus the current hand-validated API view models
- Browser save/resume and recovery of corrupt or incompatible saves
- Server-side idempotency keys if a future stateful transport is introduced
- Whether generated event content is persisted in full or by digest plus snapshot
- The concrete LLM provider interface and initial provider
- Hosting, authentication, server-side persistence, and observability
- Supported PDF/document formats and URL-fetching security policy
- Migration policy across scenario and save-schema versions

These decisions should be resolved in later bricks without weakening the boundaries defined here.
