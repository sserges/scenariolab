import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const frontendDirectory = fileURLToPath(new URL(".", import.meta.url));
const repositoryDirectory = fileURLToPath(new URL("../", import.meta.url));
const frontendUrl = "http://127.0.0.1:5174";
const backendUrl = "http://127.0.0.1:8010";
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  workers: isCI ? 1 : undefined,
  timeout: 45_000,
  expect: {
    timeout: 7_500,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: frontendUrl,
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "off",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: [
    {
      command: "uv run --project backend --no-sync uvicorn scenariolab_api.main:app --host 127.0.0.1 --port 8010",
      cwd: repositoryDirectory,
      env: {
        ...process.env,
        // Defense in depth: the E2E backend can never initialize a live provider.
        // Browser tests still intercept the route and assert the mocked response.
        SCENARIOLAB_AI_API_KEY: "",
        SCENARIOLAB_AI_ENABLED: "false",
        // Fixed, test-only backend key: never supplied to the browser or used outside E2E.
        SCENARIOLAB_DIRECTOR_ENABLED: "true",
        SCENARIOLAB_DIRECTOR_ACTIVE_SIGNING_KEY_ID: "director-test",
        SCENARIOLAB_DIRECTOR_SIGNING_KEYS: JSON.stringify({
          "director-test": "scenariolab-e2e-only-signing-key-2026-11-07",
        }),
        SCENARIOLAB_FRONTEND_ORIGIN: frontendUrl,
      },
      url: `${backendUrl}/api/health`,
      // Port 8010 is reserved for the fallback-only E2E backend.
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5174 --strictPort",
      cwd: frontendDirectory,
      env: {
        ...process.env,
        VITE_API_BASE_URL: backendUrl,
      },
      url: frontendUrl,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
