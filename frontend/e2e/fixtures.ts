import { expect, test as base, type Page } from "@playwright/test";

const backendUrl = "http://127.0.0.1:8010";
const fixedSeed = 42;

export const mockedBriefing = {
  source: "live",
  headline: "Playwright Market Briefing",
  situation_summary: "The selected decision reshaped the company's operating posture.",
  consequence_explanation: "The recorded engine changes define the consequences of this turn.",
  strategic_insight: "Protect resilience while balancing growth and team stability.",
  next_turn_teaser: "A future turn may introduce another test of the current strategy.",
} as const;

export interface AIBriefingMock {
  calls: number;
  histories: string[][];
  /** Briefings for scenarios without live AI, passed through to the fallback-only backend. */
  authoredPassthroughs: { scenarioId: string; history: string[] }[];
}

/** Scenarios that never opt into live AI; their briefings are authored fallback. */
export const authoredBriefingScenarios = new Set(["cybersecurity-crisis", "space-colony"]);

interface E2EFixtures {
  aiBriefingMock: AIBriefingMock;
  deterministicStart: void;
}

export const test = base.extend<E2EFixtures>({
  aiBriefingMock: [
    async ({ page }, use) => {
      const mock: AIBriefingMock = { calls: 0, histories: [], authoredPassthroughs: [] };
      await page.route(`${backendUrl}/api/ai/briefing`, async (route) => {
        const request = route.request();
        if (request.method() !== "POST") {
          await route.abort("blockedbyclient");
          throw new Error("E2E safety violation: AI briefing request was not POST");
        }
        const body = request.postDataJSON() as Record<string, unknown>;
        if (
          typeof body.scenario_id === "string" &&
          authoredBriefingScenarios.has(body.scenario_id) &&
          body.scenario_version === "1.0.0" &&
          body.seed === fixedSeed &&
          Array.isArray(body.action_history)
        ) {
          // The E2E backend has AI disabled, and these scenarios have no live opt-in,
          // so the real response is the deterministic authored fallback.
          mock.authoredPassthroughs.push({
            scenarioId: body.scenario_id,
            history: body.action_history as string[],
          });
          await route.continue();
          return;
        }
        if (
          body.scenario_id !== "startup-survival" ||
          body.scenario_version !== "1.0.0" ||
          body.seed !== fixedSeed ||
          !Array.isArray(body.action_history) ||
          body.action_history.length === 0
        ) {
          await route.abort("blockedbyclient");
          throw new Error("E2E safety violation: unexpected AI briefing request contract");
        }
        mock.calls += 1;
        mock.histories.push(body.action_history as string[]);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockedBriefing),
        });
      });
      await use(mock);
    },
    { auto: true },
  ],
  deterministicStart: [
    async ({ page }, use) => {
      await page.route(`${backendUrl}/api/games/start`, async (route) => {
        const request = route.request();
        if (request.method() !== "POST") {
          await route.continue();
          return;
        }
        const body = request.postDataJSON() as Record<string, unknown>;
        const headers = { ...request.headers(), "content-type": "application/json" };
        delete headers["content-length"];
        await route.continue({
          headers,
          postData: JSON.stringify({ ...body, seed: fixedSeed }),
        });
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };

export async function openScenario(page: Page, scenarioId: string, title: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "ScenarioLab" })).toBeVisible();
  const card = page.locator(`[data-scenario-id="${scenarioId}"]`);
  await card.getByRole("button", { name: "View Details" }).click();
  await expect(card.getByText("Definition validated")).toBeVisible();
  await card.getByRole("button", { name: "Open Simulation" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

export async function openStartupSimulation(page: Page): Promise<void> {
  await openScenario(page, "startup-survival", "Startup Survival");
}

export async function startClassicScenario(page: Page, scenarioId: string, title: string): Promise<void> {
  await openScenario(page, scenarioId, title);
  await page.getByRole("button", { name: /Choose Classic Simulation/ }).click();
  const startResponse = page.waitForResponse(
    (response) =>
      response.url() === `${backendUrl}/api/games/start` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect((await startResponse).ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible();
  await expect(page.getByText("Seed 42")).toBeVisible();
}

export async function startStartupSimulation(page: Page): Promise<void> {
  await openStartupSimulation(page);
  await page.getByRole("button", { name: /Choose Classic Simulation/ }).click();
  const startResponse = page.waitForResponse(
    (response) =>
      response.url() === `${backendUrl}/api/games/start` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Start New Game" }).click();
  await expect((await startResponse).ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible();
  await expect(page.getByText("Seed 42")).toBeVisible();
}

export async function startDirectorSimulation(page: Page): Promise<void> {
  await openStartupSimulation(page);
  await page.getByRole("button", { name: /Choose AI Scenario Director/ }).click();
  const startResponse = page.waitForResponse(
    (response) => response.url() === `${backendUrl}/api/games/start` && response.request().method() === "POST",
  );
  const proposalResponse = page.waitForResponse(
    (response) => response.url() === `${backendUrl}/api/ai/director/proposal` && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Start Director Simulation" }).click();
  await expect((await startResponse).ok()).toBeTruthy();
  await expect((await proposalResponse).ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Key metrics" })).toBeVisible();
  await expect(page.getByText("Director situation · turn 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Authored fallback", { exact: true })).toBeVisible();
}

export async function playDecision(page: Page, accessibleName: RegExp): Promise<void> {
  // The accessible radio is intentionally visually hidden inside its clickable label.
  await page.getByRole("radio", { name: accessibleName }).check({ force: true });
  const turnResponse = page.waitForResponse(
    (response) =>
      response.url() === `${backendUrl}/api/games/turn` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Confirm Decision" }).click();
  await expect((await turnResponse).ok()).toBeTruthy();
}

export async function playDirectorDecision(page: Page, choiceIndex = 0): Promise<void> {
  const choice = page.locator('input[name="director-choice"]').nth(choiceIndex);
  await choice.check({ force: true });
  const turnResponse = page.waitForResponse(
    (response) => response.url() === `${backendUrl}/api/ai/director/turn` && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Confirm Director Choice" }).click();
  await expect((await turnResponse).ok()).toBeTruthy();
}
