# Public Release Candidate Deployment Guide (Brick 8B)

This guide tracks the fallback-only public release. The release checkpoint d47c68c is deployed to Cloudflare Pages and a Render Free service. After the reported Director signing-key configuration correction, Render health returned HTTP 200. The first Pages bundle used the localhost API default; a later Pages rebuild corrected the API origin, and the production smoke on November 14, 2026 verified the integrated fallback-only app. See the dated results below. No production infrastructure or signing keys were changed during that smoke.

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
| Instance plan | Render Free only (`$0` compute), as approved; do not select a paid plan |

Free compute alone does not guarantee a `$0` total bill. Render says Free web services count against included bandwidth and build-pipeline usage, and excess usage may be billed depending on workspace payment and spend-limit settings. Before creating the service, verify that workspace protections prevent any overage charge. If that cannot be confirmed, stop. See Render's [Free instance limits](https://render.com/docs/free) and [pricing](https://render.com/pricing).

The paths are deliberate: the Dockerfile copies `backend/pyproject.toml`, `backend/uv.lock`, `backend/README.md`, and `backend/src`. It installs production dependencies with `uv sync --locked --no-dev`, runs `scenariolab_api.main:app` with Uvicorn, and runs as an unprivileged user. It does not copy tests, local environments, or generated build output. The repository-root `.dockerignore` excludes `.env` files, virtual environments, caches, frontend dependencies/build output, and test reports. The Dockerfile's own health check calls `/api/health` on the runtime port; the endpoint does not check or call an AI provider.

Local image verification is **pending**. The Docker CLI is installed, but this machine cannot connect to the Docker Desktop engine. Do not treat the image as locally validated. Render's first remote Docker build from the repository-root context succeeded for `d47c68c`; its initial container exited during runtime settings loading. The public health check now passes after the reported signing-key correction, but CORS/catalog and browser smoke checks remain pending. Render's current setup is described in [Docker on Render](https://render.com/docs/docker), [web services and port binding](https://render.com/docs/web-services), and [health checks](https://render.com/docs/health-checks).

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

### Deployment checkpoint (November 10, 2026)

| Item | Observed result |
| --- | --- |
| Pages project | Created from `sserges/scenariolab`; project name `scenariolab` |
| Production branch | `main` |
| Root directory / build / output | `frontend` / `npm ci && npm run build` / `dist` |
| Initial Pages deployment | Cloudflare dashboard reported **Success** |
| Canonical HTTPS Pages origin | [`https://scenariolab-38a.pages.dev`](https://scenariolab-38a.pages.dev) |
| Pages browser/API smoke | Not run; the origin is recorded from the Cloudflare deployment result, and no public backend is connected |
| Render backend | Service `scenariolab` created from `sserges/scenariolab`, branch `main`, release `d47c68c`, Render Free (`$0` compute); the existing `codex` service was left untouched |
| Render HTTPS origin | Dashboard health-check notice showed `scenariolab.onrender.com:10000/api/health`; the assigned service origin is [`https://scenariolab.onrender.com`](https://scenariolab.onrender.com), but it is not healthy yet |
| Render cost protection | User confirmed workspace protections block charges beyond Free included usage. Service plan and dashboard footer showed `$0/month` |
| Remote Docker build / runtime | Remote image build succeeded. First container startup exited with status 1 while loading runtime settings; `/api/health` did not pass. The raw exception was not inspected because it may include environment input |
| Runtime settings and signing keys | Production, exact Pages origin, AI disabled, Director fallback enabled, and active key ID `director-prod-2026-11` were configured. A signing-key value is present and masked, but its validity is unverified because startup failed; do not overwrite or rotate it while diagnosing |
| Pages browser/API smoke | Initial page load showed the shell and “Scenario catalog unavailable.” No integrated API or gameplay checks have run |
| Integrated public release | Not verified; no healthy public API, successful CORS/browser, gameplay, restart, or provider-usage checks have run |

The November 10 checkpoint above records the initial deployment state. The November 14 health check confirms the backend now starts and responds. Do not describe the full application as publicly verified until Pages is confirmed to use the actual API origin and the integrated public smoke plan passes. No provider requests were made during the November 10 checkpoint. The initial Render startup exception was not opened or copied; no signing-key value is recorded here.

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

Before changing signing settings, inspect the existing production key ring in Render without revealing or copying any secret into logs. Preserve every existing key and its active ID; do not overwrite or rotate an existing ring. If the new service has no signing ring and no saved Director records depend on another key, generate one cryptographically random value of at least 32 UTF-8 bytes with a password manager's secure generator. Enter it directly into Render's runtime secret setting without displaying it, logging it, or sharing it in chat. Do not put it in this repository, a Vite variable, a Docker build argument, or a saved game. Configure both settings in Render only after confirming no existing ring must be preserved:

```text
SCENARIOLAB_DIRECTOR_ACTIVE_SIGNING_KEY_ID=director-prod-2026-11
SCENARIOLAB_DIRECTOR_SIGNING_KEYS={"director-prod-2026-11":"<generated-secret-value>"}
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

The initial Pages deployment and Render remote image build completed. The earlier frontend check below captured a pre-rebuild bundle; the later Pages build and integrated production smoke are verified in the section below.

### Backend health verification (November 14, 2026)

| Check | Observed result |
| --- | --- |
| HTTPS availability | `https://scenariolab.onrender.com/api/health` connected successfully over HTTPS |
| Health response | HTTP 200; JSON body `{"status":"ok","service":"scenariolab-api"}` |
| Response time | 0.34 seconds; no cold-start delay observed during this request |
| FastAPI startup/runtime configuration | The live health route responded, confirming the API process started and loaded runtime configuration. No startup/configuration failure surfaced in this check. Render's private service logs were not inspected. |

The health check above verifies backend health only. The separate frontend connection check below covers catalog and CORS responses; neither check substitutes for public browser gameplay.

### Initial frontend connection verification (before Pages API-origin rebuild, November 14, 2026)

| Check | Observed result |
| --- | --- |
| Pages origin | `https://scenariolab-38a.pages.dev` returned HTTP 200 (`text/html; charset=utf-8`) |
| Catalog request | `GET https://scenariolab.onrender.com/api/scenarios` with `Origin: https://scenariolab-38a.pages.dev` returned HTTP 200 JSON with three scenarios |
| CORS preflight | `OPTIONS /api/scenarios` returned HTTP 200; `Access-Control-Allow-Origin` exactly matched the Pages origin; allowed methods included `GET, POST` |
| Deployed frontend bundle | The referenced JavaScript asset returned HTTP 200, contained no `scenariolab.onrender.com` hostname, and contained the `http://localhost:8000` default |
| Chromium UI check | Chromium 156.0.8078.4 loaded the Pages app (title `ScenarioLab`); no uncaught page JavaScript errors occurred. It attempted `http://localhost:8000/api/health` and `/api/scenarios`, both failed with `ERR_CONNECTION_REFUSED`, and the catalog showed “Scenario catalog unavailable” |

This was the initial pre-rebuild observation: the deployed bundle used the local fallback, so the Pages Production build needed VITE_API_BASE_URL=https://scenariolab.onrender.com. The browser smoke below was run after the subsequent Pages rebuild and confirms the current frontend calls Render. No production configuration was changed during the smoke.

## Production smoke verification (November 14, 2026)

The production browser checks below used isolated Chromium 156 sessions against the real Pages and Render services. The test forced seed 42 through the isolated browser request so the Classic win path was deterministic; the backend still resolved all starts and turns.

| Check | Observed result |
| --- | --- |
| Frontend/API connection | Pages returned HTTP 200; Chromium called https://scenariolab.onrender.com for health, catalog, scenario definition, Classic, briefing, and Director routes. Normal requests returned HTTP 200. |
| Health and startup | HTTPS /api/health returned HTTP 200 with {"status":"ok","service":"scenariolab-api"}. FastAPI was serving requests; no runtime configuration error surfaced. Private Render logs were not inspected. |
| Classic 12-turn completion | The authoritative game completed turns 1–12 and returned Victory. The ending report showed server-returned metrics, decision history, and trend charts. |
| Classic persistence | The local v1 save resumed after reload at turn 4 by replaying the saved start and three turns. A terminal save restored the Victory report. Restart returned HTTP 200 and reset the local action history. |
| Director fallback and signatures | Director proposals used authored fallback content and provided previews. Six decisions returned signed HMAC-SHA256 receipts; valid replay resumed the saved turn 4 proposal. The seeded choices reached Bankruptcy on turn 6 and the terminal report displayed that server outcome. |
| Signature validation | A test-only modified receipt signature was rejected by the real replay endpoint with HTTP 422 invalid_director_signature. The valid saved data remained unchanged and resumed successfully once the request mutation was removed. |
| Themes and responsive layout | Classic and Dark themes rendered on desktop. Classic gameplay worked at a 390×844 mobile viewport in both themes with no horizontal overflow. |
| Browser/network errors | No uncaught JavaScript errors or unexpected network hosts/statuses. One expected console resource error corresponded to the deliberately tampered replay's HTTP 422. Separate simulated 503 checks also produced expected resource errors and recoverable UI states. |
| Free-instance cold start and temporary outages | No real cold start was observed; repeated warm health calls were 99–292 ms. An 8-second delayed catalog response remained in a loading state and then recovered. A simulated catalog 503 displayed its retry state and recovered on retry. A simulated turn 503 preserved state and allowed a successful retry. |
| Paid AI generation | All observed briefing and Director proposal responses were fallback content. Chromium contacted only Pages and Render hosts. No flags or keys were changed; provider dashboards and private Render logs were not inspected. |

Devpost-ready Chromium screenshots are stored in artifacts/production-smoke-2026-11-14T19-34-37-473Z/. The fallback-only deployment is ready for a public demonstration. The smoke did not inspect private Render logs or provider usage, and it did not observe an actual Render Free cold start.

## Brick 9C production release (November 14, 2026)

Release commit `170958b` on `main` contains Brick 9C (`f7dfd85`), the Classic console redesign (`799bf08`, merged as PR #1), and release documentation. Render runs `170958b`, deployed manually and built in 32 s. Cloudflare Pages runs the same commit, built automatically from `main`.

### Deployment triggers and ordering

| Platform | Observed trigger behavior |
| --- | --- |
| Cloudflare Pages | Automatic production deployments from `main` are enabled (build watch path `*`). Every push to `main` deploys the frontend. |
| Render | The service setting reads **Auto-Deploy: On Commit**, but no push since `d47c68c` produced a deploy event. Every Render deploy so far was manual or environment-triggered. Treat Render as manual-deploy until the GitHub connection is repaired. |

Because Pages deploys on push and Render does not, a push that changes the frontend contract goes live before the backend. This happened for Brick 9C. Pages deployed `f7dfd85` and then `88ddde4` while Render still ran `d47c68c`. For about 45 minutes the new frontend was paired with the old catalog, which had no `ai_features`. Startup Survival's Director option was hidden and the two new scenarios showed Coming Soon. Classic gameplay remained available. Deploying `170958b` to Render closed the window. **For future releases that change the API contract, deploy Render first with a manual deploy of the release commit, then let Pages build.** Repairing Render's GitHub auto-deploy, or adding a Pages build gate, is a follow-up decision. No build settings were changed during this release.

### Configuration preserved

Render keeps the Free plan, Dockerfile `backend/Dockerfile`, context `.`, and no build filters. Its runtime variables are `SCENARIOLAB_ENVIRONMENT`, `SCENARIOLAB_FRONTEND_ORIGIN`, `SCENARIOLAB_AI_ENABLED=false`, `SCENARIOLAB_DIRECTOR_ENABLED`, `SCENARIOLAB_DIRECTOR_LIVE_GENERATION_ENABLED=false`, `SCENARIOLAB_DIRECTOR_ACTIVE_SIGNING_KEY_ID`, and `SCENARIOLAB_DIRECTOR_SIGNING_KEYS`. No AI API key is configured. Only the two AI flags were revealed and then hidden again; signing-key values were not viewed or changed. Pages keeps root `frontend`, build `npm ci && npm run build`, output `dist`, and `VITE_API_BASE_URL=https://scenariolab.onrender.com`. Production Director signatures use key ID `director-prod-v1`. A private check found that none of the seven key values available in the repository history, the local environment file, or the test configuration verifies production signatures.

### Backend verification

| Check | Result |
| --- | --- |
| Health | `GET /api/health` returned HTTP 200 (warm, about 0.3 s). |
| Catalog | All three scenarios are `available`. `ai_features` is `["scenario-director","live-briefings"]` for Startup Survival and `[]` for Cybersecurity Crisis and Space Colony. |
| Definitions | `startup-survival` 1.0.0 (month, 7 metrics, 3 actions), `cybersecurity-crisis` 1.0.0 (round, 6, 7), and `space-colony` 1.0.0 (cycle, 8, 7). |
| CORS | `Access-Control-Allow-Origin: https://scenariolab-38a.pages.dev`; a foreign origin receives no CORS header. |
| Startup Survival regression | Seed 42 with three cost-cutting turns reproduced the local engine exactly: cash 10,500,000 cents and the Competitor Price Cut event. |
| AI | Briefings for all three scenarios returned `fallback`; Director proposals returned `fallback`. |

### Hosted browser smoke (22 of 22 checks passed)

The checks used headless Chromium against `https://scenariolab-38a.pages.dev` and the real Render API, with no mocked responses. Classic runs rewrote only the start request's seed to 42, so the reference paths were reproducible; the production API resolved every start and turn. Screenshots and the JSON result log are committed in `artifacts/production-smoke-brick9c-2026-11-14/`, following the Brick 8B smoke-evidence precedent.

| Area | Result |
| --- | --- |
| Catalog | Three scenarios showed Available and none showed Coming Soon. The browser called only `https://scenariolab.onrender.com` and never localhost. |
| Cybersecurity Crisis | Start showed "Round 1 of 12", Threat Level 30/100, and 140 response hours. Twelve rounds reached **Crisis Contained**; the final metrics matched the local seed-42 engine run exactly. Briefings were labeled "Authored briefing". A terminal save resumed after reload with 12 history entries, and restart reset to Round 1 with an empty save. |
| Space Colony | Start showed "Cycle 1 of 12", a 30-day oxygen reserve, and −2 days/cycle. A mid-game save resumed after reload at cycle 4. Twelve cycles reached **Colony Sustained** with metrics identical to the local run. After a restart, six rationing cycles produced the **Crew Breakdown** failure report (6 of 12 turns, Lost). |
| Startup Survival Classic | Twelve months reached **The Startup Survived**. |
| Startup Survival Director | Three signed fallback turns used key `director-prod-v1`, and the save resumed after reload through signed replay. A tampered receipt was rejected with HTTP 422, and the local save was unchanged. |
| Director scoping | Cybersecurity Crisis and Space Colony showed "Not available for this scenario". No Director requests came from either scenario. |
| Layouts and themes | All three scenarios rendered at 390×844 in Classic and Dark themes with no horizontal overflow. Desktop screenshots were captured for the home page and both new-scenario victories. |
| Errors and network | There were no unexpected console errors; the only error was the deliberate tamper test's 422. No hosts other than Pages and Render were contacted. All 41 briefing responses were `fallback`. |
| Cold start | The service was warm during the smoke, with health responses in about 0.2 s. No Free-instance cold start was observed; Render warns that one can delay a request by 50 s or more. |

Private Render logs and provider usage dashboards were not inspected. No paid provider requests were made.
## Release smoke-test plan

Run this against the deployed production URLs during a controlled validation window. Use a non-sensitive browser profile and retain no real secrets in DevTools exports or screenshots.

1. **Public scenario catalog:** load the public site; confirm Startup Survival, Cybersecurity Crisis, and Space Colony are all listed as Available (none Coming Soon) and the catalog request returns successfully from the Render API. Because the frontend reads the new catalog `ai_features` field, deploy the Render backend before the Pages frontend; an older backend would hide Startup Survival's Director mode.
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
