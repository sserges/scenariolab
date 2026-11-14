import type { Page } from "@playwright/test";

import { expect, openScenario, playDecision, startClassicScenario, test } from "./fixtures";

// Authoritative seed-42 paths, mirrored by backend/tests/test_multi_scenario.py.
const CYBER_WIN_PATH = [
  "Isolate Affected Systems",
  "Isolate Affected Systems",
  "Launch Threat Hunt",
  "Engage External Responders",
  "Brief Stakeholders Transparently",
  "Fail Over to Backup Site",
  "Engage External Responders",
  "Brief Stakeholders Transparently",
  "Restore Services and Rotate Staff",
  "Patch and Harden Systems",
  "Brief Stakeholders Transparently",
  "Restore Services and Rotate Staff",
];
const SPACE_WIN_PATH = [
  "Expand Hydroponics Bay",
  "Deploy Additional Solar Arrays",
  "Launch Survey Expedition",
  "Emergency Rationing Protocol",
  "Crew Rest and Recreation",
  "Deploy Additional Solar Arrays",
  "Deploy Additional Solar Arrays",
  "Expand Hydroponics Bay",
  "Overhaul Oxygen Generators",
  "Expand Hydroponics Bay",
  "Expand Hydroponics Bay",
  "Expand Hydroponics Bay",
];
const STARTUP_TERMS = /Startup Survival|Monthly Revenue|Cash|Customer Satisfaction|Financial/;

function exact(title: string): RegExp {
  return new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}

async function savedRun(page: Page): Promise<Record<string, unknown>> {
  return await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("scenariolab.saved-run") ?? "null"),
  ) as Record<string, unknown>;
}

function trackForbiddenTraffic(page: Page): { external: string[]; director: string[] } {
  const seen = { external: [] as string[], director: [] as string[] };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1" && url.protocol !== "data:") seen.external.push(request.url());
    if (url.pathname.startsWith("/api/ai/director")) seen.director.push(request.url());
  });
  return seen;
}

test.describe("Cybersecurity Crisis", () => {
  test("communicates Classic-only play and Director unavailability", async ({ page }) => {
    await openScenario(page, "cybersecurity-crisis", "Cybersecurity Crisis");

    await expect(page.getByText("Cybersecurity scenario")).toBeVisible();
    await expect(page.getByRole("button", { name: /Choose Classic Simulation/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Choose AI Scenario Director/ })).toHaveCount(0);
    await expect(page.getByTestId("director-unavailable")).toContainText("Not available for this scenario");
    await expect(page.getByTestId("director-unavailable")).toContainText(
      "AI Scenario Director is not available for Cybersecurity Crisis",
    );
  });

  test("twelve-round happy path reaches the containment victory, resumes when terminal, and restarts", async ({
    page,
    aiBriefingMock,
  }) => {
    const traffic = trackForbiddenTraffic(page);
    await startClassicScenario(page, "cybersecurity-crisis", "Cybersecurity Crisis");

    await expect(page.getByText("Round 1 of 12")).toBeVisible();
    await expect(page.getByLabel("Threat Level: 30/100")).toBeVisible();
    await expect(page.getByLabel("Response Resources: 140 hrs")).toBeVisible();
    await page.getByRole("tab", { name: "Trends" }).click();
    await expect(page.getByRole("heading", { name: "Resource and status visualizations" })).toBeVisible();
    await page.getByRole("tab", { name: "Decide" }).click();

    for (const [index, title] of CYBER_WIN_PATH.entries()) {
      await playDecision(page, exact(title));
      await expect(page.getByText(`Round ${index + 1} resolved`)).toBeVisible();
    }

    await expect(page.getByRole("heading", { name: "Victory" })).toBeVisible();
    await expect(page.getByText("Outcome: Crisis Contained")).toBeVisible();
    await expect(page.getByText("12 of 12 turns completed · Final status: Won")).toBeVisible();
    await expect(page.locator("[data-history-turn]")).toHaveCount(12);
    const latest = page.getByRole("region", { name: "Latest turn explanation" });
    await expect(latest.getByText("Authored briefing")).toBeVisible();
    await expect(latest.getByText("Live AI")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(STARTUP_TERMS);
    expect((await savedRun(page)).action_history).toHaveLength(12);
    await expect.poll(() => aiBriefingMock.authoredPassthroughs.length).toBe(12);
    expect(aiBriefingMock.calls).toBe(0);
    await page.screenshot({ path: "test-results/brick9c-cyber-victory.png", fullPage: true });

    await page.reload();
    await page.getByRole("button", { name: "Continue Saved Game" }).click();
    await expect(page.getByRole("heading", { name: "Victory" })).toBeVisible();
    await expect(page.locator("[data-history-turn]")).toHaveCount(12);
    await expect(page.getByRole("button", { name: "Confirm Decision" })).toHaveCount(0);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Restart Simulation" }).click();
    await expect(page.getByText("Round 1 of 12")).toBeVisible();
    await expect(page.getByLabel("Threat Level: 30/100")).toBeVisible();
    expect((await savedRun(page)).action_history).toEqual([]);
    expect(traffic.external).toEqual([]);
    expect(traffic.director).toEqual([]);
  });

  test("saved progress resumes after reload and tampered history is rejected without losing the save", async ({
    page,
  }) => {
    await startClassicScenario(page, "cybersecurity-crisis", "Cybersecurity Crisis");
    for (const title of CYBER_WIN_PATH.slice(0, 3)) {
      await playDecision(page, exact(title));
    }
    const saved = await savedRun(page);
    expect(saved).toMatchObject({
      format_version: 1,
      scenario_id: "cybersecurity-crisis",
      scenario_version: "1.0.0",
      seed: 42,
    });
    expect(saved.action_history).toHaveLength(3);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Continue Cybersecurity Crisis" })).toBeVisible();
    await page.getByRole("button", { name: "Continue Saved Game" }).click();
    await expect(page.getByText("Round 4 of 12")).toBeVisible();
    await expect(page.locator("[data-history-turn]")).toHaveCount(3);

    const tampered = { ...saved, action_history: ["isolate-affected-systems", "invest-in-marketing"] };
    await page.evaluate((value) => {
      window.localStorage.setItem("scenariolab.saved-run", JSON.stringify(value));
    }, tampered);
    await page.reload();
    await page.getByRole("button", { name: "Continue Saved Game" }).click();
    await expect(page.getByText("Saved game could not resume")).toBeVisible();
    await expect(page.getByText(/rejected the saved action history \(invalid_action\)/)).toBeVisible();
    expect(await savedRun(page)).toEqual(tampered);
  });
});

test.describe("Space Colony", () => {
  test("twelve-cycle happy path sustains the colony with reserve and balance metrics", async ({
    page,
    aiBriefingMock,
  }) => {
    const traffic = trackForbiddenTraffic(page);
    await startClassicScenario(page, "space-colony", "Space Colony");

    await expect(page.getByText("Cycle 1 of 12")).toBeVisible();
    await expect(page.getByLabel("Oxygen Reserve: 30 days")).toBeVisible();
    await expect(page.getByLabel("Oxygen Balance: -2 days/cycle")).toBeVisible();
    await page.getByRole("tab", { name: "Trends" }).click();
    await expect(page.getByRole("img", { name: "Days per cycle trends" })).toBeVisible();
    await page.getByRole("tab", { name: "Decide" }).click();

    for (const [index, title] of SPACE_WIN_PATH.entries()) {
      await playDecision(page, exact(title));
      await expect(page.getByText(`Cycle ${index + 1} resolved`)).toBeVisible();
    }

    await expect(page.getByRole("heading", { name: "Victory" })).toBeVisible();
    await expect(page.getByText("Outcome: Colony Sustained")).toBeVisible();
    await expect(page.getByLabel("Oxygen Reserve: 41 days")).toBeVisible();
    await expect(page.getByLabel("Food Stores: 62 days")).toBeVisible();
    await expect(page.locator("[data-history-turn]")).toHaveCount(12);
    await expect(page.locator("main")).not.toContainText(STARTUP_TERMS);
    await expect.poll(() => aiBriefingMock.authoredPassthroughs.length).toBe(12);
    expect(aiBriefingMock.calls).toBe(0);
    expect(traffic.external).toEqual([]);
    expect(traffic.director).toEqual([]);
    await page.screenshot({ path: "test-results/brick9c-space-victory.png", fullPage: true });
  });

  test("a failure condition ends the run with the authoritative report", async ({ page }) => {
    await startClassicScenario(page, "space-colony", "Space Colony");
    for (let cycle = 1; cycle <= 6; cycle += 1) {
      await playDecision(page, /^Emergency Rationing Protocol/);
    }

    await expect(page.getByRole("heading", { name: "Failure" })).toBeVisible();
    await expect(page.getByText("Outcome: Crew Breakdown")).toBeVisible();
    await expect(page.getByText("6 of 12 turns completed · Final status: Lost")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm Decision" })).toHaveCount(0);
  });
});

for (const [scenarioId, title, firstDecision] of [
  ["cybersecurity-crisis", "Cybersecurity Crisis", /^Isolate Affected Systems/],
  ["space-colony", "Space Colony", /^Expand Hydroponics Bay/],
] as const) {
  test(`${title} mobile layout fits the viewport in Classic and Dark themes`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startClassicScenario(page, scenarioId, title);
    await playDecision(page, firstDecision);
    await expect(page.getByRole("button", { name: "Confirm Decision" })).toBeVisible();

    let fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits).toBe(true);
    await page.screenshot({ path: `test-results/brick9c-${scenarioId}-mobile-light.png`, fullPage: true });

    await page.getByRole("button", { name: "Switch to Dark Mode" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("[data-history-turn]")).toHaveCount(1);
    fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits).toBe(true);
    await page.screenshot({ path: `test-results/brick9c-${scenarioId}-mobile-dark.png`, fullPage: true });
  });
}

test("a new-scenario save does not break Startup Survival or the Director", async ({ page }) => {
  await startClassicScenario(page, "space-colony", "Space Colony");
  await playDecision(page, /^Expand Hydroponics Bay/);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Continue Space Colony" })).toBeVisible();
  await openScenario(page, "startup-survival", "Startup Survival");
  await expect(page.getByRole("button", { name: /Choose AI Scenario Director/ })).toBeEnabled();
  await page.getByRole("button", { name: /Choose Classic Simulation/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.getByText("Month 1 of 12")).toBeVisible();
  await expect(page.getByText("$150,000", { exact: true })).toBeVisible();
  const saved = await savedRun(page);
  expect(saved.scenario_id).toBe("startup-survival");
});
