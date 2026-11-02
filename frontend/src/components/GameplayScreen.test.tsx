import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import {
  gameStartFixture,
  gameTurnFixture,
  fallbackBriefingFixture,
  liveBriefingFixture,
  scenarioCatalogFixture,
  secondGameTurnFixture,
  terminalTurnFixture,
} from "../test/scenarioFixtures";
import { GameplayScreen } from "./GameplayScreen";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function renderGameplay() {
  const startup = scenarioCatalogFixture[0];
  if (startup === undefined) {
    throw new Error("Startup fixture is missing");
  }
  render(<GameplayScreen catalogEntry={startup} onBack={vi.fn()} />);
}

async function startSimulation() {
  fireEvent.click(screen.getByRole("button", { name: "Start Simulation" }));
  await screen.findByText("Company metrics");
}

test("starts a simulation and renders initial generic metrics and decisions", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(jsonResponse(gameStartFixture)),
  );
  renderGameplay();

  expect(screen.getByRole("heading", { name: "Startup Survival" })).toBeInTheDocument();
  expect(screen.getByText(gameStartFixture.scenario.objective)).toBeInTheDocument();
  await startSimulation();

  expect(screen.getByText("Month 1 of 12")).toBeInTheDocument();
  expect(screen.getByText("$150,000")).toBeInTheDocument();
  expect(screen.getByText("$15,000")).toBeInTheDocument();
  expect(screen.getByText("$45,000")).toBeInTheDocument();
  expect(screen.getByText("2,000")).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument();
  expect(screen.getByText("82/100")).toBeInTheDocument();
  expect(screen.getByText("75/100")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /Invest in Marketing/ })).toBeEnabled();
  expect(screen.getByRole("radio", { name: /Improve the Product/ })).toBeEnabled();
  expect(screen.getByRole("radio", { name: /Reduce Operating Expenses/ })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Confirm Decision" })).toBeDisabled();
});

test("submits a selected decision and renders only server-returned results and event", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(gameStartFixture))
    .mockResolvedValueOnce(jsonResponse(gameTurnFixture))
    .mockResolvedValueOnce(jsonResponse(liveBriefingFixture));
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();
  await startSimulation();

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));

  expect(await screen.findByText("$127,500")).toBeInTheDocument();
  expect(screen.getByText("Month 1 resolved")).toBeInTheDocument();
  expect(screen.getByText("Competitor Price Cut")).toBeInTheDocument();
  expect(
    screen.getByText("A competitor lowers prices and pressures customer sentiment."),
  ).toBeInTheDocument();
  expect(screen.getByText("Decrease −$22,500 · unfavorable")).toBeInTheDocument();
  expect(screen.getByText("Decrease −$7,500 · favorable")).toBeInTheDocument();
  const revenueCard = document.querySelector('[data-metric-id="monthly-revenue"]');
  expect(revenueCard).toHaveAttribute("data-change", "unchanged");
  expect(revenueCard).toHaveTextContent("No change");
  expect(await screen.findByText(liveBriefingFixture.headline)).toBeInTheDocument();
  expect(screen.getByText("Live AI")).toBeInTheDocument();

  const request = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as Record<string, unknown>;
  expect(request).toMatchObject({
    scenario_id: "startup-survival",
    scenario_version: "1.0.0",
    seed: 42,
    action_history: [],
    action_id: "reduce-operating-expenses",
  });
});

test("keeps current state after a failed turn and offers a retry", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(gameStartFixture))
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(jsonResponse(gameTurnFixture))
    .mockResolvedValueOnce(jsonResponse(fallbackBriefingFixture));
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();
  await startSimulation();

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));

  expect(await screen.findByText("Simulation request failed")).toBeInTheDocument();
  expect(screen.getByText(/Could not reach the ScenarioLab API/)).toBeInTheDocument();
  expect(screen.getByText("$150,000")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
  expect(await screen.findByText("$127,500")).toBeInTheDocument();
});

test("prevents duplicate turn submissions while a request is pending", async () => {
  let resolveTurn: ((value: Response) => void) | undefined;
  const pendingTurn = new Promise<Response>((resolve) => {
    resolveTurn = resolve;
  });
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(gameStartFixture))
    .mockReturnValueOnce(pendingTurn)
    .mockResolvedValueOnce(jsonResponse(liveBriefingFixture));
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();
  await startSimulation();

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  const confirm = screen.getByRole("button", { name: "Confirm Decision" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: "Resolving Decision…" })).toBeDisabled();
  resolveTurn?.(jsonResponse(gameTurnFixture));
  await screen.findByText(liveBriefingFixture.headline);
  expect(
    fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/ai/briefing")),
  ).toHaveLength(1);
});

test("renders terminal victory, disables decisions, and restarts with fresh state", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(gameStartFixture))
    .mockResolvedValueOnce(jsonResponse(terminalTurnFixture))
    .mockResolvedValueOnce(jsonResponse(fallbackBriefingFixture))
    .mockResolvedValueOnce(jsonResponse({ ...gameStartFixture, seed: 77 }));
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();
  await startSimulation();

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));

  expect(await screen.findByRole("heading", { name: "Victory" })).toBeInTheDocument();
  expect(screen.getByText("Outcome: Survived The Year")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirm Decision" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Restart Simulation" }));

  await waitFor(() => expect(screen.getByText("Seed 77")).toBeInTheDocument());
  expect(screen.getByText("$150,000")).toBeInTheDocument();
  expect(screen.getByText("Month 1 of 12")).toBeInTheDocument();
});

test("shows a retryable error when the start request fails", async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(jsonResponse(gameStartFixture));
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();

  fireEvent.click(screen.getByRole("button", { name: "Start Simulation" }));
  expect(await screen.findByText("Simulation request failed")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

  expect(await screen.findByText("Company metrics")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("rejects unexpected start response data instead of rendering it", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(jsonResponse({ scenario_id: "startup-survival" })),
  );
  renderGameplay();

  fireEvent.click(screen.getByRole("button", { name: "Start Simulation" }));

  expect(await screen.findByText("Simulation request failed")).toBeInTheDocument();
  expect(screen.getByText(/unexpected simulation data/i)).toBeInTheDocument();
  expect(screen.queryByText("Company metrics")).not.toBeInTheDocument();
});

test("shows AI loading while updated authoritative metrics remain playable", async () => {
  const pendingBriefing = new Promise<Response>(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(gameStartFixture))
      .mockResolvedValueOnce(jsonResponse(gameTurnFixture))
      .mockReturnValueOnce(pendingBriefing),
  );
  renderGameplay();
  await startSimulation();

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));

  expect(await screen.findByText("$127,500")).toBeInTheDocument();
  expect(screen.getByText("Preparing AI briefingâ€¦")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /Invest in Marketing/ })).toBeEnabled();
});

test("renders deterministic fallback briefing disclosure", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(gameStartFixture))
      .mockResolvedValueOnce(jsonResponse(gameTurnFixture))
      .mockResolvedValueOnce(jsonResponse(fallbackBriefingFixture)),
  );
  renderGameplay();
  await startSimulation();

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));

  expect(await screen.findByText(fallbackBriefingFixture.headline)).toBeInTheDocument();
  expect(screen.getByText("Deterministic fallback")).toBeInTheDocument();
});

test("keeps gameplay functional when the AI request fails", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(gameStartFixture))
    .mockResolvedValueOnce(jsonResponse(gameTurnFixture))
    .mockRejectedValueOnce(new TypeError("AI unavailable"))
    .mockResolvedValueOnce(jsonResponse(secondGameTurnFixture))
    .mockResolvedValueOnce(jsonResponse(fallbackBriefingFixture));
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();
  await startSimulation();

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));
  expect(await screen.findByText("AI briefing unavailable")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));
  expect(await screen.findByText("Month 2 resolved")).toBeInTheDocument();
});

test("prevents a stale briefing from replacing the latest turn", async () => {
  let resolveOldBriefing: ((value: Response) => void) | undefined;
  const oldBriefing = new Promise<Response>((resolve) => {
    resolveOldBriefing = resolve;
  });
  let turnCalls = 0;
  let briefingCalls = 0;
  const latestBriefing = {
    ...liveBriefingFixture,
    headline: "The Latest Decision Reframes the Outlook",
  };
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) {
      return Promise.resolve(jsonResponse(gameStartFixture));
    }
    if (url.endsWith("/api/games/turn")) {
      turnCalls += 1;
      return Promise.resolve(
        jsonResponse(turnCalls === 1 ? gameTurnFixture : secondGameTurnFixture),
      );
    }
    briefingCalls += 1;
    return briefingCalls === 1
      ? oldBriefing
      : Promise.resolve(jsonResponse(latestBriefing));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();
  await startSimulation();

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));
  expect(await screen.findByText("Preparing AI briefingâ€¦")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));
  expect(await screen.findByText(latestBriefing.headline)).toBeInTheDocument();

  resolveOldBriefing?.(
    jsonResponse({ ...liveBriefingFixture, headline: "Outdated Briefing" }),
  );
  await waitFor(() => {
    expect(screen.queryByText("Outdated Briefing")).not.toBeInTheDocument();
    expect(screen.getByText(latestBriefing.headline)).toBeInTheDocument();
  });
});
