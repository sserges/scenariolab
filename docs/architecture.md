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
       v
Deterministic Python engine
  scenario-agnostic calculations, event selection, terminal state
       |
       v
Immutable outcome record + authoritative run state
       |
       +---------------------> optional LLM adapter
                                  bounded narrative JSON only
                                           |
                                  Pydantic validation or
                                  deterministic fallback
```

The engine has no dependency on FastAPI, React, an LLM SDK, or a specific scenario. It consumes validated domain objects and returns new state plus an outcome record. The existing briefing adapter is called after an authoritative result. The optional Director proposal path runs before a decision, but its application layer validates typed effects and calls the engine only with a transient `ScenarioAction`; raw provider output never reaches the engine.

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

Every accepted turn advances completion exactly once and appends exactly one record. The engine performs all work on local copies before constructing a new frozen state, so exceptions never partially mutate the caller's snapshot. HTTP revision checks and persistent idempotency keys remain application-layer work; stateless Director request replay is deterministic but cannot prove global exactly-once execution. Brick 7 adds local scripted replay-identity persistence without changing the engine.

### 5.1 Stateless game HTTP API

Brick 5 exposes two application routes without adding a session store:

- `POST /api/games/start` accepts an available `scenario_id` and optional nonnegative seed. It returns the pinned scenario identity/version, actual seed, initial `GameState`, currently available actions, turn metadata, and full metric definitions required for generic display.
- `POST /api/games/turn` accepts the scenario ID/version, original seed, ordered prior action IDs, and one new action ID. It never accepts metric values, status, event history, or a client-authored `GameState`.

For a turn request, FastAPI resolves the exact current predefined definition, verifies its version, rejects histories beyond `max_turns`, initializes the engine with the original seed, and replays each prior action through `resolve_turn`. Any unknown, unavailable, impossible, or post-terminal historical action rejects the entire request as `invalid_replay_history`. Only after successful reconstruction does the application resolve the new action. The response contains `TurnResult`, updated state, the appended action-ID history, and next actions from `get_available_actions`.

Identical scenario versions, seeds, histories, and new actions produce identical JSON-compatible domain results. Because JavaScript cannot exactly represent all signed 64-bit integers, the HTTP seed contract is bounded to `0..9007199254740991`; the engine's wider internal seed model remains unchanged.

Business failures use `ErrorResponse` with `detail.code` and `detail.message`. Unknown scenarios return 404, planned scenarios and version/terminal conflicts return 409, and malformed requests, bad histories, or invalid actions return 422. FastAPI request-validation errors are normalized to `invalid_request`. Route handlers contain replay orchestration only and do not duplicate effect, event, metric, or terminal logic.

### 5.1.1 Startup Survival Director API and engine foundation (Brick 9B-1)

The optional Director routes are separate from scripted gameplay and are disabled by default with `SCENARIOLAB_DIRECTOR_ENABLED=false`. The Brick 9B-1 foundation shipped authored fallback proposals; Brick 9B-2B adds an optional provider-owned candidate path behind two additional-off-by-default gates. Brick 9B-2A adds the React mode and version-2 browser save path without changing the version-1 scripted contract.

`POST /api/ai/director/proposal` replays a strict version-2 Director transcript and returns the reconstructed `GameState`, an HMAC-authenticated live or authored-fallback proposal, and deterministic full-turn previews. `POST /api/ai/director/turn` verifies the current proposal against the same scenario/version, seed, turn, prior state digest, prior transcript digest, and context snapshot; it resolves one selected choice and returns `TurnResult` plus an authenticated receipt. `POST /api/ai/director/replay` reconstructs completed records and optionally verifies a saved pending proposal. Replay verifies signatures and bindings and never generates content or calls a provider.

The application owns a pinned `startup-survival-director@1.0.0` profile. It limits choices to `add` and `subtract` on declared metrics, disallows Director-created cash or revenue, checks effect budgets and resource affordability, then previews every choice through `resolve_transient_action`. That generic engine entry point shares the scripted effect, recurring-rule, seeded curated-event, and terminal-evaluation pipeline. Its Director situation is not a `ScenarioEvent`; the situation does not advance a turn or alter metrics. After the selected choice, the engine still selects at most one eligible curated event in the existing deterministic order. `DecisionRecord.source` and `director_proposal_digest` identify the transient decision provenance.

Proposals and receipts use canonical UTF-8 JSON, domain-separated SHA-256 digests, HMAC-SHA-256, and a configured key ID. `SCENARIOLAB_DIRECTOR_SIGNING_KEYS` is a JSON key ring whose values contain at least 32 UTF-8 bytes; `SCENARIOLAB_DIRECTOR_ACTIVE_SIGNING_KEY_ID` selects the signer. Retain old keys as verify-only during rotation. Missing signing configuration returns a structured 503; no ephemeral key is created. These keys are separate from `SCENARIOLAB_AI_API_KEY`.

`DirectorReplayHistory` is the backend v2 transcript contract. It accepts at most 12 ordered completed records, caps each signed proposal/decision/receipt record at 4 KiB, and caps the serialized request transcript at 56,000 UTF-8 bytes under the default 65,536-byte middleware limit. The existing version-1 `SavedRun` and `/api/games/*` scripted flow remain in place. The browser does not auto-convert v1 scripted history. Stateless HMAC replay detects edits and cross-state reuse but cannot prevent restoring an earlier valid prefix, deliberate branching from a valid prefix, or repeated duplicate computation across processes.

### 5.1.2 Director UI and version-2 saves (Brick 9B-2A)

Startup Survival presents **Classic Simulation** and **AI Scenario Director** as separate gameplay modes. Classic remains the default selection. Director calls the existing proposal, turn, and replay routes and never calls the briefing route. Its source indicator reports the signed proposal source as **AI generated** or **Authored fallback**. The situation card, choice cards, authoritative previews, confirmation, resulting metric changes, curated event, ordered history, charts, and terminal report use reusable React components and the existing Classic/Dark theme tokens. Cybersecurity Crisis and Space Colony remain Coming Soon.

The Director API must be enabled by backend configuration; the default is disabled. The frontend does not infer the flag or bypass it. Selecting Director starts or reconstructs the game through the server, then requests a proposal. A structured `director_disabled` or signing-unavailable response explains that Director cannot start and offers Classic Simulation. The proposal and turn routes validate signatures and exact current state on the backend. React updates metrics, history, and saves only after an accepted turn response.

The single `scenariolab.saved-run` localStorage entry is a strict union of format 1 (Classic) and format 2 (Director). A format-2 record stores `format_version`, `mode`, scenario ID/version, original seed, profile ID/version, ordered `turn_records`, and an optional `pending_proposal`. Each completed record contains the full signed proposal, selected choice ID, and signed receipt. The pending proposal is signed but unselected. Saves contain no cached metrics, status, API keys, signing keys, provider credentials, raw prompts, or unsigned effects. After reload the client submits completed records and the optional proposal to `/api/ai/director/replay`; Python reconstructs history, verifies the pending signature and exact scenario/profile/version/seed/turn/state/history binding, and returns the same choices with freshly computed authoritative previews. This path never calls an LLM. If no pending proposal is present, the client requests one for the current incomplete turn. Completed turns are never regenerated.

On resume, structural validation happens in the browser and signature/chain/replay validation happens in Python. Invalid, tampered, incompatible, or terminal-overrun histories fail without writing to localStorage, so the existing stored save remains untouched. A valid save is replaced only after a successful new run or accepted turn; a new run, restart, or mode change that would replace progress requires confirmation. HMAC replay does not prevent rollback to an earlier valid prefix, and local storage is not cross-device persistence.

The E2E backend sets a test-only signing key and explicitly keeps both `SCENARIOLAB_AI_ENABLED=false` and `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED=false`. No signing key reaches browser code and automated tests make no provider call.

### 5.1.3 Live Director candidate generation (Brick 9B-2B)

Director mode and live generation are independent. `SCENARIOLAB_DIRECTOR_ENABLED` controls access to signed Director gameplay. Live content additionally requires `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED=true` and `SCENARIOLAB_AI_ENABLED=true`; all default to false. Provider credentials, model, URL, timeout, token cap, per-caller rate guard, and concurrency bound remain server-only configuration.

For Startup Survival only, a strict Pydantic prompt context includes scenario identity/version and objective, current turn and remaining turns, authoritative metric values/bounds, up to three recent decisions and outcomes, curated events in a nearby turn window, win/loss objectives, recent Director families/headline digests, and the approved profile. It excludes provider/signing secrets, local paths, and unrelated user data. The provider returns only a situation beat/headline/description and two to four choice titles/descriptions/effect candidates. It cannot set IDs, state, metrics, event selection, rules, terminal criteria, previews, or executable content. Prompt instructions treat context values as data, never as instructions.

The application assigns stable IDs, validates text/schema, rejects repeated recent families/headlines and numeric narrative claims, checks allowlisted metrics/operators, individual and per-choice cumulative limits, cash limits, resource affordability, distinct choice fingerprints, and full-turn engine previews. Any invalid option rejects the complete live proposal; no effect is edited. Only a proposal whose every choice passes receives an HMAC signature. Provider disabled/unavailable/timeout/invalid/oversized/rate-limited/concurrency-limited results use deterministic authored fallback and identify the signed source. Replay verifies signed records but never calls the provider.

Each proposal request makes at most one provider attempt, uses bounded prompt/response bytes, inherits configured output-token and timeout limits, and uses a bounded exact-context cache for semantically valid content. These limits and cache are process-local and do not impose global or per-run spend ceilings. Immediately disable new live generation with `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED=false` (or `SCENARIOLAB_AI_ENABLED=false`) and restart all API processes. Public billable Director generation stays disabled until shared rate limiting, direct-origin bypass protection, and provider spending controls are verified.

### 5.2 Frontend authority boundary

React keeps the accepted scenario metadata, original seed, ordered action IDs, server-provided initial metric values, latest `GameState`, returned `DecisionRecord` history, and optional in-memory AI briefings needed to render the page. It never calculates new game state. Metric cards and charts iterate returned `MetricDefinition` values and use unit, format, currency code, suffix, decimals, and `favorable_direction` for presentation. Integer cents are divided by 100 only while formatting values for display.

The gameplay flow is scenario selection, explicit start, decision selection, confirmation, result display, and either the next decision or a terminal restart. Network, structured API, and response-validation failures leave the last accepted session unchanged and expose retry. A synchronous request guard and disabled controls prevent duplicate submissions. Cybersecurity Crisis, Space Colony, and custom generation remain noninteractive planned content.

### 5.3 Dashboard, history, and browser persistence (Brick 7)

The dashboard is definition-driven. KPI cards use server-returned metric metadata and state. Reusable SVG trend charts group metrics by compatible unit and display the initial server state plus values reconstructed from ordered `DecisionRecord.metric_changes`. Unchanged metrics carry their last recorded value forward; the client does not infer intermediate points. Currency formatters divide integer cents by 100 for labels only. Axes, unit labels, series legends, accessible SVG names, and screen-reader value summaries accompany each chart. The same components work with other playable definitions without checking scenario IDs.

`DecisionHistory` renders `GameState.decision_history` in backend order. It joins recorded `event_id` values to the validated scenario definition and formats each recorded metric change with its `MetricDefinition`. Per-turn AI briefing text may be shown as a separate explanation, but never replaces an event, metric, status, or outcome record. Rejected API decisions do not change state or create history rows.

The terminal report reads the authoritative terminal state and final `DecisionRecord`. It presents the engine status and outcome reason, completed turn count, initial and final server metrics, presentation-only differences, the decision/event recap, and the final trend charts. It does not add a score or derive a new outcome.

Classic mode stores a single run in browser `localStorage` at key `scenariolab.saved-run`. Its exact version-1 payload is:

```json
{
  "format_version": 1,
  "scenario_id": "startup-survival",
  "scenario_version": "1.0.0",
  "seed": 42,
  "action_history": ["reduce-operating-expenses"]
}
```

Runtime validation requires those fields and stable action/scenario IDs; unknown fields, unsupported save formats, invalid seeds, malformed JSON, and oversized values are rejected. No metrics, status, events, AI narrative, API keys, or provider configuration are stored. A successful fresh start writes an empty action history; each successful turn writes the returned action history. Failed turns do not write, so the last accepted save remains intact. Director mode uses the separate format-2 envelope described above and backend-verified signed replay.

Continue does not trust cached values. The client requests `/api/games/start` with the original seed, verifies the current scenario version, and sends each saved action in order through `/api/games/turn`, using the backend-returned action history for the next replay. The final server response supplies current metrics, history, available decisions, and terminal status. A version mismatch or invalid replay leaves the save unchanged and requires the player to clear it or start a new run. Resuming historical turns does not request AI briefings; a new briefing is requested only after a new accepted decision. When `localStorage` is unavailable, gameplay continues with a visible notice and no saved progress. Saves are local to one browser profile and have no cross-device sync or automatic schema migration.

## 6. AI boundary and fallback behavior

### Grounded turn briefings (Brick 6)

`POST /api/ai/briefing` is stateless and accepts only scenario ID/version, original seed, and a nonempty ordered action history. It resolves the currently registered playable definition, verifies the pinned version, initializes the deterministic engine, and replays the entire history. Invalid or terminal-overrun histories fail before any provider call. The final `TurnResult` is the sole source for the briefing context; browser-supplied metrics, status, event claims, and prose are never accepted.

The application-owned `AIProvider` interface exposes `generate_briefing(context)`. Its first adapter uses the OpenAI-compatible Chat Completions HTTP contract and server-only configuration for API key, model, base URL, timeout, and output-token cap. No provider SDK types cross the adapter boundary, and the client cannot supply a URL or model. Game start and turn routes never resolve or call the provider.

Grounding is divided explicitly:

- **Established simulation facts:** scenario title/objective, completed/current turn, selected action, triggered event if present, exact recorded metric changes, current metric values, game status, and outcome reason.
- **Narrative interpretation:** concise explanation and strategic framing that may describe only those facts.
- **Hypothetical future:** a teaser using noncommittal language; it cannot state that an unselected future event occurred.

The provider must return one JSON object with exactly `headline`, `situation_summary`, `consequence_explanation`, `strategic_insight`, and `next_turn_teaser`. Pydantic rejects missing/extra fields, empty or oversized strings, and control characters. Provider numeric claims are compared with numbers in the authoritative context; unsupported claims fail closed. React renders all fields as escaped text.

Transport and cost controls are bounded: the provider response body is limited to 64 KiB, output tokens default to 500 and cannot exceed 800, timeout defaults to 10 seconds and cannot exceed 30, and there are no automatic retries. A 256-entry in-memory cache deduplicates successful live briefings for identical contexts. A per-process, per-caller rolling limit defaults to 20 provider attempts per minute, and a per-process semaphore defaults to two concurrent provider calls; exceeding either uses fallback. Live AI is disabled by default through `SCENARIOLAB_AI_ENABLED=false`. Public multi-replica deployments still require shared edge rate limiting and origin protection; process-local controls do not limit aggregate traffic across replicas.

Missing configuration, transport/timeout/HTTP/rate-limit failure, malformed or oversized JSON, schema rejection, and unsupported numbers all return deterministic text derived from the same engine context with `source: "fallback"`. Successful validated output returns `source: "live"`. Provider exceptions, response bodies, credentials, and stack traces are not returned. A full 12-turn Startup Survival run therefore makes at most 12 distinct briefing requests; actual billing depends on configured provider rates and the bounded input/output token counts.

The frontend applies a successful turn response immediately, then starts the briefing request independently. It aborts the prior request and checks a monotonically increasing request version before rendering, preventing an older response from replacing a newer turn or surviving restart. AI failure displays a nonblocking message and leaves decisions enabled.

### Candidate scenario definitions (planned; not implemented)

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

### Candidate events (planned; not implemented)

Current scenario events are curated declarative data selected by the deterministic engine. No LLM receives event-generation requests and model output cannot select events. If a future brick adds candidate events, the LLM must receive a minimal, redacted state summary, permitted metric IDs, allowed operations, numeric limits, already-used events, and output schema. Generated candidates must pass structural and semantic validation; failure, timeout, invalidity, or policy rejection must fall back without blocking the turn.

### Explanations (implemented)

The LLM receives the engine's outcome record and produces presentation text. Numeric claims must correspond to supplied values. The application may additionally verify mentioned numbers or use deterministic templates when the provider fails. Explanation generation never changes state.

### Future provider operations

Future candidate-event and scenario-generation operations must remain behind separate application-owned interfaces and pass the full domain validation pipeline. Brick 6 implements narrative briefings only; it does not let the provider select random events or create authoritative effects.

### Fallback contract

Every production scenario provides either:

- enough curated `fallback_eligible` events for normal play, selected by the seeded engine; or
- an explicit `no_event_allowed` policy plus deterministic narrative templates.

The UI may disclose that a fallback was used, but gameplay remains valid and numeric results remain authoritative.

## 7. Persistence and versioning

Brick 7 stores one validated replay identity in `localStorage` under `scenariolab.saved-run`: save format version, scenario ID/version, original seed, and ordered accepted action IDs. It does not store metrics, status, events, narratives, provider credentials, or configuration. A failed decision does not overwrite the latest accepted save.

On resume, the client checks the pinned scenario version, calls `/api/games/start` with the original seed, and submits saved actions in order through `/api/games/turn`. The backend rebuilds every state and outcome. A corrupt or incompatible save is preserved until the player clears it or starts a new run. Historical turns do not trigger AI calls. Saves are local to one browser profile; there is no cross-device sync, server-side game storage, or automatic migration between save versions.

Treat local storage as untrusted presentation input and never use it as authoritative state. Do not persist provider credentials, raw hidden prompts, or sensitive imported document content.

## 8. Testing strategy

- **Contract tests:** minimal/full valid definitions; one focused invalid fixture per invariant; JSON Schema compatibility.
- **Property tests:** state remains in bounds, invalid actions do not mutate state, terminal runs cannot advance, and identical inputs/seeds produce identical outputs.
- **Golden scenario tests:** fixed Startup Survival decision sequences with exact metric outcomes and endings.
- **Provider tests:** malformed JSON, unknown fields, oversized content, timeouts, numeric overreach, and prompt-injected source text all fall back safely.
- **API tests:** stateless replay reproducibility, version pinning, malformed histories, terminal rejection, structured validation errors, and definition immutability.
- **UI tests:** server-state rendering, metric formatting, decision submission, duplicate prevention, event display, retry without state advance, restart, and terminal behavior.
- **End-to-end tests:** 12 turns with a fake AI provider and with forced provider failure.

## 9. Decisions deferred beyond Brick 8A

- Balance validation for the illustrative Startup Survival values
- Complete Cybersecurity Crisis and Space Colony definitions
- Generated TypeScript types versus the current hand-validated API view models
- Cross-device save synchronization and automatic save-schema migration
- Server-side idempotency keys if a future stateful transport is introduced
- Whether generated event content is persisted in full or by digest plus snapshot
- Shared distributed rate limiting, origin restriction, authentication, and provider observability
- Public hosting and production operations
- Supported PDF/document formats and URL-fetching security policy
- Migration policy across scenario and save-schema versions

These decisions should be resolved in later bricks without weakening the boundaries defined here.

## 10. Deployment and security readiness (Brick 8A)

The backend accepts one exact `SCENARIOLAB_FRONTEND_ORIGIN`; wildcard origins and credentialed CORS are not enabled. `SCENARIOLAB_ENVIRONMENT=production` requires an HTTPS frontend origin and HTTPS provider URL. Live AI is disabled by default and only constructs a provider when explicitly enabled with both a model and backend-only key. Store the key in the hosting platform's runtime secret manager, never in a browser variable, Docker build argument, image, log, or source file.

`RequestBodyLimitMiddleware` bounds request bodies before JSON decoding; its default is 65,536 bytes and the configurable maximum is 1 MiB. The provider adapter already bounds upstream response size, timeout, and output tokens. The briefing service additionally bounds concurrent provider attempts and its rolling per-caller attempt count inside one Python process. These controls do not provide an aggregate limit across replicas. The caller identity is the ASGI peer address; proxy headers must only be trusted from known proxy addresses that overwrite client-supplied forwarding headers.

The public briefing endpoint has no authentication. CORS only governs browser access and is not access control. A public deployment that enables billable AI must use shared gateway/WAF rate limiting on `/api/ai/briefing`, protect the API origin so callers cannot bypass the gateway, set provider model/rate/spend controls and alerts, and observe usage. Alerts alone do not stop spend; a configured provider hard limit can interrupt briefings and may overshoot slightly while enforcement propagates. Keep `SCENARIOLAB_AI_ENABLED=false` until these controls are in place. With AI disabled, deterministic engine gameplay and fallback briefings remain available.

The checked-in deployment templates provide an HTTPS-only production baseline. The backend Docker image runs as an unprivileged user, serves `/api/health`, binds to the hosting platform's `PORT`, and excludes environment files from its Docker build context. Frontend `VITE_API_BASE_URL` is a public build-time URL and must identify the HTTPS API origin. Hosting-specific edge rate limits, TLS, origin restrictions, backups, logging retention, and billing alerts must be configured and verified by the operator; this repository does not claim those provider-side controls are active.
