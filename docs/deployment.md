# Public Release Candidate Deployment Guide (Brick 8B)

This guide prepares the fallback-only public release. No cloud service, paid plan, secret, commit, push, or deployment has been created by this preparation. Brick 8B remains incomplete until the real production URLs are reachable and the browser smoke plan below passes.

## Release behavior

The deployed build is intended to provide:

- Classic Simulation and AI Scenario Director for Startup Survival.
- Director situations from the authored fallback catalog, signed by the backend.
- Classic and Dark themes, authoritative metric outcomes, restart, terminal reports, and local save/resume for Classic v1 and Director v2.
- No provider credential and no billable provider request. Set `SCENARIOLAB_AI_ENABLED=false` and `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED=false`; set `SCENARIOLAB_DIRECTOR_ENABLED=true` for the signed fallback Director mode.

The Director signing key ring is still required when Director is enabled. Missing or invalid signing configuration fails closed: settings reject malformed key material or a mismatched active key ID, and Director requests return a structured HTTP 503 if no usable key ring is configured. There is no ephemeral production key.

## Hosting layout

Use a Cloudflare Pages static React/Vite site and a Render Docker Web Service. The browser's `VITE_API_BASE_URL` is a public HTTPS API origin compiled into the frontend. Provider credentials and Director signing keys are backend-only runtime settings.

### Render Docker Web Service settings

Create a **Web Service** connected to the release repository and `main` branch, with the Docker runtime:

| Dashboard setting | Value |
| --- | --- |
| Root Directory | Leave blank so paths are relative to the repository root |
| Dockerfile Path | `backend/Dockerfile` |
| Docker Context | `.` (repository root) |
| Docker Command | Leave blank; use the Dockerfile `CMD` |
| Health Check Path | `/api/health` |
| Port | Do not hard-code one. Render provides `PORT` (currently defaults to `10000`); the container binds to `0.0.0.0:$PORT` |
| Region / instance plan | Choose to suit expected audience, cold starts, resource limits, and budget |

The paths are deliberate: the Dockerfile copies `backend/pyproject.toml`, `backend/uv.lock`, `backend/README.md`, and `backend/src`. It installs production dependencies with `uv sync --locked --no-dev`, runs `scenariolab_api.main:app` with Uvicorn, and runs as an unprivileged user. It does not copy tests, local environments, or generated build output. The repository-root `.dockerignore` excludes `.env` files, virtual environments, caches, frontend dependencies/build output, and test reports. The Dockerfile's own health check calls `/api/health` on the runtime port; the endpoint does not check or call an AI provider.

Local image verification is **pending**. The Docker CLI is installed, but this machine cannot connect to the Docker Desktop engine. Do not treat the image as locally validated. Render's first remote Docker build must succeed from the repository-root context, and the deployed service must pass its HTTP health check before the frontend is pointed at it. Render's current setup is described in [Docker on Render](https://render.com/docs/docker), [web services and port binding](https://render.com/docs/web-services), and [health checks](https://render.com/docs/health-checks).

### Cloudflare Pages settings

In Cloudflare, open **Workers & Pages → Create application → Pages → Connect to Git**, authorize the GitHub/GitLab integration, and select the ScenarioLab repository. Set `main` as its production branch, then configure:

| Dashboard setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Production environment variable | `VITE_API_BASE_URL=https://<render-service>.onrender.com` |

`VITE_API_BASE_URL` is read by `frontend/src/lib/api.ts`; the client appends `/api/...`, so use only the HTTPS API origin, without `/api`, credentials, query, or secret. Vite embeds it at build time, so changing it requires a Pages rebuild/redeploy. Never put provider credentials or signing keys in a Vite variable. Cloudflare's [Git integration guide](https://developers.cloudflare.com/pages/get-started/git-integration/) covers repository authorization and production branch setup. Its [React/Vite build settings](https://developers.cloudflare.com/pages/configuration/build-configuration/) use `npm run build` and `dist`; this repository's build command adds `npm ci` to install exactly from the checked-in lockfile.

The current public files have no top-level `404.html` or `_redirects`; Pages' default SPA behavior serves `/` for unmatched paths. Keep that behavior unless routing changes. `frontend/public/_headers` adds:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

Cloudflare Pages also applies its documented default response headers. The checked-in file does not currently set a Content Security Policy or Strict Transport Security header. See [Pages SPA behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/).

## Render runtime environment

Set these values in the Render service's runtime **Environment** page. Add them manually or from a sanitized template; do not upload `backend/.env`, and do not use Docker build arguments for secrets. Render makes environment values available at runtime and can expose them as build arguments, so the Dockerfile must not reference secret build arguments.

| Variable | Public release value | Notes |
| --- | --- | --- |
| `SCENARIOLAB_ENVIRONMENT` | `production` | Required |
| `SCENARIOLAB_FRONTEND_ORIGIN` | Exact chosen HTTPS production frontend origin, e.g. `https://<project>.pages.dev` | Required; scheme and hostname only, no trailing path, credentials, query, or fragment |
| `SCENARIOLAB_AI_ENABLED` | `false` | Required; do not configure `SCENARIOLAB_AI_API_KEY` |
| `SCENARIOLAB_DIRECTOR_ENABLED` | `true` | Enables signed Director fallback gameplay |
| `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED` | `false` | Must remain false for this release |
| `SCENARIOLAB_DIRECTOR_ACTIVE_SIGNING_KEY_ID` | Stable ID such as `director-prod-2026-01` | Required; must match a key in the key ring |
| `SCENARIOLAB_DIRECTOR_SIGNING_KEYS` | JSON object mapping key IDs to random key material | Required secret; see signing section below |
| `SCENARIOLAB_MAX_REQUEST_BODY_BYTES` | `65536` | Optional; this is also the application default |

`SCENARIOLAB_AI_API_KEY` should be absent. With `SCENARIOLAB_AI_ENABLED=false`, Classic briefings use deterministic fallback; with Director live generation also false, Director proposals use authored fallback. The Director service does not construct a provider in this configuration. The unrelated `SCENARIOLAB_AI_BASE_URL` setting defaults to the HTTPS OpenAI-compatible endpoint and is not used to make a request while AI is disabled. The production validator requires the frontend origin and provider URL to use HTTPS even when AI is off.

Do not manually set Render's `PORT` unless you deliberately change the service's port. The Dockerfile has a local default of 8000, while Render supplies its runtime port to the same `PORT` variable. The API binds to `0.0.0.0` and the health endpoint is `GET /api/health`. Its response is process/API liveness only; catalog and gameplay health do not depend on provider availability.

Render stores environment settings and secrets through the service dashboard. See [Render environment variables and secrets](https://render.com/docs/configure-environment-variables).

## Stable Director signing keys

Generate a cryptographically random value of at least 32 UTF-8 bytes once for this production environment. For example, generate it locally with Python's standard library:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copy the output directly into a password manager or the Render runtime secret field. Do not paste it into this repository, a browser variable, a Docker build argument, a log, or a saved game. Configure both settings in Render:

```text
SCENARIOLAB_DIRECTOR_ACTIVE_SIGNING_KEY_ID=director-prod-2026-01
SCENARIOLAB_DIRECTOR_SIGNING_KEYS={"director-prod-2026-01":"<generated-secret-value>"}
```

The angle-bracket text is explanatory only; replace it with the generated value. The JSON key ID must exactly match the active key ID. The application validates key IDs and requires each key value to contain at least 32 UTF-8 bytes. Keep the same key ring and active key ID through restarts, image rebuilds, and ordinary deployments. Do not generate a key at container startup: doing so would make saved signed histories fail verification after every restart.

For rotation, add a new key ID and value to the existing JSON key ring, then set the new ID as active in the same Render environment update. Keep all old keys in the ring so existing saves remain verifiable; new proposals use the new active ID, and receipts continue to use the proposal's ID. Retain an old key as long as saves signed with it are supported. Removing a key invalidates saves that rely on it. The key ring must be identical across all replicas. See the Director [key management and replay notes](ai-scenario-director.md#signature-verification-and-key-management).

## CORS and frontend/backend connectivity

The backend reads the exact frontend allowlist from `SCENARIOLAB_FRONTEND_ORIGIN`. `backend/src/scenariolab_api/main.py` removes a trailing slash, allows only that one origin, allows `GET` and `POST` with `Accept` and `Content-Type` headers, and keeps `allow_credentials=False`. Use the canonical production origin that a player will open, such as `https://<project>.pages.dev`; do not add a path or trailing route. Pages preview URLs and alternate custom-domain origins are not allowed by this single-origin setting. If multiple frontend origins must work, extend and test the backend allowlist before deployment.

`VITE_API_BASE_URL` must be the public Render HTTPS origin, such as `https://<service>.onrender.com`, with no secret. The browser uses that base for `/api/health`, `/api/scenarios`, classic game routes, AI fallback routes, and signed Director routes. Set it in Cloudflare's **Production** build environment. Do not rely on the development fallback (`http://localhost:8000`). Health and catalog calls must continue to work when AI is disabled.

After both origins are known, compare them exactly and update Render's `SCENARIOLAB_FRONTEND_ORIGIN` if the Pages production hostname differs from the planned value. Changing the frontend API origin requires a Pages rebuild; changing the CORS origin requires a Render environment deploy/restart. Verify the production health endpoint and a real browser catalog request before opening the public link.

## Release commit and deployment sequence

1. Review `git status`, `git diff --check`, and the exact release diff. Run the backend, frontend, build, and Playwright commands in the verification section. Confirm the release commit includes the Director source modules and has no generated files or local secrets.
2. Create the reviewed release commit locally, then push it to `main`. Do not push untested follow-up changes during deployment. The recommended checkpoint for this preparation is a separate documentation/configuration commit after all checks pass.
3. Choose the Cloudflare Pages project slug and one canonical production origin. Keep the origin stable. If using a custom domain as canonical, enter that exact origin in Render; the current backend permits one origin.
4. In Render, connect the pushed repository and create a Docker Web Service with the settings above. Enter all runtime variables, including the persistent signing key ring, before deploying. Review the selected plan and any cost or cold-start limits first.
5. Watch Render's remote Docker build and deploy logs. Confirm the image build succeeds, the service starts on Render's `PORT`, and `/api/health` becomes healthy. If the build or health check fails, keep Pages pointed away from the service and fix or roll back before continuing.
6. In Cloudflare Pages, connect the same repository and production branch, set `frontend` as root, configure the build command/output directory, and set `VITE_API_BASE_URL` to the actual Render service origin. Trigger/allow the production build.
7. Confirm the deployed Pages URL matches the exact `SCENARIOLAB_FRONTEND_ORIGIN`. If not, update Render's CORS setting and redeploy. If the public API URL changes, update `VITE_API_BASE_URL` and rebuild Pages.
8. Run the browser smoke plan against the real site only after the release has been explicitly approved and deployed. Inspect API health, browser console/network, sanitized service logs, and provider usage. Do not enable live AI as part of this release.

No deployment has been performed as part of this preparation. The first remote Docker build and the deployed browser journeys remain pending.

## Release smoke-test plan

Run this against the deployed production URLs during a controlled validation window. Use a non-sensitive browser profile and retain no real secrets in DevTools exports or screenshots.

1. **Public scenario catalog:** load the public site; confirm Startup Survival is playable, planned entries are labeled Coming Soon, and the catalog request returns successfully from the Render API.
2. **Classic Simulation:** start a run and complete all 12 turns; confirm each metric and event result is server-returned and the game reaches its terminal report.
3. **Fallback Director:** start AI Scenario Director and complete multiple turns; confirm each situation is labeled Authored fallback and the choices, previews, outcomes, and signed history advance.
4. **Director v2 save/resume:** save a Director run with completed turns and a pending proposal, reload, continue it, and confirm replay restores the pending proposal without replacing completed records.
5. **Classic v1 compatibility:** resume a known format-1 Classic save created by the prior release and continue it. Keep a copy of a non-sensitive fixture before changing browser storage.
6. **Tamper rejection:** in a disposable browser profile, alter one character in a saved Director proposal/receipt signature and reload. Confirm replay rejects the record, does not advance the run, and reports the restore error; restore or clear only the disposable test save afterward.
7. **AI-off fallback:** confirm Classic briefing responses and Director proposals use fallback while both AI flags remain false. Confirm no provider credential exists in Render and provider usage has no new requests during the run.
8. **Themes:** switch between Classic and Dark themes, reload, and confirm the selection persists with readable controls, charts, history, and report colors.
9. **Mobile layout:** repeat start, gameplay, theme switch, and terminal report at a narrow mobile viewport; check controls remain usable and no horizontal overflow hides content.
10. **Errors and restart:** confirm the UI shows a recoverable unavailable state if the API cannot be reached, then verify `/api/health` and the app recover after a controlled Render restart. Do not intentionally take down a service while public users are active.
11. **Terminal reports and restart:** verify the report uses authoritative final metrics and history for both modes; restart each terminal run and confirm a new run can begin.
12. **No billable provider requests:** check the backend configuration and provider usage before and after testing. `SCENARIOLAB_AI_ENABLED=false`, `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED=false`, and no `SCENARIOLAB_AI_API_KEY` are the release controls. Automated tests use mocks; do not make a real provider request.

## Automated verification

Run from the repository root, with dependencies already installed. Do not enable AI environment flags or provide a real provider key:

```powershell
uv run --project backend --no-sync pytest backend/tests
cd frontend
npm test
npm run build
npm run test:e2e
cd ..
git diff --check
git status --short --untracked-files=all
```

The Playwright configuration starts isolated local API and Vite servers; AI is disabled and provider behavior is mocked. `npm run build` validates the Vite production bundle. A local Docker build was attempted during this preparation but could not reach the Docker Desktop Linux engine; record the Docker image check as pending until Render's remote build succeeds. Do not claim a local image build passed.

## Rollback

If the release fails:

1. Stop promoting the new Pages URL and keep the last known-good public URL available if one exists.
2. In Cloudflare Pages **Deployments**, select the previous successful production deployment and roll back to it. Cloudflare documents that successful production deployments are rollback targets; preview deployments are not.
3. In Render **Deploys**, roll back to the last successful, Director-compatible deployment. Render dashboard rollbacks disable automatic deploys; keep them disabled until the issue is fixed and the intended commit is ready.
4. Preserve the current signing key ring. Before/after a Render rollback, confirm it still includes every key ID used by saved Director records, especially if a rotation occurred. Verify a retained v2 save with replay before reopening Director gameplay. Do not replace keys with newly generated values during rollback.
5. Confirm `/api/health`, the public catalog, CORS, and one fallback-only run. Rebuild the frontend if its compiled Render API origin changed. Re-enable automatic deploys only after a clean release commit is ready.
6. If a source correction is required, make a small reviewed fix or a `git revert` commit, rerun all requested tests, and deploy that commit. Do not use `git reset` or force-push as a rollback procedure.

Provider references: [Cloudflare Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/), [Render rollbacks](https://render.com/docs/rollbacks).
