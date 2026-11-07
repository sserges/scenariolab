# ScenarioLab API and Engine

The package contains the FastAPI scenario catalog, stateless game transport, pure deterministic simulation engine, outcome-grounded AI briefing service, and the fallback-only Brick 9B-1 Director foundation. `POST /api/games/start` initializes a scripted run; `POST /api/games/turn` reconstructs prior state and resolves one new action; `POST /api/ai/briefing` independently reconstructs a completed history and narrates only its latest recorded outcome. Director proposal, turn, and replay routes use signed v2 transcripts. No server-side game session is stored.

## AI service boundary

`scenariolab_api.ai` owns four concerns:

- `grounding.py` converts a validated `ScenarioDefinition` and immutable `TurnResult` into established facts.
- `provider.py` implements the `AIProvider` protocol with an OpenAI-compatible `/chat/completions` adapter.
- `models.py` strictly validates the five bounded narrative fields and the internal grounding context.
- `service.py` applies live-response caching, a per-caller provider-attempt limit, sanitized failure handling, and deterministic fallback.

The provider receives the scenario title/objective, completed and current turn, selected action, optional triggered event, exact metric changes, current metrics, game status, and outcome reason. It cannot submit metrics, choose events, mutate state, or run during individual replay steps. Provider output is presentation text only and is never executed.

## Configuration

Settings use the existing `SCENARIOLAB_` backend prefix:

```dotenv
SCENARIOLAB_ENVIRONMENT=development
SCENARIOLAB_AI_ENABLED=false
SCENARIOLAB_AI_API_KEY=
SCENARIOLAB_AI_MODEL=gpt-4.1-mini
SCENARIOLAB_AI_BASE_URL=https://api.openai.com/v1
SCENARIOLAB_AI_TIMEOUT_SECONDS=10
SCENARIOLAB_AI_MAX_RESPONSE_TOKENS=500
SCENARIOLAB_AI_PROVIDER_CALLS_PER_MINUTE=20
SCENARIOLAB_AI_MAX_CONCURRENT_PROVIDER_CALLS=2
SCENARIOLAB_DIRECTOR_ENABLED=false
SCENARIOLAB_MAX_REQUEST_BODY_BYTES=65536
```

Copy `.env.example` to the ignored `.env` for local configuration. Live AI stays disabled unless `SCENARIOLAB_AI_ENABLED=true`, a key, and a model are configured. Production additionally requires HTTPS for the exact frontend origin and provider endpoint. The provider URL is operator configuration and is never accepted from a browser request. Never put credentials in frontend variables, logs, fixtures, prompts, saved games, Docker build arguments, or tracked files.

Timeout is bounded to 1–30 seconds, response tokens to 100–800, and provider attempts to 1–120 per minute per caller in each application process. The default limits are 10 seconds, 500 tokens, and 20 attempts. Requests are not retried. Provider bodies larger than 64 KiB are rejected. A bounded 256-entry in-memory cache prevents repeated live calls for the same reconstructed outcome.

## Briefing API

Request:

```json
{
  "scenario_id": "startup-survival",
  "scenario_version": "1.0.0",
  "seed": 42,
  "action_history": ["reduce-operating-expenses"]
}
```

Response:

```json
{
  "source": "live",
  "headline": "Lean Operations Meet a Competitive Shock",
  "situation_summary": "The company tightened spending as market pressure intensified.",
  "consequence_explanation": "Cash and operating expenses decreased while team sentiment softened.",
  "strategic_insight": "Protect morale and customer trust while preserving the improved cost structure.",
  "next_turn_teaser": "A future turn may test whether the leaner plan can support renewed growth."
}
```

All five narrative strings are required, unknown fields are rejected, and field lengths are capped. Generated numeric claims must correspond to values present in the grounding context; the prompt asks the model to avoid digits entirely. The teaser must describe only hypothetical possibilities.

The endpoint rejects unknown or planned scenarios, version mismatches, empty histories, histories over the scenario turn limit, and impossible replays before any provider call. It accepts no client-authored state. Provider absence, timeout, HTTP/rate-limit errors, invalid or oversized JSON, schema failure, and unsupported numeric claims return HTTP 200 with `source: "fallback"`. Raw provider failures and credentials are never returned.

## Director API foundation (Brick 9B-1)

This stage supports only authored deterministic Startup Survival proposals. The Director never calls the AI provider, regardless of `SCENARIOLAB_AI_ENABLED`; no Director UI is connected. The routes return HTTP 503 with `director_disabled` unless `SCENARIOLAB_DIRECTOR_ENABLED=true` is explicitly configured.

Director signing is separate from the AI provider credential. Configure a random key ring through the hosting environment, for example:

```text
SCENARIOLAB_DIRECTOR_ACTIVE_SIGNING_KEY_ID=director-2026-01
SCENARIOLAB_DIRECTOR_SIGNING_KEYS={"director-2026-01":"<at least 32 random UTF-8 bytes>"}
```

The JSON object maps stable key IDs to key material. Keep old keys in the ring for verification during rotation and set one active key ID for new proposals. Missing or invalid signing configuration returns a structured `director_signing_unavailable` error; the service never creates an in-memory production key. Keep key material in the deployment secret manager, do not reuse `SCENARIOLAB_AI_API_KEY`, and do not put real values in `.env.example`, logs, fixtures, or browser data.

The v2 request identity includes format version, `mode: "director"`, `startup-survival@1.0.0`, seed, `startup-survival-director@1.0.0`, and ordered completed `turn_records`:

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

- `POST /api/ai/director/proposal` replays the completed prefix, then returns the current state, one signed fallback proposal, and deterministic previews. It does not advance the game.
- `POST /api/ai/director/turn` accepts that same prefix, the signed proposal, and one `selected_choice_id`; it verifies state/history bindings, resolves one choice through the shared engine path, and returns the authoritative `TurnResult` and signed `turn_record`.
- `POST /api/ai/director/replay` verifies and reconstructs completed records only. It never selects or regenerates a proposal and never calls a provider.

Proposal and receipt payloads use sorted-key compact UTF-8 JSON and domain-separated HMAC-SHA-256. Constant-time MAC comparison is used. The proposal binds all candidate effects to the scenario/version, seed, turn, context, prior state digest, and prior history digest. The receipt additionally binds the selected choice and resulting authoritative state/result digests. The application validates records before `resolve_transient_action`; the engine then applies effects, recurring rules, at most one seeded curated event, and terminal evaluation in its normal order. The Director situation itself is not a curated event and has no numeric effect.

Each completed record is capped at 4 KiB, and the full v2 request transcript is capped at 56,000 UTF-8 bytes beneath the default 65,536-byte body limit. Version-1 scripted saves and `/api/games/*` routes are unchanged; there is no automatic v1-to-v2 migration and no local Director save/UI integration in this stage. Stateless signatures reject edits and mismatched histories, but cannot prevent a user from restoring an earlier valid prefix or branching from it. Identical duplicate turn requests recompute the same result/receipt; the service has no persistent store and makes no global exactly-once claim.

## Tests and cost envelope

Run without a real API key or network access:

```powershell
uv run pytest
```

Tests use `httpx.MockTransport` and fake providers for successful responses, prompt grounding, timeout, HTTP failure, invalid JSON, rate limiting, caching, replay validation, fallback, immutability, and secret non-disclosure.

Startup Survival permits at most one briefing request after each of 12 completed turns. Provider billing varies by model and host; calculate expected cost from current provider rates as `input tokens × input rate + output tokens × output rate`, for at most 12 requests per run and no more than the configured output cap per request. The built-in limiter is per process, not a substitute for shared gateway rate limiting or authentication on a public multi-replica deployment.

The Brick 6 live-provider smoke test was completed once using the configured `gpt-4.1-mini` model. Brick 8A keeps live AI disabled by default (`SCENARIOLAB_AI_ENABLED=false`) and adds request-size and provider-concurrency bounds. Automated tests use mocked providers or fallback-only settings; they never make live requests. Public deployment still requires shared gateway rate limits and protection against direct-origin bypass before enabling billable AI. See `../docs/deployment.md`.
