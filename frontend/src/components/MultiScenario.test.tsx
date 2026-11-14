import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import type { ScenarioCatalogEntry, ScenarioDefinition } from "../lib/api";
import { SAVE_FORMAT_VERSION, SAVE_STORAGE_KEY, type SavedScriptedRun } from "../lib/savedRun";
import {
  catalogFixture,
  cyberBriefingFixture,
  cyberDefinitionFixture,
  cyberStartFixture,
  cyberTurnsFixture,
  spaceBriefingFixture,
  spaceDefinitionFixture,
  spaceStartFixture,
  spaceTurnsFixture,
} from "../test/multiScenarioFixtures";
import { GameplayScreen } from "./GameplayScreen";
import { ScenarioCatalog } from "./ScenarioCatalog";

const STARTUP_TERMS = /startup|cash|revenue|monthly|customer satisfaction|\$/i;

function entry(scenarioId: string): ScenarioCatalogEntry {
  const found = catalogFixture.find((item) => item.scenario_id === scenarioId);
  if (found === undefined) throw new Error(`missing catalog fixture ${scenarioId}`);
  return found;
}

interface Routes {
  definition: ScenarioDefinition;
  start: unknown;
  turns: unknown[];
  briefing: unknown;
}

function stubApi(routes: Routes) {
  const calls: { url: string; body: Record<string, unknown> | null }[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : null;
    calls.push({ url, body });
    let response: unknown;
    if (url.endsWith("/api/games/start")) response = routes.start;
    else if (url.endsWith("/api/games/turn")) {
      const history = (body?.action_history as unknown[] | undefined) ?? [];
      response = routes.turns[history.length];
    } else if (url.endsWith("/api/ai/briefing")) response = routes.briefing;
    else if (url.endsWith(`/api/scenarios/${routes.definition.scenario_id}`)) response = routes.definition;
    else if (url.endsWith("/api/scenarios")) response = catalogFixture;
    if (response === undefined) return Promise.reject(new Error(`Unexpected request: ${url}`));
    return Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const cyberRoutes: Routes = {
  definition: cyberDefinitionFixture,
  start: cyberStartFixture,
  turns: cyberTurnsFixture,
  briefing: cyberBriefingFixture,
};
const spaceRoutes: Routes = {
  definition: spaceDefinitionFixture,
  start: spaceStartFixture,
  turns: spaceTurnsFixture,
  briefing: spaceBriefingFixture,
};

test.each([
  ["Cybersecurity Crisis", cyberRoutes, "12 decision rounds · 6 tracked metrics"],
  ["Space Colony", spaceRoutes, "12 decision cycles · 8 tracked metrics"],
])("catalog opens %s with its own turn vocabulary", async (title, routes, summary) => {
  stubApi(routes);
  const onOpenScenario = vi.fn();
  render(<ScenarioCatalog onOpenScenario={onOpenScenario} />);

  const card = (await screen.findByRole("heading", { name: title })).closest("article") as HTMLElement;
  expect(within(card).getByText("Available")).toBeInTheDocument();
  fireEvent.click(within(card).getByRole("button", { name: "View Details" }));

  expect(await within(card).findByText(summary)).toBeInTheDocument();
  fireEvent.click(within(card).getByRole("button", { name: "Open Simulation" }));
  expect(onOpenScenario).toHaveBeenCalledWith(entry(routes.definition.scenario_id), routes.definition);
});

test.each([
  ["cybersecurity-crisis", cyberDefinitionFixture, "Cybersecurity scenario"],
  ["space-colony", spaceDefinitionFixture, "Space scenario"],
])("%s explains that AI Scenario Director is unavailable", (scenarioId, definition, eyebrow) => {
  render(<GameplayScreen catalogEntry={entry(scenarioId)} onBack={vi.fn()} scenarioDefinition={definition} />);

  expect(screen.getByText(eyebrow)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Choose Classic Simulation/ })).toBeEnabled();
  expect(screen.queryByRole("button", { name: /Choose AI Scenario Director/ })).not.toBeInTheDocument();
  const unavailable = screen.getByTestId("director-unavailable");
  expect(unavailable).toHaveAttribute("aria-disabled", "true");
  expect(unavailable).toHaveTextContent("Not available for this scenario");
  expect(unavailable).toHaveTextContent(`AI Scenario Director is not available for ${definition.title}`);
  expect(screen.queryByText(/Startup Survival$/)).not.toBeInTheDocument();
});

test("Startup Survival still offers both gameplay modes", () => {
  render(
    <GameplayScreen
      catalogEntry={entry("startup-survival")}
      onBack={vi.fn()}
      scenarioDefinition={cyberDefinitionFixture}
    />,
  );

  expect(screen.getByRole("button", { name: /Choose AI Scenario Director/ })).toBeEnabled();
  expect(screen.queryByTestId("director-unavailable")).not.toBeInTheDocument();
});

test("Cybersecurity Crisis plays a round with scenario-specific labels, authored briefing, and save", async () => {
  const calls = stubApi(cyberRoutes);
  render(<GameplayScreen catalogEntry={entry("cybersecurity-crisis")} onBack={vi.fn()} scenarioDefinition={cyberDefinitionFixture} />);

  fireEvent.click(screen.getByRole("button", { name: /Choose Classic Simulation/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start New Game" }));

  expect(await screen.findByText("Round 1 of 12")).toBeInTheDocument();
  expect(screen.getByLabelText("Threat Level: 30/100")).toBeInTheDocument();
  expect(screen.getByLabelText("Attacker Momentum: 4 /round")).toBeInTheDocument();
  expect(screen.getByLabelText("Operational Continuity: 90%")).toBeInTheDocument();
  expect(screen.getByLabelText("Response Resources: 140 hrs")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Trends" }));
  expect(screen.getByRole("heading", { name: "Resource and status visualizations" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Decide" }));
  const decisions = screen.getByRole("group", { name: "Choose one available decision" });
  expect(within(decisions).getAllByRole("radio")).toHaveLength(6);
  expect(within(decisions).queryByRole("radio", { name: /Fail Over to Backup Site/ })).not.toBeInTheDocument();
  expect(decisions.textContent).not.toMatch(STARTUP_TERMS);
  const isolate = screen.getByRole("radio", { name: /^Isolate Affected Systems/ }).closest("label") as HTMLElement;
  expect(within(isolate).getByText("Attacker Momentum −3 /round")).toHaveClass("text-success");
  expect(within(isolate).getByText("Operational Continuity −10%")).toHaveClass("text-danger");
  expect(document.querySelector("[data-scenario-category]")).toHaveAttribute("data-scenario-category", "cybersecurity");

  fireEvent.click(screen.getByRole("radio", { name: /Isolate Affected Systems/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));

  expect(await screen.findByText("Round 1 resolved")).toBeInTheDocument();
  expect(screen.getByText("Round 2 of 12")).toBeInTheDocument();
  const latest = screen.getByRole("region", { name: "Latest turn explanation" });
  expect(within(latest).getByRole("heading", { name: "Targeted Phishing Campaign" })).toBeInTheDocument();
  expect(screen.getByLabelText("Attacker Momentum: 3 /round")).toBeInTheDocument();
  expect(screen.getByLabelText("Threat Level: 31/100")).toBeInTheDocument();

  const briefingHeading = await within(latest).findByRole("heading", { name: cyberBriefingFixture.headline });
  const briefing = briefingHeading.closest("section") as HTMLElement;
  expect(within(briefing).getByText("Strategic briefing")).toBeInTheDocument();
  expect(within(briefing).getByText("Authored briefing")).toBeInTheDocument();
  expect(briefing.textContent).not.toMatch(/\bAI\b|Live AI/);
  expect(screen.getByText("Round 1", { selector: "[data-history-turn] p" })).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(STARTUP_TERMS);

  const saved = JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY) ?? "null") as SavedScriptedRun;
  expect(saved).toEqual({
    format_version: SAVE_FORMAT_VERSION,
    scenario_id: "cybersecurity-crisis",
    scenario_version: "1.0.0",
    seed: 42,
    action_history: ["isolate-affected-systems"],
  });
  expect(calls.filter((call) => call.url.includes("/api/ai/director"))).toHaveLength(0);
});

test("Space Colony renders reserves, per-cycle balances, and distinct chart groups", async () => {
  stubApi(spaceRoutes);
  render(<GameplayScreen catalogEntry={entry("space-colony")} onBack={vi.fn()} scenarioDefinition={spaceDefinitionFixture} />);

  fireEvent.click(screen.getByRole("button", { name: /Choose Classic Simulation/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start New Game" }));

  expect(await screen.findByText("Cycle 1 of 12")).toBeInTheDocument();
  expect(screen.getByLabelText("Oxygen Reserve: 30 days")).toBeInTheDocument();
  expect(screen.getByLabelText("Oxygen Balance: -2 days/cycle")).toBeInTheDocument();
  expect(screen.getByLabelText("Energy Reserve: 34 days")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Decide" })).toHaveAttribute("aria-selected", "true");
  fireEvent.click(screen.getByRole("tab", { name: "Trends" }));
  expect(screen.getByRole("heading", { name: "Days trends" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Days per cycle trends" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirm Decision" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Decide" }));

  fireEvent.click(screen.getByRole("radio", { name: /Expand Hydroponics Bay/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));

  expect(await screen.findByText("Cycle 1 resolved")).toBeInTheDocument();
  expect(screen.getByText("No event triggered this turn.")).toBeInTheDocument();
  const food = screen.getByLabelText("Food Balance: -1 days/cycle");
  expect(food).toHaveAttribute("data-change", "positive");
  expect(food).toHaveTextContent("Increase +2 days/cycle · favorable");
  expect(screen.getByLabelText("Energy Reserve: 28 days")).toHaveTextContent("Decrease −6 days · unfavorable");
  await screen.findByText("Next cycle outlook");
});

test("a saved Cybersecurity Crisis run resumes through stateless replay without briefing requests", async () => {
  const calls = stubApi(cyberRoutes);
  const save: SavedScriptedRun = {
    format_version: SAVE_FORMAT_VERSION,
    scenario_id: "cybersecurity-crisis",
    scenario_version: "1.0.0",
    seed: 42,
    action_history: ["isolate-affected-systems", "isolate-affected-systems"],
  };
  render(
    <GameplayScreen
      catalogEntry={entry("cybersecurity-crisis")}
      existingSave={save}
      onBack={vi.fn()}
      resumeSave={save}
      scenarioDefinition={cyberDefinitionFixture}
    />,
  );

  expect(await screen.findByText("Round 3 of 12")).toBeInTheDocument();
  expect(document.querySelectorAll("[data-history-turn]")).toHaveLength(2);
  expect(screen.getByText(/A new authored briefing will follow your next decision/)).toBeInTheDocument();
  await waitFor(() => {
    expect(calls.filter((call) => call.url.endsWith("/api/games/turn"))).toHaveLength(2);
  });
  expect(calls.filter((call) => call.url.endsWith("/api/ai/briefing"))).toHaveLength(0);
  expect(calls.find((call) => call.url.endsWith("/api/games/start"))?.body).toEqual({
    scenario_id: "cybersecurity-crisis",
    seed: 42,
  });
});
