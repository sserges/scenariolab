import {
  expect,
  mockedBriefing,
  openStartupSimulation,
  playDecision,
  playDirectorDecision,
  startStartupSimulation,
  startDirectorSimulation,
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
  page.once("dialog", (dialog) => dialog.accept());
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

test("Director completes three signed turns, reloads, verifies replay, and continues at turn four", async ({ page, aiBriefingMock }) => {
  const proposalHistoryLengths: number[] = [];
  page.on("request", (request) => {
    if (request.url() === `${backendUrl}/api/ai/director/proposal` && request.method() === "POST") {
      const body = request.postDataJSON() as { turn_records?: unknown[] };
      proposalHistoryLengths.push(body.turn_records?.length ?? -1);
    }
  });
  await startDirectorSimulation(page);

  for (let turn = 1; turn <= 3; turn += 1) {
    await playBestCashDirectorDecision(page);
    await expect(page.getByRole("heading", { name: `Turn ${turn} resolved` })).toBeVisible();
    await expect(page.getByRole("heading", { name: `Turn ${turn + 1} of 12` })).toBeVisible();
  }
  await expect(page.locator("[data-metric-id='cash']")).toBeVisible();
  await expect(page.locator("[data-testid='director-preview']")).toHaveCount(3);
  await expect.poll(() => aiBriefingMock.calls).toBe(0);
  await page.screenshot({ path: "test-results/brick9b2a-director-desktop.png", fullPage: true });

  const savedBeforeReload = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("scenariolab.saved-run") ?? "null"),
  ) as Record<string, unknown>;
  expect(Object.keys(savedBeforeReload).sort()).toEqual([
    "format_version",
    "mode",
    "profile_id",
    "profile_version",
    "scenario_id",
    "scenario_version",
    "seed",
    "turn_records",
  ]);
  expect(savedBeforeReload).toMatchObject({ format_version: 2, mode: "director", scenario_id: "startup-survival", scenario_version: "1.0.0", seed: 42 });
  expect(savedBeforeReload.turn_records).toHaveLength(3);
  expect(savedBeforeReload).not.toHaveProperty("metric_values");

  await page.reload();
  await expect(page.getByRole("button", { name: "Continue Saved Game" })).toBeVisible();
  const replayResponse = page.waitForResponse((response) => response.url() === `${backendUrl}/api/ai/director/replay`);
  const restoredProposal = page.waitForResponse((response) => response.url() === `${backendUrl}/api/ai/director/proposal`);
  await page.getByRole("button", { name: "Continue Saved Game" }).click();
  await expect((await replayResponse).ok()).toBeTruthy();
  await expect((await restoredProposal).ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Turn 4 of 12" })).toBeVisible();
  await expect(page.locator("[data-testid='director-history']")).toHaveCount(0);
  await expect(page.locator("ol > li")).toHaveCount(3);

  await playBestCashDirectorDecision(page);
  await expect(page.getByRole("heading", { name: "Turn 4 resolved" })).toBeVisible();
  expect(proposalHistoryLengths).toEqual([0, 1, 2, 3, 3, 4]);
  await expect.poll(() => aiBriefingMock.calls).toBe(0);

  for (let turn = 5; turn <= 12; turn += 1) {
    await expect.poll(async () =>
      (await page.locator('input[name="director-choice"]').count()) >= 2 ||
      (await page.getByText("Final report", { exact: true }).count()) > 0,
    ).toBe(true);
    if (await page.locator('input[name="director-choice"]').count() === 0) break;
    await playBestCashDirectorDecision(page);
    await expect(page.getByRole("heading", { name: `Turn ${turn} resolved` })).toBeVisible();
  }
  await expect(page.getByText("Final report", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Director Choice" })).toHaveCount(0);
  await expect(page.getByRole("status", { name: /Game status: (Won|Lost)/ })).toBeVisible();
});

test("tampered signed history is rejected while the valid local save remains intact", async ({ page }) => {
  await startDirectorSimulation(page);
  await playDirectorDecision(page, 0);
  const validSerializedSave = await page.evaluate(() => window.localStorage.getItem("scenariolab.saved-run"));
  expect(validSerializedSave).not.toBeNull();

  await page.route(`${backendUrl}/api/ai/director/replay`, async (route) => {
    const tampered = route.request().postDataJSON() as { turn_records: Array<{ receipt: { signature: { value: string } } }> };
    tampered.turn_records[0]!.receipt.signature.value = "B".repeat(43);
    await route.continue({ postData: JSON.stringify(tampered) });
  });
  await page.reload();
  await page.getByRole("button", { name: "Continue Saved Game" }).click();
  await expect(page.getByText("Saved Director game could not resume")).toBeVisible();
  await expect(page.getByText(/backend rejected the saved signed history \(invalid_director_signature\)/)).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("scenariolab.saved-run"))).toBe(validSerializedSave);
});

test("disabled Director mode clearly offers Classic Simulation", async ({ page }) => {
  await page.route(`${backendUrl}/api/ai/director/proposal`, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: { code: "director_disabled", message: "Director mode is disabled by backend configuration." } }),
    });
  });
  await openStartupSimulation(page);
  await page.getByRole("button", { name: /Choose AI Scenario Director/ }).click();
  await page.getByRole("button", { name: "Start Director Simulation" }).click();
  await expect(page.getByText("Director mode unavailable")).toBeVisible();
  await page.getByRole("button", { name: "Play Classic Simulation" }).click();
  await page.getByRole("button", { name: /Choose Classic Simulation/ }).click();
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible();
});

test("mode switching confirms before replacing existing progress", async ({ page }) => {
  await startStartupSimulation(page);
  await page.getByRole("button", { name: "Scenario library" }).click();
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Choose AI Scenario Director/ }).click();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("replace the saved progress");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Start Director Simulation" }).click();
  await expect(page.getByText("Authored fallback", { exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem("scenariolab.saved-run") ?? "null")) as Record<string, unknown>;
  expect(saved).toMatchObject({ format_version: 2, mode: "director" });
});

test("Director mobile layout stays within the viewport in Classic and Dark themes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startDirectorSimulation(page);
  await expect(page.locator('input[name="director-choice"]').first()).toBeVisible();
  let noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noHorizontalOverflow).toBe(true);
  await page.screenshot({ path: "test-results/brick9b2a-director-mobile-light.png", fullPage: true });

  await page.getByRole("button", { name: "Switch to Dark Mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Confirm Director Choice" })).toBeDisabled();
  noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(noHorizontalOverflow).toBe(true);
  await page.screenshot({ path: "test-results/brick9b2a-director-mobile-dark.png", fullPage: true });
});

async function playBestCashDirectorDecision(page: import("@playwright/test").Page): Promise<void> {
  const scores = await page.getByTestId("director-preview").evaluateAll((previews) =>
    previews.map((preview) => {
      const text = preview.textContent ?? "";
      const active = text.includes("Projected status: Active");
      const cashRow = Array.from(preview.querySelectorAll("li")).find((row) => row.textContent?.trim().startsWith("Cash"));
      const amounts = cashRow?.textContent?.match(/\$([\d,]+)/g) ?? [];
      const finalAmount = amounts.at(-1)?.replaceAll(/[$,]/g, "");
      const cash = finalAmount === undefined ? Number.NEGATIVE_INFINITY : Number(finalAmount);
      return { active, cash };
    }),
  );
  const eligible = scores.map((score, index) => ({ ...score, index })).filter((score) => score.active);
  const candidates = eligible.length > 0 ? eligible : scores.map((score, index) => ({ ...score, index }));
  candidates.sort((first, second) => second.cash - first.cash);
  await playDirectorDecision(page, candidates[0]?.index ?? 0);
}
