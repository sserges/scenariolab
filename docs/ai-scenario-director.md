# AI Scenario Director — Architecture and Brick 9B Foundation

**Status:** Bricks 9A, 9B-1, and 9B-2A are complete. Brick 9B-2A passed the complete backend Pytest suite (98), frontend Vitest suite (64), TypeScript production build, full Chromium suite (19), headed Director smoke, three-turn reload/signed replay, tampered-history rejection, and desktop/mobile theme screenshot review. Brick 9B-2B live generation and public deployment remain incomplete.

**Scope:** Startup Survival only. Existing scripted gameplay remains the compatibility path. Cybersecurity Crisis, Space Colony, and user-created scenarios are out of scope.

## Recommendation

The optional Director mode returns one context-aware situation and two to four decision choices for the current reconstructed state. The server validates choices against the versioned Startup Survival policy, previews them with the deterministic engine, and signs the approved proposal. The player chooses one option; the server verifies it against the exact replay, applies it through the engine, evaluates scripted events and terminal rules, and signs a receipt. Brick 9B-2A presents this flow in React using authored fallback proposals only; it does not connect the live provider.

The browser stores completed signed proposals and receipts as replay inputs. It keeps a pending proposal in memory, then requests the current incomplete turn again after resume. The backend verifies and replays completed inputs and never accepts browser-supplied metrics, status, events, or outcomes.

Use HMAC-SHA-256 records, canonical JSON, and a versioned server key ring. This needs no database for outcome integrity. It does **not** prevent a user from restoring an earlier, still-valid prefix of their local save; that requires server-held monotonic state. It also cannot guarantee cross-replica proposal deduplication or a hard per-run provider-call ceiling without shared state. Those limits are acceptable for the MVP only while live Director AI remains disabled on public deployments until shared edge controls and provider budgets are in place.

## 1. What the repository does today

The proposal follows the current implementation rather than treating the prose contract as if every concept were already present.

| Area | Current interface and behavior |
| --- | --- |
| Definition | `ScenarioDefinition` in `backend/src/scenariolab_api/domain/models.py` is a frozen, extra-forbid Pydantic model. It contains fixed `actions`, `recurring_rules`, `events`, predicates, metrics, and terminal conditions. Startup Survival is version `1.0.0`, has seven metrics, three fixed actions, and 12 turns. |
| Effects | `ActionEffect` targets one declared metric and uses the existing `EffectOperator` enum: `add`, `subtract`, `multiply`, `set`, and `transfer`. Values are nonnegative strict integers. Transfer is 1:1 between metrics with the same unit. The model does not define AI-specific effect budgets or prevent an `add` to a money metric. |
| Engine | `resolve_turn(definition, state, action_id)` remains the scripted interface. New `resolve_transient_action(definition, state, action, provenance_digest=...)` applies an application-validated transient action through the same effects, recurring rules, seeded event selection, event effects, and outcome pipeline. Both return immutable results. |
| History | `DecisionRecord` now includes a source (`scripted` or `director`) and a proposal digest for Director decisions. Static decisions keep the existing action ID behavior; dynamic records are accepted only as part of authenticated Director replay at the API boundary. |
| Game API | Existing `POST /api/games/start` and `/api/games/turn` remain unchanged and replay static IDs. Separate Director routes now exist: `/api/ai/director/proposal`, `/api/ai/director/turn`, and `/api/ai/director/replay`. They accept strict v2 transcript models and support authored fallback content only. |
| Events | `ScenarioEvent` is fixed declarative data with a bounded trigger, effects, weight, occurrence cap, and fallback flag. The engine selects events from definition order using the pinned seed stream. The runtime model has no AI-generated event choice or event-response branch. |
| AI | `AIProvider` in `backend/src/scenariolab_api/ai/provider.py` still only generates a five-field briefing. Director routes do not call it in 9B-2A. |
| Browser save | `frontend/src/lib/savedRun.ts` accepts a strict union: v1 scripted identity/action history, or v2 Director scenario/profile identity and ordered signed turn records. Both formats omit metrics and status. |
| Deployment controls | Both `SCENARIOLAB_AI_ENABLED` and `SCENARIOLAB_DIRECTOR_ENABLED` default to false. Director signing uses a separate environment key ring; missing keys fail closed. Request bodies default to 65,536 bytes. Existing provider controls and the fact that process-local limits do not aggregate across replicas are unchanged. CORS is exact-origin browser policy, not authentication. |

The current effect vocabulary remains reused. The application authenticates dynamic choices and the generic engine resolves them, while the existing scripted action-selection and version-1 save paths remain available unchanged.

## 2. Proposed architecture

Keep the Director in the application layer. It prepares a bounded context from a server-reconstructed state, calls an application-owned provider interface, validates candidate content, and delegates all numeric simulation to a generic engine entry point. The provider never receives a `GameState` object that it can return or mutate; it returns candidate story text and candidate effects only.

```text
Browser                         FastAPI                         Engine
  |                               |                                |
  |-- proposal request + replay ->| verify/replay saved prefix     |
  |                               | build immutable context        |
  |                               | provider or deterministic      |
  |                               | fallback; validate and sign    |
  |<-- signed proposal + previews-|                                |
  |                               |                                |
  |-- proposal + choice -------->| verify prefix and signature     |
  |                               | validate choice and policy      |
  |                               |------------------------------->|
  |                               | apply one choice, recurring     |
  |                               | rules, scripted event, outcome |
  |                               |<-------------------------------|
  |<-- result + signed receipt ---| sign replay receipt             |
```

The situation is a pre-decision narrative beat, not a new `ScenarioEvent`. It does not enter the scripted event pool, select a scripted event, change a metric, or advance a turn. One accepted choice advances exactly one turn. The current deterministic event selector still runs after the choice and recurring rules, and terminal conditions are evaluated after any selected scripted event as they are today.

Director mode is an explicit frontend option for Startup Survival. Keep the current scripted gameplay mode and its route behavior. Classic start/turn requests remain unchanged; Director uses the separate proposal/turn/replay routes and a strict `mode: "director"` v2 envelope. The Director profile must be enabled for the exact scenario version before Director mode starts. Do not silently switch existing or resumed runs into Director mode.

Use a separately versioned, declarative `DirectorProfile` associated with `startup-survival@1.0.0`, rather than changing the existing `ScenarioDefinition` merely to turn on an optional experience. Pin `profile_id`, `profile_version`, and context/prompt format versions in each signed proposal. If a future change alters the static scenario itself, preserve exact scenario-version definitions for saves; do not resolve an old save to “latest.” The profile is allowlisted data, not executable policy code.

### Context and repetition control

Build a frozen, Pydantic `DirectorContextSnapshot` only from the server-reconstructed state and the pinned profile. Include:

- scenario identity/version, Director profile version, seed, and current turn;
- current values and declared bounds for the permitted metrics;
- recent selected decision IDs/titles and recorded scripted event IDs/titles;
- compact event/action counts needed for the profile; and
- recent Director beat IDs and normalized headline digests.

Do not accept browser metrics or narrative as context. Do not include free-form user prompts, documents, URLs, secrets, API configuration, or provider response objects. Serialize the snapshot as JSON data in a user message, separate from a static system prompt that explicitly treats every value as untrusted data. The model may not add instructions, code, or arbitrary metric IDs.

Use a closed `beat_id` enum such as `customer`, `operations`, `product`, `people`, `finance`, and `market`. Ask the provider to avoid recent beats, then enforce a deterministic three-turn beat cooldown and reject exact normalized headline repeats. The backend fallback rotates through validated authored beats using a hash of scenario/version, seed, turn, and history. This is a small, testable repetition control; it is not semantic similarity detection. Defer embeddings or a similarity service.

Include the exact compact context snapshot (or its compact immutable facts plus a digest) in the signed proposal. On replay, reconstruct the snapshot and require the digest and snapshot to match. This preserves the input used at that turn without trusting saved metrics or regenerating the provider response.

## 3. Proposed data contracts

All I/O models should be strict Pydantic models (`extra="forbid"`, frozen, strict integers, closed enums, bounded arrays and strings). The provider returns only `DirectorProposalContent`; the backend supplies IDs, provenance, run identity, snapshot binding, and signatures.

### Provider content (candidate, not trusted)

The provider JSON should contain exactly:

```json
{
  "beat_id": "customer",
  "headline": "A key customer asks for a larger rollout",
  "description": "The customer is ready to expand, but the team must choose how much support to commit.",
  "choices": [
    {
      "title": "Assign onboarding support",
      "description": "Spend cash and add recurring support costs to protect the relationship.",
      "effects": [
        {"metric_id": "cash", "operator": "subtract", "value": 1200000},
        {"metric_id": "monthly-expenses", "operator": "add", "value": 100000},
        {"metric_id": "customer-satisfaction", "operator": "add", "value": 4}
      ]
    },
    {
      "title": "Automate the rollout",
      "description": "Use a lower-cost process and accept a smaller initial improvement.",
      "effects": [
        {"metric_id": "cash", "operator": "subtract", "value": 400000},
        {"metric_id": "active-users", "operator": "add", "value": 250},
        {"metric_id": "team-morale", "operator": "subtract", "value": 2}
      ]
    },
    {
      "title": "Keep the current service level",
      "description": "Avoid new spending and accept a risk to customer growth.",
      "effects": [
        {"metric_id": "active-users", "operator": "subtract", "value": 100},
        {"metric_id": "monthly-expenses", "operator": "subtract", "value": 100000},
        {"metric_id": "customer-satisfaction", "operator": "subtract", "value": 3}
      ]
    }
  ]
}
```

This is illustrative. The profile limits below are examples of allowed shape, not authorization for these values. The candidate effect schema contains only `metric_id`, `operator`, and `value`; the backend validates those fields, derives a sanitized effect label from metric metadata and the approved operation, then constructs the existing `ActionEffect`. It does not display a model-supplied effect description as a numeric consequence. The backend assigns choice IDs before signing, derived from a domain-separated hash of the canonical candidate content, context hash, and choice position; this avoids a circular dependency on the final proposal hash. It then injects scenario/version, seed, turn, source, and IDs into the signed payload. Narrative text is descriptive only; all displayed consequence amounts come from backend previews and engine results.

### Signed proposal envelope

The server signs a canonical proposal payload after structural, semantic, policy, and full-turn preview validation. The envelope includes:

```json
{
  "payload": {
    "record_format_version": 1,
    "profile_id": "startup-survival-director",
    "profile_version": "1.0.0",
    "context_version": "1",
    "scenario_id": "startup-survival",
    "scenario_version": "1.0.0",
    "seed": 42,
    "turn": 4,
    "previous_history_hash": "sha256:...",
    "state_hash": "sha256:...",
    "context_hash": "sha256:...",
    "source": "live",
    "situation": {
      "situation_id": "director-situation-...",
      "beat_id": "customer",
      "headline": "A key customer asks for a larger rollout",
      "description": "The customer is ready to expand, but the team must choose how much support to commit."
    },
    "choices": [
      {
        "choice_id": "director-choice-...-1",
        "title": "Assign onboarding support",
        "description": "Spend cash and add recurring support costs to protect the relationship.",
        "effects": [
          {"metric_id": "cash", "operator": "subtract", "value": 1200000, "description": "Reduce available cash."}
        ]
      }
    ]
  },
  "signature": {
    "algorithm": "HMAC-SHA256",
    "key_id": "director-2026-01",
    "value": "base64url-mac"
  }
}
```

The abbreviated example shows one choice; a real proposal contains two to four. `source` is assigned by the backend as `live` or `fallback`. Effect descriptions are generated from validated metric metadata and operations. The signature covers the complete canonical payload, including every choice, effect, input snapshot/digest, identity field, and source.

### Signed turn receipt

After the engine resolves the chosen option, return a separately authenticated receipt:

```json
{
  "payload": {
    "record_format_version": 1,
    "scenario_id": "startup-survival",
    "scenario_version": "1.0.0",
    "profile_id": "startup-survival-director",
    "profile_version": "1.0.0",
    "seed": 42,
    "turn": 4,
    "previous_history_hash": "sha256:...",
    "proposal_hash": "sha256:...",
    "selected_choice_id": "director-choice-...-1",
    "result_hash": "sha256:..."
  },
  "signature": {
    "algorithm": "HMAC-SHA256",
    "key_id": "director-2026-01",
    "value": "base64url-mac"
  }
}
```

The stored Director turn record contains the signed proposal, the selected choice ID, and the signed receipt. The receipt makes a changed selection detectable; the proposal MAC makes altered effect values detectable. The next turn's history hash commits the prior ordered record, including its signatures.

## 4. Effect and policy validation

### Is the current effect schema enough?

`ActionEffect` is sufficient to represent the numeric operation after validation: it already has a declared metric ID, an allowlisted operator enum, an integer operand, an optional transfer target, and a description. The deterministic core can apply those effects with strict bound checks.

It is **not** sufficient as the complete Director contract. It does not express a per-scenario AI allowlist, effect count or magnitude limits, cost budgets, non-creation rules for money, distinct-choice checks, dynamic-action provenance, or binding to the game state. Also, `resolve_turn` currently rejects any action ID not in the static definition. The smallest safe extension is:

1. Add a versioned declarative `DirectorProfile` for Startup Survival. It defines allowed metric/operator combinations, absolute per-effect limits, total direct per-choice/per-turn limits, affordability rules, choice counts, beat cooldown, and hard output bounds.
2. Reuse the existing `ActionEffect` model for each selected choice after validating the tighter profile. For generated choices, allow only `add` and `subtract`; reject `multiply`, `set`, and `transfer` in the MVP even though the static engine supports them.
3. Add a generic transient-choice engine entry point that uses the same transactional effect, recurring-rule, event, and outcome pipeline as `resolve_turn`. It accepts only a typed, policy-validated choice from the application layer. Do not implement a separate calculation path or accept a client-authored state.
4. Extend decision history with a source marker and a Director record reference (or an equivalent verified replay-input type) so engine consistency checks can distinguish static action IDs from server-verified Director choice IDs. Keep signed narrative/effect records in a separate transcript field rather than inflating the metric state with a copied proposal.

This is a minimal generic extension; it does not add a scenario-ID branch, a new operator, an expression evaluator, or AI code execution.

### Initial profile limits for review

These values should be confirmed against the Startup Survival balance before implementation. They are conservative starting limits, not model-selected values.

| Metric | Allowed operations | Maximum absolute effect per selected choice | Additional policy |
| --- | --- | ---: | --- |
| `cash` | `subtract` | 2,000,000 cents ($20,000) | Total cash debit per turn is at most 2,000,000 cents and may not exceed current available cash. `add` is prohibited. |
| `monthly-revenue` | `subtract` | 250,000 cents ($2,500) | Positive revenue creation is prohibited for Director choices. |
| `monthly-expenses` | `add`, `subtract` | 400,000 cents ($4,000) | Recurring cash flow remains engine-calculated. |
| `active-users` | `add`, `subtract` | 1,000 users | Must remain within the declared `MetricDefinition` bounds. |
| `employees` | `add`, `subtract` | 2 people | Must remain within declared bounds; no fractional hires. |
| `customer-satisfaction` | `add`, `subtract` | 8 points | Must remain within 0–100. |
| `team-morale` | `add`, `subtract` | 8 points | Must remain within 0–100. |

Policy limits apply to the direct selected choice. Require two to four options, one to three effects per option, no duplicate target metric within one option, no unknown metrics, and at most three executed Director effects per turn (there is exactly one selected option per turn). Every option must have a distinct effect fingerprint and at least one material tradeoff or cost. No AI-provided preconditions, predicates, event triggers, terminal conditions, or state values are accepted.

The engine remains the final affordability and bound authority. A `subtract` that would cross the minimum is rejected; do not clamp it. Before returning the proposal, the backend dry-runs every option through the **whole** deterministic turn, including recurring rules, eligible scripted event selection/effects, and terminal evaluation. A candidate that cannot resolve atomically is rejected, and the deterministic fallback is used. The proposal is bound to the exact state snapshot, so a selected option cannot become affordable against a different state. Direct Director effects cannot set status or name an outcome; only the engine's existing criteria decide win/loss.

This policy prevents AI-created cash/revenue and bounds all other changes. The scenario's authored scripted events can still create revenue (for example, the existing Investor Demo Day event); that is existing scenario data and is selected/evaluated by the deterministic engine, not the Director. Adjusting the allowed table is a balance decision for review, not a model decision.

## 5. Turn lifecycle

1. **Start and pin.** The browser requests Startup Survival with `mode: "director"`. The API returns the exact scenario/version, seed, initial immutable `GameState`, and display metadata. A new Director save begins as format version 2 with no completed records.
2. **Reconstruct.** For a proposal request, the backend resolves the exact versioned definition/profile, initializes from the saved seed, verifies and replays every completed Director record in order, and computes the current state. It ignores any browser metrics or status.
3. **Prepare snapshot.** Build the bounded context from current metrics, turn, recent decisions/events, recent Director beat IDs, and profile allowlists. Canonicalize it and calculate state, context, and previous-history hashes.
4. **Prepare the proposal (9B-2A).** The Director service uses only the authored fallback families. It never imports or calls the AI provider, regardless of `SCENARIOLAB_AI_ENABLED`.
5. **Validate and preview.** Pydantic rejects malformed structure, unknown fields, unsupported operators, overlong content, or invalid integers. Semantic policy rejects undeclared metrics, effect excesses, unaffordable options, duplicate/indistinct choices, recent beats/headlines, or any full-turn simulation failure. If fallback cannot provide two legal choices, return a safe non-advancing error rather than mutate state.
6. **Sign and present.** The server assigns IDs, embeds the snapshot and hashes, records `source`, signs the proposal, and previews each choice through the same pure transition. The frontend presents the situation, two to four choices, approved effect previews, and an “Authored fallback” indicator. A pending proposal stays in memory; v2 local storage contains completed signed turn records only. On reload, the frontend replays completed records and requests a proposal for the current incomplete turn.
7. **Submit one choice.** The frontend posts the exact replay prefix, signed proposal, and selected choice ID. A synchronous UI request guard prevents double-click submission. The server verifies the record MAC and all run/state/profile bindings, confirms the choice ID is in the proposal, revalidates its effects, reconstructs the state, and runs the engine once.
8. **Resolve normally.** Apply the selected Director effects, recurring rules, deterministic scripted event selection/effects, and outcome evaluation in the current contract order. The generated situation itself has no effect and does not consume a second turn. At most one scripted event may still occur as a separate consequence.
9. **Sign and persist.** The response contains the authoritative `TurnResult`, new state, proposal/choice record, and signed receipt over the proposal hash, selected choice ID, previous history hash, and result hash. The browser appends this completed record to local storage only after the backend accepts the signed turn.
10. **Continue or finish.** For an active state, request the next proposal for the newly reconstructed state. For a terminal state, do not generate another proposal; show the existing terminal report and Director story/decision history. Restart creates a new seed and empty transcript after the player confirms replacement of saved progress.

The scripted event engine continues to use its existing eligibility, deterministic draw, and outcome ordering. It never asks the LLM which scripted event to choose. The UI should show the Director situation and the triggered scripted event as separate records to avoid implying the model selected the latter.

### Duplicate and stale requests

There is no mutable server game session today. Given the same verified prefix, proposal, and choice, a duplicate turn request replays to the same result and returns the same deterministic receipt; it does not apply another mutation to server storage. A proposal whose turn, state hash, scenario version, seed, profile version, or previous-history hash no longer matches is rejected with a structured `409 stale_director_proposal`. A client cannot reuse a turn-3 proposal against turn 4.

In 9B-2A, proposal requests are fallback-only and are not billable. If a later 9B-2B provider path is approved, it will need shared edge controls and enforceable provider budgets; process-local controls cannot guarantee a global generation ceiling across replicas or process restarts.

## 6. Deterministic replay and authenticated records

### Replay identity

Classic saves remain format version 1 with their existing action-ID list. A Director save uses a strict version-2 shape:

```json
{
  "format_version": 2,
  "mode": "director",
  "scenario_id": "startup-survival",
  "scenario_version": "1.0.0",
  "seed": 42,
  "profile_id": "startup-survival-director",
  "profile_version": "1.0.0",
  "turn_records": [
    {
      "proposal": {"payload": "...", "signature": "..."},
      "selected_choice_id": "director-choice-...-1",
      "receipt": {"payload": "...", "signature": "..."}
    }
  ]
}
```

The example abbreviates JSON objects for readability. A real save stores their full fields. The v2 browser format does not persist the pending proposal. A reload replays completed history and requests only the current incomplete turn's deterministic fallback proposal. Completed turns are never regenerated. The save contains no metrics, current status, provider credentials, raw hidden prompt, or unsigned effect list.

The client may validate the envelope's size and shape for UI purposes, but only the backend verifies authenticity. Resume sends records as data; the backend reconstructs every turn from the seed and exact scenario/profile version. It validates the proposal and receipt at each step, recomputes the selected effects and event draw, and compares the canonical result hash. It never calls the provider during this process. An incompatible/unsupported format or key/profile version fails closed and preserves the local save; do not silently reinterpret version 1 as Director mode.

### Canonicalization and chaining

Use canonical JSON from the validated Pydantic payload: UTF-8, sorted object keys, compact separators, strict JSON integers, no NaN/floats, and no unknown fields. Hashes are SHA-256 over domain-separated canonical bytes. Suggested commitments:

- `state_hash = SHA256("scenariolab/director-state/v1\0" || canonical(current authoritative state))`;
- `context_hash = SHA256("scenariolab/director-context/v1\0" || canonical(DirectorContextSnapshot))`;
- `previous_history_hash = SHA256("scenariolab/director-history/v1\0" || canonical(ordered completed turn records))`;
- `proposal_hash = SHA256("scenariolab/director-proposal/v1\0" || canonical(proposal payload))`;
- `result_hash = SHA256("scenariolab/director-result/v1\0" || canonical(TurnResult and resulting state))`.

For the first turn, the previous-history hash is a defined hash of the empty prefix plus pinned run identity. Every later proposal and receipt bind the current prefix hash. The backend recomputes all hashes; it does not accept supplied state hashes as proof by themselves.

### Signature verification and key management

The proposal and receipt signatures use separate domain strings, such as:

```text
HMAC-SHA256(key[kid], "scenariolab/director-proposal/v1\0" || kid || "\0" || canonical(payload))
HMAC-SHA256(key[kid], "scenariolab/director-receipt/v1\0"  || kid || "\0" || canonical(payload))
```

The backend validates the Pydantic envelope and version first, selects only a configured `key_id`, recomputes the MAC, and compares it with `hmac.compare_digest`. It then checks scenario ID/version, seed, profile ID/version, turn, state hash, context hash, previous-history hash, proposal hash, selected option, and result hash against the replay it just performed. A valid MAC proves the backend issued the bytes; it does not prove that provider prose is true. Semantic validation and engine replay remain required. To make an identical duplicate turn request return byte-for-byte the same receipt across key rotations, sign its receipt with the verified proposal's key ID and retain that key while such records remain supported. Otherwise the replayed result is still deterministic, but a newly signed receipt may differ after rotation.

HMAC is the recommended MVP: it uses Python's standard library and only the backend verifies and signs. It is an authenticated MAC rather than a public-key digital signature; all replicas that sign or verify need the same protected key ring. Ed25519 would allow a signing service to hold a private key while API replicas hold public verification keys, but adds operational/key-management complexity and has no MVP benefit when signing and verification are in the same backend trust boundary.

Keep keys in the hosting platform's runtime secret manager. Never send, log, or store keys in React, local saves, fixtures, prompts, or container images. Include a non-secret `key_id` in each signed envelope. Rotate by deploying a new active signing key while retaining prior keys as verify-only. All replicas must agree on the accepted key ring before new keys are used. Because there is no server-side list of active local saves, removing an old verification key invalidates every save signed only by it. Retain old keys for the supported save lifetime, or announce a format/key cutoff and provide a clear restart path. Key compromise requires removing the compromised key, which deliberately invalidates its outstanding Director records.

### Integrity limits without a database

Changing an effect, situation, choice, selected choice, scenario/version, seed, turn, prefix order, or result breaks a MAC/hash or fails replay comparison. Reordering or inserting records fails the chain. Replacing a selected choice with another valid choice fails the signed receipt.

One limit is fundamental: a stateless server cannot distinguish an old, valid prefix from the latest valid prefix if a user deletes the tail of local storage. The shortened save reconstructs to a legitimate earlier point. HMAC cannot prevent rollback, erase a valid local backup, or prove the current save is the newest. If anti-rollback or prize/audit-grade progress is required, add server-held monotonic run heads (a small database or shared state service) in a separately approved brick. Do not claim that stateless signatures prevent rollback.

## 7. Proposed API and frontend behavior

Keep `/api/games/start`, `/api/games/turn`, and `/api/ai/briefing` working unchanged for existing scripted runs. Director runs begin through the separate Director proposal API; no Director flag or branch is added to the existing game endpoints in 9B-1.

### `POST /api/ai/director/proposal`

Request:

```json
{
  "format_version": 2,
  "mode": "director",
  "scenario_id": "startup-survival",
  "scenario_version": "1.0.0",
  "seed": 42,
  "profile_id": "startup-survival-director",
  "profile_version": "1.0.0",
  "turn_records": []
}
```

The server validates the scenario/profile allowlist, reconstructs the exact state from `turn_records`, derives the immutable context snapshot, and returns the state, signed fallback proposal, and deterministic previews for each choice. It does not advance the turn. This stage has no UI or local pending-proposal persistence.

### `POST /api/ai/director/turn`

Request:

```json
{
  "scenario_id": "startup-survival",
  "scenario_version": "1.0.0",
  "seed": 42,
  "profile_id": "startup-survival-director",
  "profile_version": "1.0.0",
  "turn_records": [],
  "proposal": {
    "payload": {"record_format_version": 1, "...": "full proposal payload"},
    "signature": {"algorithm": "HMAC-SHA256", "key_id": "director-2026-01", "value": "<43-character base64url MAC>"}
  },
  "selected_choice_id": "director-choice-...-1"
}
```

The server validates the replay prefix and current proposal, looks up the selected option only inside the signed proposal, rechecks policy/affordability, resolves through the engine, and returns the state, authoritative `TurnResult`, and signed `turn_record`. A replay request never includes or regenerates a new proposal. Stale proposals return `409`, malformed/tampered records return `422`, unsupported scenario/profile return `409`, unavailable/disabled signing returns `503`, and oversized requests return `413`.

### `POST /api/ai/director/replay`

This endpoint accepts the same v2 identity and completed `turn_records` as the proposal endpoint. It verifies every signed proposal and receipt, reconstructs each turn through the engine, and returns the current state, latest record, and latest `TurnResult`. It does not call a provider or select fallback content. Use it to resume a v2 Director transcript; version-1 scripted saves continue to use `/api/games/start` and `/api/games/turn`.

### Frontend presentation

- Keep the existing premium Classic/Dark tokens and cards. The Startup Survival mode selector leaves the catalog and dashboard intact.
- Show the signed situation headline and description with an “Authored fallback” badge from the signed proposal's server-assigned `source`.
- Render two to four choice cards with narrative text and server-computed metric previews. Label pre-choice values as previews. After selection, render the actual `TurnResult.metric_changes` as authoritative consequences.
- Show a generated Director situation and any deterministic scripted event as separate timeline entries. Keep the server's terminal status/outcome and current metric history as the authority.
- Keep the currently displayed proposal in memory. After an accepted turn, store the signed proposal, selected choice ID, and signed receipt in the v2 history. On resume, validate completed records server-side and replay without provider calls, then request a proposal for only the incomplete turn. On restart, use a new seed and empty version-2 history after confirming saved-progress replacement.
- Continue to recognize version-1 scripted saves and resume them through the current static action endpoints. Never auto-convert a version-1 action history into Director records.
- Do not request the existing briefing endpoint for Director turns unless a later design adds a Director-aware briefing contract. The situation, approved choices, and authoritative outcome are enough for this MVP and avoid a second provider call per turn.

## 8. Reliability, cost, and security

- Keep `SCENARIOLAB_DIRECTOR_ENABLED=false` by default. In 9B-2A the flag gates fallback proposal generation and is independent of `SCENARIOLAB_AI_ENABLED`; the browser cannot bypass the API gate. Any live proposal generation belongs to 9B-2B and must require both backend flags plus backend-only provider configuration. The browser cannot select a model or provider URL.
- Reuse the application-owned provider boundary or add `generate_director_proposal(context)` behind it. Do not expose provider response classes to the domain or engine.
- Use current timeout/token/request-body controls, a strict proposal response byte cap, no automatic retry, and a deterministic fallback. The fallback uses authored JSON/profile data and a seeded selector; it is not another provider call.
- Use a bounded in-process proposal cache and single-flight lock keyed by the full immutable context snapshot, plus the existing per-process attempt/concurrency controls. Cache content only after it passes all validation. Same-process duplicates should reuse the proposal. A multi-replica deployment can still duplicate calls unless a shared cache/lock is added.
- The best-effort MVP policy is one provider generation attempt per unique `(scenario/version, seed, profile/version, turn, state hash, history hash)` snapshot, and at most one accepted Director record for each of Startup Survival's 12 turns. This does not impose a hard generation cap: a caller can repeat requests after a process restart or through another replica. A hard per-game provider-call ceiling requires shared run state or an equivalent shared idempotency store; do not claim that the stateless transcript provides it. Keep public live generation disabled until the cost boundary is shared and enforceable.
- Retain Brick 8A requirements: public live AI remains off until shared gateway/WAF rate limits cover the proposal endpoint, the API origin cannot be bypassed, provider project/model restrictions and hard spend controls are configured, and usage is observable. CORS alone does not restrict direct requests. Process-local limits do not protect aggregate replica traffic.
- Treat context fields as data, not instructions. Do not include user documents or URLs in this brick. Reject unknown provider fields/operators/metrics; render strings as text, never HTML. Never execute generated code, templates, or expressions.
- HMAC protects record integrity, not confidentiality or quality. Local saves reveal the story and options to the player. Prevent unsupported numerical claims in model prose; display numeric consequences from the typed effects and engine results only.
- Cap content at bounded lengths/counts before signing. Each complete signed turn record (proposal plus receipt) is at most 4,096 UTF-8 bytes; there are at most 12 completed records; the Director request/save transcript is at most 56,000 bytes. This leaves space under the existing default 65,536-byte request-body limit. Enforce actual UTF-8 serialized bytes on the backend and client; do not rely only on character counts. Reject over-limit saves/requests without truncation.

Brick 8B can proceed independently. It may deploy the existing scripted game and briefing path with Director disabled. The Director must not be a dependency for a public launch, and 9B must not weaken the edge/origin protections required for existing AI.

## 9. Brick 9B implementation plan

1. ✅ **Brick 9B-1 — Freeze fallback profile and record contracts.** Strict Pydantic profile/context/proposal/receipt/history models, context/record versions, startup-only metric allowlist, and exact limits are implemented. Prompt versioning belongs to 9B-2 because this stage makes no provider calls.
2. ✅ **Brick 9B-1 — Add generic transient engine resolution.** Scripted and transient actions share the authoritative transition pipeline; existing scripted signatures and behavior are preserved.
3. ✅ **Brick 9B-1 — Validate choices, preview outcomes, and provide fallback.** Effect limits, affordability, distinct choices, state bounds, deterministic curated events, and terminal evaluation are covered before proposal signing.
4. ✅ **Brick 9B-1 — Authenticate proposals, choices, and results.** Canonical JSON, domain-separated digests, HMAC verification, key IDs/key ring, and structured missing-key errors are implemented.
5. ✅ **Brick 9B-1 — Add stateless proposal, turn, and replay APIs.** Replay verifies signed records and never calls a provider. A provider cache/single-flight mechanism is deferred because no provider is connected in 9B-1.
6. ✅ **Brick 9B-2A — Add version-2 browser persistence.** Keep strict format-1 scripted saves intact; store only signed completed records and replay them through the backend without saving metrics/status or migrating old runs.
7. ✅ **Brick 9B-2A — Present fallback Director gameplay.** Add mode selection, signed choices/previews/source/history, terminal report reuse, themed restart/mode switching, and a visible Classic path when Director is disabled. No provider integration is included.
8. ⬜ **Brick 9B-2B — Add live proposal generation.** This remains deferred; require the documented provider gate, shared edge controls and budget limits, and fake-only provider tests before implementation.
9. ✅ **Brick 9B-2A — Run frontend and replay verification.** The complete backend Pytest, Vitest, production frontend build, full Playwright Chromium suite, headed Director smoke, three-turn reload/replay, tamper rejection, and screenshot review pass. Public Director generation and deployment remain disabled.

### Acceptance criteria

- Only Startup Survival with the pinned, supported Director profile can start Director mode; all other scenarios and profile versions are rejected.
- Every proposal is strict schema-valid, has two to four unique meaningful choices, uses only declared metrics and policy-allowed `add`/`subtract`, meets effect/cost/turn/byte limits, and is full-turn-previewable.
- The backend—not AI or React—owns current state, affordability, bounds, effect application, event selection, metrics, and terminal evaluation.
- Every accepted Director turn stores a signed proposal and signed choice/result receipt bound to the scenario/version, profile/version, seed, turn, snapshot, and prior history.
- Editing an effect, selection, scenario/version, seed, ordering, receipt, or resulting value is rejected. A duplicate identical turn request produces the same result; a stale proposal is rejected.
- A full local resume reconstructs all completed turns and scripted events without provider requests. Resume requests a proposal only for the current incomplete turn; completed turns are never regenerated. Version-1 scripted saves still resume through the static path; no silent migration occurs.
- AI disabled, missing configuration, provider timeout/error, invalid JSON, unsupported output, and invalid choices all use a validated deterministic fallback or return a safe non-advancing error.
- Pytest/Vitest/Playwright all use injected fakes, deterministic fallback, or route mocks; no test requires a key or makes billable provider requests.
- Existing backend/frontend/Playwright regressions, terminal behavior, 12-turn limit, save/resume, and restart all continue to pass. Production deployment remains AI-off until shared limits are in place.

### Test strategy

| Layer | Required cases |
| --- | --- |
| Pydantic/profile | Valid minimal/full proposals; unknown fields, metrics, operators, IDs; malformed/duplicate choices; too few/many choices/effects; overlong strings; unsupported numeric values; profile-version mismatch. |
| Effect policy/engine | Per-effect and per-choice caps; aggregate cash debit; insufficient cash; direct cash/revenue creation; score/resource bounds; atomic rejection; recurring cash-flow interaction; deterministic scripted event eligibility and effects; terminal evaluation only by the engine; no partial state mutation. |
| Integrity/replay | Valid HMACs; modified effect, selected option, state/context/history hash, scenario/version, seed, turn, result hash, key ID, and signature; reorder/insertion rejection; stale proposal; legacy scripted action replay; deterministic 12-turn Director replay with zero provider calls. |
| Provider/reliability | AI off; missing key; fake-provider success; timeout, HTTP/rate-limit, oversized/malformed JSON, unsafe prompt-like fields, cache hit, same-process concurrent duplicate, fallback after validation rejection, and no secret/error leakage. |
| API/lifecycle | Proposal does not advance state; selected choice advances exactly once; duplicate submission is deterministic; invalid/stale choice rejected; generated beat and scripted event recorded separately; active, terminal, and turn-limit behavior; request and transcript size boundaries. |
| Frontend/save | Version-1 classic save resumes unchanged; strict v2 history validates and replays; tampered save displays a recoverable error and is not overwritten; resume does not request prior turns or call AI; theme-aware choices, previews, badges, history, and report. |
| Playwright | Three-turn Director path, reload, signed replay, continuation and terminal report; tampered replay rejection; disabled Director fallback to Classic; mode-switch confirmation; provider calls remain zero; mobile and desktop choice/history views in both themes; existing scripted E2E suite still passes. |

## 10. Risks and deferred work

### Known technical risks

- HMAC records detect edits but not rollback to an earlier valid local-save prefix. Anti-rollback requires server-held state.
- A shared secret in all API replicas simplifies verification but raises the impact of one replica compromise. Ed25519 signing separation can be considered if the service boundary later justifies it.
- Process-local cache/single-flight and rate limits do not enforce aggregate or per-run generation ceilings across replicas/restarts. Public live Director requires shared edge controls and provider spend caps.
- The existing static effect schema is expressive enough to produce dangerously large changes without the new scenario profile. It must never be applied directly from raw model JSON.
- Large histories can be replayed repeatedly by a public caller. The 12-turn cap limits one transcript; shared request limits remain required.
- The version-1 `SavedRun` model is strict, and current routes resolve the registered definition rather than a version registry. Brick 9B must preserve v1 replay and exact-version behavior before changing any definition registry.
- “Meaningful” and “non-repetitive” are partly editorial properties. Closed beat IDs, distinct effect fingerprints, cooldowns, tests, and human review cover the MVP without claiming natural-language semantic understanding.

### Postpone until after submission

- Director support for Cybersecurity Crisis, Space Colony, or custom scenarios.
- AI-authored `ScenarioDefinition`s, new event triggers, dynamic terminal criteria, or event selection.
- Document, PDF, URL, or free-form user-prompt context; multi-source ingestion and provenance review.
- Embedding-based semantic similarity, long-lived campaigns, cross-device accounts, cloud save sync, leaderboards, or multiplayer.
- Strong anti-rollback guarantees, cross-replica idempotent generation, and a database/shared cache. Add them only if public abuse, prize integrity, or product needs require server-held state.
- Multiple providers, agent chains, tool use, fine-tuning, or unbounded narrative generation.

Keep the launch scope to validated per-turn situations/options for Startup Survival and the existing deterministic engine. If the security, replay, and no-billable-test acceptance criteria cannot be met before the internal freeze, ship Brick 8B with Director disabled and defer 9B rather than weakening the boundaries.

## 11. Brick 9B-1 engine and API contract

This implementation stage is fallback-only. The Director service does not import or invoke the AI provider. The `director_enabled` backend setting defaults to false; the existing `ai_enabled` setting does not enable Director generation.

### Domain and engine interfaces

- `DirectorProfile`, `DirectorContextSnapshot`, `DirectorSituation`, `DirectorChoiceCandidate`, `DirectorChoice`, `DirectorEffect`, `DirectorChoicePreview`, `DirectorProposalPayload`, `SignedDirectorProposal`, `DirectorTurnRecord`, `DirectorReceiptPayload`, `SignedDirectorReceipt`, and `DirectorReplayHistory` are frozen, `extra="forbid"` Pydantic v2 models.
- The profile is `startup-survival-director@1.0.0`, pinned to `startup-survival@1.0.0`. It allows 2–4 choices, up to 3 effects per choice/turn, and the metric caps in section 4. Direct cash and monthly-revenue gains are prohibited. Subtracting money/resources cannot exceed their current values. Engine full-turn previews enforce all remaining metric bounds, recurring calculations, seeded events, and outcomes.
- `resolve_turn(definition, state, action_id)` retains its scripted signature. `resolve_transient_action(definition, state, action, provenance_digest=...)` rejects static action ID collisions, invalid targets/transfers, and invalid provenance, then shares the same engine pipeline. The application remains responsible for authenticating the proposal and enforcing the Startup Survival profile.
- The Director beat is pre-decision text. It is not inserted into `ScenarioDefinition.events`, has no effects, and does not count as a second turn. The selected transient action runs first, followed by recurring rules, at most one deterministic curated event, then terminal evaluation, matching the existing engine order.

### Authored fallback set

The service has four authored situation families (acquisition offer, supplier contract, employee retention, major customer partnership), with three distinct headlines per family to support the 12-turn limit without repeating a normalized headline. Each situation offers three authored tradeoff choices using only the profile's existing `add`/`subtract` effects. For each current state, the backend hashes the run identity, metrics, turn, recent decisions/events, and prior Director beats/headline digests to choose a deterministic order. It applies the three-turn beat cooldown and exact headline deduplication. It never edits an invalid proposal; if no whole authored proposal has two or more valid full-turn previews, the request returns a non-advancing `409 no_valid_fallback`.

### Signatures and configuration

Canonical payload bytes are UTF-8 JSON with sorted keys, compact separators, no NaN, and strict integer fields. SHA-256 digests use `scenariolab/<domain>/v1\0`; HMACs use separate `director-proposal` and `director-receipt` domains and include the key ID. Verification compares MAC bytes with `hmac.compare_digest`.

Configure `SCENARIOLAB_DIRECTOR_ENABLED=true` only for controlled validation, and set:

```text
SCENARIOLAB_DIRECTOR_ACTIVE_SIGNING_KEY_ID=director-2026-01
SCENARIOLAB_DIRECTOR_SIGNING_KEYS={"director-2026-01":"<at least 32 random UTF-8 bytes>"}
```

The key ring is backend-only. An active key ID must exist in the ring. New proposals use the active key; receipts use the proposal's key ID so identical retries return the same receipt during rotation. Keep older keys as verify-only while their records remain supported. Missing configuration returns structured HTTP 503 `director_signing_unavailable`; there is no ephemeral key or reuse of the AI provider key.

### Replay and compatibility

The v2 `DirectorReplayHistory` envelope includes `format_version: 2`, `mode: "director"`, scenario/version, seed, profile/version, and up to 12 completed signed records. Each record contains the signed proposal, selected choice ID, and signed receipt. The service validates the HMACs, prior state/history digests, context snapshot/digest, turn sequence, profile limits, selected effects, resulting state digest, and result digest before accepting each record. It initializes from the exact Startup Survival definition and seed, applies each accepted choice through `resolve_transient_action`, and never calls or regenerates AI/fallback content during replay.

Each complete signed record is capped at 4,096 UTF-8 bytes; serialized v2 request history is capped at 56,000 bytes under the existing default 65,536-byte request limit. Brick 9B-2A adds strict format-2 browser persistence and Director UI while the `/api/games/*` scripted contracts remain unchanged. There is no automatic migration and no persisted pending proposal.

No server state is stored. A repeated identical turn request replays to the same state and receipt, but this is deterministic idempotence, not global exactly-once execution. HMACs reject edits and bind records to the requested scenario/version/seed/turn/state/history; they cannot distinguish the latest save from an earlier valid prefix or prevent deliberate branching from a valid prefix. Anti-rollback requires server-held monotonic state, which is outside 9B-1.

### Current route examples

The proposal request uses the v2 identity object shown earlier with an empty `turn_records` array. The turn request adds the complete signed proposal and one selected ID:

```json
{
  "format_version": 2,
  "mode": "director",
  "scenario_id": "startup-survival",
  "scenario_version": "1.0.0",
  "seed": 42,
  "profile_id": "startup-survival-director",
  "profile_version": "1.0.0",
  "turn_records": [],
  "proposal": {"payload": "<signed proposal payload>", "signature": {"algorithm": "HMAC-SHA256", "key_id": "director-2026-01", "value": "<MAC>"}},
  "selected_choice_id": "director-choice-<content-digest>-1"
}
```

`POST /api/ai/director/replay` receives the identity object and completed `turn_records` only. It returns current state and the latest authoritative `TurnResult` without generating a new proposal. Requests with unsupported profile/scenario versions, stale proposals, invalid signatures, terminal histories, malformed records, or excessive size fail with structured errors.

## 12. Brick 9B-2B scope (not implemented)

9B-2B may add a provider-owned structured proposal method only after the backend gate requires both `SCENARIOLAB_DIRECTOR_ENABLED=true` and `SCENARIOLAB_AI_ENABLED=true`, and shared edge controls and provider budgets are verified. The format-2 browser save, fallback Director presentation, signed history, resume/restart flow, and source indicator are already part of 9B-2A. 9B-2B must preserve v1/v2 saves and must not add another scenario, general expression evaluator, database, or authentication system.

## 13. Brick 9B-2A implementation record

### Frontend routes and mode behavior

- Startup Survival presents Classic Simulation and AI Scenario Director. Classic remains the default choice for a new run. Cybersecurity Crisis and Space Colony remain Coming Soon.
- Director availability is checked through the existing `POST /api/ai/director/proposal` contract after authoritative start/reconstruction. The frontend does not bypass `director_enabled`. A structured disabled/signing error offers Classic Simulation.
- Director turns use `POST /api/ai/director/turn` with the complete signed proposal, completed signed prefix, and selected choice ID. The browser renders the returned state, `TurnResult`, and receipt only after backend verification.
- Director history joins signed proposal situations and selected choices with `GameState.decision_history` metric changes, event IDs, status, and outcome. Existing metric charts and terminal report are reused. Director does not request AI briefings.

### Local save contract

The strict format-2 `scenariolab.saved-run` value matches the `DirectorReplayHistory` identity and records and includes no pending proposal. Its identity fields are `format_version`, `mode`, `scenario_id`, `scenario_version`, `seed`, `profile_id`, and `profile_version`. The ordered `turn_records` array contains `DirectorTurnRecord` objects. Each record has a `proposal` (`SignedDirectorProposal` with `payload` and `signature`), a `selected_choice_id`, and a `receipt` (`SignedDirectorReceipt` with `payload` and `signature`).

The pending current-turn proposal remains in memory only. On reload the browser sends the version-2 envelope to `POST /api/ai/director/replay`, verifies the response identity, state, record count, latest record/result, and original seed, then requests one proposal for the incomplete turn if the game remains active. Completed proposals are never requested again. A terminal save restores its terminal report without requesting a proposal. The current deterministic fallback returns the same proposal for the same state/history.

Format 1 remains strict and resumes via the existing `/api/games/start` and `/api/games/turn` replay. The single localStorage key holds one run. Switching modes or restarting with existing progress asks before replacing it. Restore failures do not write to localStorage. A structurally valid but tampered signature is rejected by backend replay; the stored value remains unchanged.

### Verification commands and evidence

Run from the repository root or the indicated workspace:

```powershell
uv run --project backend --no-sync pytest backend/tests
cd frontend
npm test
npm run build
npm run test:e2e
npm run test:e2e:headed -- --grep "Director completes three signed turns"
```

Playwright injects a test-only backend signing key and leaves live AI disabled. The tested Director path completes three turns, reloads, verifies the signed transcript, continues from turn four, and reaches an engine terminal state. A network-only receipt tamper is rejected by backend replay while the original valid local save remains unchanged. Desktop and mobile light/dark screenshots are captured and reviewed.

### Known limits

- Only the pinned Startup Survival v1.0.0 Director profile is supported.
- The pending current-turn proposal is not in local storage; a reload requests it again. This applies only to an incomplete turn, not a completed turn.
- Saves are local to one browser profile. There is no account, cross-device sync, server-side monotonic run head, or rollback protection for earlier valid prefixes.
- Director stays unavailable unless the backend flag and signing key ring are configured. Live AI generation, public deployment, and Brick 9B-2B remain incomplete.
