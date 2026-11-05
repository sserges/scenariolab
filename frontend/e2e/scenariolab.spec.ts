import {
  expect,
  mockedBriefing,
  openStartupSimulation,
  playDecision,
  startStartupSimulation,
  test,
} from "./fixtures";

const backendUrl = "http://127.0.0.1:8010";

test("homepage lists all predefined scenarios and only Startup Survival is available", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "ScenarioLab" })).toBeVisible();
  await expect(page.getByText("Make decisions. Explore consequences.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Startup Survival" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cybersecurity Crisis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Space Colony" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View Details" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Coming Soon" })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Coming Soon" }).first()).toBeDisabled();
});

test("Startup Survival starts through the real API and shows initial financial metrics", async ({
  page,
}) => {
  await startStartupSimulation(page);

  await expect(page.getByText("Month 1 of 12")).toBeVisible();
  await expect(page.getByText("$150,000", { exact: true })).toBeVisible();
  await expect(page.getByText("$15,000", { exact: true })).toBeVisible();
  await expect(page.getByText("$45,000", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Decision" })).toBeDisabled();
});

test("a decision updates metrics and renders only the intercepted AI briefing", async ({
  page,
  aiBriefingMock,
}) => {
  await startStartupSimulation(page);
  await playDecision(page, /Reduce Operating Expenses/);

  await expect(page.getByText("Month 1 resolved")).toBeVisible();
  await expect(page.getByText("$127,500", { exact: true })).toBeVisible();
  const latestTurn = page.getByRole("region", { name: "Latest turn explanation" });
  await expect(latestTurn.getByRole("heading", { name: mockedBriefing.headline })).toBeVisible();
  await expect(latestTurn.getByText("Live AI", { exact: true })).toBeVisible();
  await expect.poll(() => aiBriefingMock.calls).toBe(1);
  expect(aiBriefingMock.histories).toEqual([["reduce-operating-expenses"]]);
});

test("three consecutive real turns display a deterministic triggered event", async ({
  page,
  aiBriefingMock,
}) => {
  await startStartupSimulation(page);

  for (let turn = 1; turn <= 3; turn += 1) {
    await playDecision(page, /Reduce Operating Expenses/);
    await expect(page.getByText(`Month ${turn} resolved`)).toBeVisible();
  }

  const latestTurn = page.getByRole("region", { name: "Latest turn explanation" });
  await expect(latestTurn.getByText("Simulation event")).toBeVisible();
  await expect(latestTurn.getByRole("heading", { name: "Competitor Price Cut" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Financial and resource visualizations" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Financial trends" })).toBeVisible();
  await expect(page.locator("[data-history-turn]")).toHaveCount(3);
  await page.screenshot({ path: "test-results/brick7-desktop.png", fullPage: true });
  await expect.poll(() => aiBriefingMock.calls).toBe(3);
});

test("saved progress resumes after reload using replay without historical AI calls", async ({
  page,
  aiBriefingMock,
}) => {
  await startStartupSimulation(page);
  for (let turn = 0; turn < 3; turn += 1) {
    await playDecision(page, /Reduce Operating Expenses/);
  }
  await expect(page.locator("[data-history-turn]")).toHaveCount(3);
  await expect.poll(() => aiBriefingMock.calls).toBe(3);

  const savedBeforeReload = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("scenariolab.saved-run") ?? "null"),
  ) as Record<string, unknown>;
  expect(Object.keys(savedBeforeReload).sort()).toEqual([
    "action_history",
    "format_version",
    "scenario_id",
    "scenario_version",
    "seed",
  ]);
  expect(savedBeforeReload.action_history).toHaveLength(3);

  await page.reload();
  await expect(page.getByRole("button", { name: "Continue Saved Game" })).toBeVisible();
  await page.getByRole("button", { name: "Continue Saved Game" }).click();
  await expect(page.getByText("Month 4 of 12")).toBeVisible();
  await expect(page.locator("[data-history-turn]")).toHaveCount(3);
  await expect.poll(() => aiBriefingMock.calls).toBe(3);
  await expect(page.getByText(/No AI requests were made during resume/)).toBeVisible();
});

test("the twelve-turn path reaches victory and restart restores a fresh state", async ({
  page,
  aiBriefingMock,
}) => {
  await startStartupSimulation(page);

  for (let turn = 0; turn < 4; turn += 1) {
    await playDecision(page, /Reduce Operating Expenses/);
  }
  for (let turn = 0; turn < 8; turn += 1) {
    await playDecision(page, /Invest in Marketing/);
  }

  await expect(page.getByRole("heading", { name: "Victory" })).toBeVisible();
  await expect(page.getByText("Outcome: The Startup Survived")).toBeVisible();
  await expect(page.getByText("Final report", { exact: true })).toBeVisible();
  await expect(page.getByText("12 of 12 turns completed · Final status: Won")).toBeVisible();
  await expect(page.locator("[data-history-turn]")).toHaveCount(12);
  await expect.poll(() => aiBriefingMock.calls).toBe(12);
  const completedSave = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("scenariolab.saved-run") ?? "null"),
  ) as Record<string, unknown>;
  expect(completedSave.action_history).toHaveLength(12);

  await page.reload();
  await expect(page.getByRole("button", { name: "Continue Saved Game" })).toBeVisible();
  await page.getByRole("button", { name: "Continue Saved Game" }).click();
  await expect(page.getByRole("heading", { name: "Victory" })).toBeVisible();
  await expect(page.getByText("Final report", { exact: true })).toBeVisible();
  await expect(page.getByText("12 of 12 turns completed · Final status: Won")).toBeVisible();
  await expect(page.locator("[data-history-turn]")).toHaveCount(12);
  await expect(page.getByRole("button", { name: "Confirm Decision" })).toHaveCount(0);
  await expect.poll(() => aiBriefingMock.calls).toBe(12);

  const restartResponse = page.waitForResponse(
    (response) =>
      response.url() === `${backendUrl}/api/games/start` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Restart Simulation" }).click();
  await expect((await restartResponse).ok()).toBeTruthy();
  await expect(page.getByText("Month 1 of 12")).toBeVisible();
  await expect(page.getByText("$150,000", { exact: true })).toBeVisible();
  await expect(page.getByText("Initial value").first()).toBeVisible();
  const restartedSave = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("scenariolab.saved-run") ?? "null"),
  ) as Record<string, unknown>;
  expect(restartedSave.action_history).toEqual([]);
});

test("API failure feedback preserves state and duplicate submissions are blocked", async ({
  page,
}) => {
  await startStartupSimulation(page);
  await page.route(`${backendUrl}/api/games/turn`, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        detail: {
          code: "e2e_forced_failure",
          message: "E2E forced game API failure.",
        },
      }),
    });
  });
  await page
    .getByRole("radio", { name: /Reduce Operating Expenses/ })
    .check({ force: true });
  await page.getByRole("button", { name: "Confirm Decision" }).click();
  await expect(page.getByText("Simulation request failed")).toBeVisible();
  await expect(page.getByText("E2E forced game API failure.")).toBeVisible();
  await expect(page.getByText("$150,000", { exact: true })).toBeVisible();

  await page.unroute(`${backendUrl}/api/games/turn`);
  let releaseTurn: (() => void) | undefined;
  const turnGate = new Promise<void>((resolve) => {
    releaseTurn = resolve;
  });
  let turnRequests = 0;
  await page.route(`${backendUrl}/api/games/turn`, async (route) => {
    turnRequests += 1;
    await turnGate;
    await route.continue();
  });
  const confirm = page.getByRole("button", { name: "Confirm Decision" });
  await confirm.click();
  await expect.poll(() => turnRequests).toBe(1);
  const pendingConfirm = page.getByRole("button", { name: /Resolving Decision/ });
  await expect(pendingConfirm).toBeDisabled();
  await pendingConfirm.click({ force: true });
  expect(turnRequests).toBe(1);
  releaseTurn?.();
  await expect(page.getByText("Month 1 resolved")).toBeVisible();
});

test("mobile viewport keeps essential gameplay controls visible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startStartupSimulation(page);

  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible();
  const decision = page.getByRole("radio", { name: /Improve the Product/ });
  await decision.scrollIntoViewIfNeeded();
  await expect(decision).toBeEnabled();
  await decision.check({ force: true });
  await expect(page.getByRole("button", { name: "Confirm Decision" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Decision" })).toBeEnabled();
  await expect(page.getByRole("img", { name: "Financial trends" })).toBeVisible();
  const noHorizontalOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(noHorizontalOverflow).toBe(true);
  await page.screenshot({ path: "test-results/brick7-mobile.png", fullPage: true });
});
