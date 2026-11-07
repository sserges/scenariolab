# Deployment and Security Readiness (Brick 8A)

This is a preparation guide only. No account, paid plan, cloud resource, API key, or deployment was created for Brick 8A.

## Recommended hosting shape

For a small public demo, use a static React/Vite frontend and a separate containerized FastAPI API:

- **Frontend:** Cloudflare Pages, repository root directory `frontend`, build command `npm ci && npm run build`, output directory `dist`. Set `VITE_API_BASE_URL` to the HTTPS API origin in the Pages build environment. Vite embeds this URL into public JavaScript; it must never contain a secret. Cloudflare Pages documents the Vite `dist` output and serves the SPA root for unmatched routes when no top-level `404.html` is present ([build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/), [SPA behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/)). The checked-in `frontend/public/_headers` adds basic browser security headers.
- **Backend:** Render Docker Web Service using Dockerfile path `backend/Dockerfile` and repository-root Docker context `.`. Configure HTTP health check path `/api/health`; the image also defines a Docker health check. Render supports Dockerfile-based web services, runtime environment variables, and HTTP health checks ([Docker services](https://render.com/docs/docker), [environment variables and secrets](https://render.com/docs/configure-environment-variables), [health checks](https://render.com/docs/health-checks)). The container listens on `0.0.0.0:$PORT`, defaults to port 8000 locally, and runs as an unprivileged user.

This split has separate frontend and API origins, so set `SCENARIOLAB_FRONTEND_ORIGIN` to the exact deployed frontend origin (scheme and host only, no path). CORS remains a one-origin allowlist. Both services should use their hosting platform's managed HTTPS. Do not select a plan until expected availability, cold-start behavior, resource limits, and budget are reviewed.

Render Static Sites are an alternative frontend host. Configure the Vite output directory `frontend/dist` and add a rewrite from `/*` to `/index.html` if the app later adds client-side routes; Render documents SPA rewrites in its [redirects and rewrites guide](https://render.com/docs/redirects-rewrites). Hosting product limits and prices can change; review current provider docs and account terms at the time of deployment.

## Configuration

The examples are safe templates, not deployment secrets:

- [frontend/.env.production.example](../frontend/.env.production.example) contains the public API base URL placeholder. The Vite value is captured at build time; changing it requires a frontend rebuild/redeploy.
- [backend/.env.production.example](../backend/.env.production.example) is a checklist of runtime settings. Enter values in the backend hosting environment; do not upload a real `.env` file or bake one into the image.

Production settings require `SCENARIOLAB_ENVIRONMENT=production`, an HTTPS `SCENARIOLAB_FRONTEND_ORIGIN`, and an HTTPS provider URL. The safe default is `SCENARIOLAB_AI_ENABLED=false`; the simulation and deterministic fallback remain playable. Enable live AI only after shared edge limits and origin protection are configured. If enabled, supply `SCENARIOLAB_AI_API_KEY` using the host's runtime secret manager, plus the selected model. Never put the key in `VITE_*`, frontend build variables, Docker build arguments, a source file, or logs. Prefer a dedicated project/workload credential with only the required access and a reviewed rotation/expiration policy, following [OpenAI's API key guidance](https://developers.openai.com/api/docs/guides/api-keys).

Production values to review:

| Setting | Production expectation |
| --- | --- |
| `SCENARIOLAB_ENVIRONMENT` | `production` |
| `SCENARIOLAB_FRONTEND_ORIGIN` | Exact HTTPS browser origin, e.g. `https://demo.example.com` |
| `SCENARIOLAB_MAX_REQUEST_BODY_BYTES` | Default 65,536 bytes; maximum configurable value 1,048,576 |
| `SCENARIOLAB_AI_ENABLED` | `false` until gateway and provider cost controls are verified |
| `SCENARIOLAB_DIRECTOR_ENABLED` | `false`; Brick 9B-1 Director APIs are fallback-only and separately disabled |
| `SCENARIOLAB_AI_API_KEY` | Runtime secret only when live AI is enabled |
| `SCENARIOLAB_AI_BASE_URL` | HTTPS OpenAI-compatible API origin |
| `SCENARIOLAB_AI_PROVIDER_CALLS_PER_MINUTE` | Per-process guard; production example uses 5 |
| `SCENARIOLAB_AI_MAX_CONCURRENT_PROVIDER_CALLS` | Per-process in-flight cap; production example uses 1 |
| `VITE_API_BASE_URL` | Public HTTPS API URL, compiled into the frontend |

Example container build from the repository root:

```sh
docker build -f backend/Dockerfile -t scenariolab-api .
```

For a local container smoke run, use fallback-only mode and public, nonsecret settings:

```sh
docker run --rm -p 8000:8000 \
  -e PORT=8000 \
  -e SCENARIOLAB_ENVIRONMENT=production \
  -e SCENARIOLAB_FRONTEND_ORIGIN=https://demo.example.com \
  -e SCENARIOLAB_AI_ENABLED=false \
  scenariolab-api
```

The API health check is `GET /api/health` and reports process/API health only; it deliberately does not require a provider or make a provider call. The browser status widget reports backend unavailability; static hosting must independently report frontend deployment health.

## Public AI protection: required before enabling live calls

The endpoint `/api/ai/briefing` is public and has no authentication. CORS is not access control. Its replay inputs are bounded and backend-reconstructed, but callers can submit repeated valid histories directly. The in-process rate limiter, 256-entry exact-context cache, and concurrency semaphore each apply to one process only; replicas multiply those limits, cache misses for distinct histories still call the provider, and concurrent identical cache misses are not single-flight deduplicated. The current caller key is the ASGI peer address. Behind a proxy, requests can share the proxy's address unless forwarded identity is configured safely. Do not trust arbitrary `X-Forwarded-For` from a public client.

Brick 9B-1 adds separate Director signing configuration and routes, but its public default remains disabled. If enabled for controlled validation, configure `SCENARIOLAB_DIRECTOR_ACTIVE_SIGNING_KEY_ID` and `SCENARIOLAB_DIRECTOR_SIGNING_KEYS` as runtime secrets; do not reuse the AI provider key. Missing signing configuration returns a structured error and never creates an ephemeral signing key. Public Director generation is not available in 9B-1; keep `SCENARIOLAB_DIRECTOR_ENABLED=false` for Brick 8B.

Before publicly enabling billable AI:

1. Put a shared gateway/WAF in front of the API. Apply a per-client shared rule to `/api/ai/briefing` and reasonable request controls to the other API routes.
2. Make the API origin reachable only through that gateway, or require a gateway-only credential that the browser never sees. A public origin URL that can be called directly bypasses edge limits.
3. Configure project model access and request/token limits; set project and organization spend alerts plus an enforced hard spend limit. Alerts notify but do not block requests; hard-limit enforcement can lag, so it is not an exact dollar ceiling ([OpenAI spend limits](https://developers.openai.com/api/docs/guides/spend-limits)).
4. Keep the app token cap, timeout, concurrency cap, and no-retry behavior. Monitor request volume, provider fallback rate, spend, and the shared gateway's rejected traffic without logging credentials or full prompts.
5. Exercise the gateway and origin bypass path with AI disabled first. Then enable AI only after the operator verifies that direct-origin requests are denied and the provider budget controls are active.

Cloudflare rate-limiting rules are an option at an appropriate account tier; their available rule counts, counting periods, and actions vary by plan ([Cloudflare WAF rate-limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)). A Cloudflare front end by itself does not protect a separately public API origin. This repository does not configure shared edge rules or origin restriction, so **live AI is not cleared for public use yet**. Keep it disabled; fallback is the safe demo mode.

## Privacy and operational notes

- There are no accounts, authentication cookies, analytics SDKs, or user profile fields.
- Local browser saves contain replay identity and accepted action IDs only. They are untrusted client data and are revalidated through backend replay.
- The backend sends simulation context to the selected provider only when live AI is enabled. Avoid personal or confidential inputs; review the provider account's data handling and applicable terms before use.
- Platform access logs may include IP address, request path, status, and timing. Set log access and retention deliberately. Do not add request-body, authorization-header, provider-prompt, or secret logging.
- `/api/health` is intentionally a minimal liveness endpoint and exposes no configuration or credentials.
- Preserve `frontend/package-lock.json` and `backend/uv.lock`; use `npm ci` and `uv sync --locked` in release builds. This document is not a dependency vulnerability or license audit.

## Checks before an actual deployment

- Set the frontend production build URL and backend exact-origin CORS setting; verify a browser preflight and real browser API request over HTTPS.
- Verify `/api/health`, backend logs, runtime environment, and hosting-platform health checks without exposing environment values.
- Verify fallback-only gameplay and provider failure in the deployed stack with AI disabled.
- Verify the edge rejects abusive rates and that direct access to the API origin cannot bypass it.
- If live AI is later authorized, verify secret injection, provider project/model limits, alerts, hard cap, and one controlled nonproduction request before public exposure.
- Review eligibility, demo access, screenshots/video, attribution, data policy, and the final Devpost form against the official hackathon materials before submission.
