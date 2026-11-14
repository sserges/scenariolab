import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import {
  gameStartFixture,
  gameTurnFixture,
  fallbackBriefingFixture,
  liveBriefingFixture,
  scenarioCatalogFixture,
  secondGameTurnFixture,
  startupActionsFixture,
  startupDefinitionFixture,
  terminalTurnFixture,
} from "../test/scenarioFixtures";
import { GameplayScreen } from "./GameplayScreen";
import { SAVE_FORMAT_VERSION, SAVE_STORAGE_KEY, type SavedRun } from "../lib/savedRun";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function renderGameplay(resumeSave: {
  format_version: 1;
  scenario_id: string;
  scenario_version: string;
  seed: number;
  action_history: string[];
} | null = null) {
  const startup = scenarioCatalogFixture[0];
  if (startup === undefined) {
    throw new Error("Startup fixture is missing");
  }
  render(
    <GameplayScreen
      catalogEntry={startup}
      onBack={vi.fn()}
      resumeSave={resumeSave}
      scenarioDefinition={startupDefinitionFixture}
    />,
  );
}

function terminalReplayFixture(actionCount: number) {
  const history = terminalTurnFixture.state.decision_history.slice(0, actionCount);
  const isTerminal = actionCount === terminalTurnFixture.action_history.length;
  const state = {
    ...terminalTurnFixture.state,
    current_turn: isTerminal ? actionCount : actionCount + 1,
    status: isTerminal ? "won" as const : "active" as const,
    decision_history: history,
  };
  const previousHistory = terminalTurnFixture.state.decision_history.slice(0, actionCount - 1);
  const previousState = actionCount === 1
    ? gameStartFixture.state
    : {
        ...state,
        current_turn: actionCount,
        status: "active" as const,
        decision_history: previousHistory,
      };
  const latestRecord = history.at(-1);
  const action = startupActionsFixture.find((item) => item.action_id === latestRecord?.action_id);
  if (latestRecord === undefined || action === undefined) {
    throw new Error("Terminal replay fixture is incomplete");
  }
  return {
    ...terminalTurnFixture,
    state,
    action_history: terminalTurnFixture.action_history.slice(0, actionCount),
    available_actions: isTerminal ? [] : gameStartFixture.available_actions,
    turn_result: {
      ...terminalTurnFixture.turn_result,
      previous_state: previousState,
      new_state: state,
      selected_action: action,
      completed_turn_index: actionCount,
      resulting_status: state.status,
      outcome_reason: latestRecord.outcome_reason,
    },
  };
}

const oneTurnSave: SavedRun = {
  format_version: SAVE_FORMAT_VERSION,
  scenario_id: "startup-survival",
  scenario_version: "1.0.0",
  seed: 42,
  action_history: ["reduce-operating-expenses"],
};

async function startSimulation() {
  const classicChoice = screen.queryByRole("button", { name: /Choose Classic Simulation/ });
  if (classicChoice !== null) fireEvent.click(classicChoice);
  fireEvent.click(screen.getByRole("button", { name: "Start New Game" }));
  await screen.findByText("Key metrics");
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
  expect(screen.getByLabelText("Cash: $150,000")).toBeInTheDocument();
  expect(screen.getByText("$15,000")).toBeInTheDocument();
  expect(screen.getByText("$45,000")).toBeInTheDocument();
  expect(document.querySelector('[data-metric-id="active-users"]')).toHaveTextContent("2,000");
  expect(document.querySelector('[data-metric-id="employees"]')).toHaveTextContent("12");
  expect(document.querySelector('[data-metric-id="customer-satisfaction"]')).toHaveTextContent("82/100");
  expect(document.querySelector('[data-metric-id="team-morale"]')).toHaveTextContent("75/100");
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

  expect(await screen.findByLabelText("Cash: $127,500")).toBeInTheDocument();
  expect(screen.getByText("Month 1 resolved")).toBeInTheDocument();
  expect(screen.getAllByText("Competitor Price Cut").length).toBeGreaterThan(0);
  expect(
    screen.getAllByText("A competitor lowers prices and pressures customer sentiment.").length,
  ).toBeGreaterThan(0);
  expect(screen.getByLabelText("Cash: $127,500")).toHaveTextContent("Decrease −$22,500 · unfavorable");
  expect(screen.getByLabelText("Monthly Expenses: $37,500")).toHaveTextContent("Decrease −$7,500 · favorable");
  const revenueCard = document.querySelector('[data-metric-id="monthly-revenue"]');
  expect(revenueCard).toHaveAttribute("data-change", "unchanged");
  expect(revenueCard).toHaveTextContent("No change");
  expect((await screen.findAllByText(liveBriefingFixture.headline)).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Live AI").length).toBeGreaterThan(0);
  expect(JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY) ?? "{}")).toEqual(oneTurnSave);

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
  const savedBeforeRejectedTurn = localStorage.getItem(SAVE_STORAGE_KEY);

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));

  expect(await screen.findByText("Simulation request failed")).toBeInTheDocument();
  expect(screen.getByText(/Could not reach the ScenarioLab API/)).toBeInTheDocument();
  expect(screen.getByLabelText("Cash: $150,000")).toBeInTheDocument();
  expect(JSON.parse(savedBeforeRejectedTurn ?? "{}")).toMatchObject({ action_history: [] });
  expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe(savedBeforeRejectedTurn);
  fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
  expect(await screen.findByLabelText("Cash: $127,500")).toBeInTheDocument();
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
  await screen.findAllByText(liveBriefingFixture.headline);
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
  vi.spyOn(window, "confirm").mockReturnValue(true);
  renderGameplay();
  await startSimulation();

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));

  expect(await screen.findByRole("heading", { name: "Victory" })).toBeInTheDocument();
  expect(screen.getByText("Outcome: The Startup Survived")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirm Decision" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Restart Simulation" }));

  await waitFor(() => expect(screen.getByText("Seed 77")).toBeInTheDocument());
  expect(screen.getByLabelText("Cash: $150,000")).toBeInTheDocument();
  expect(screen.getByText("Month 1 of 12")).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY) ?? "{}")).toEqual({
    ...oneTurnSave,
    seed: 77,
    action_history: [],
  });
});

test("shows a retryable error when the start request fails", async () => {
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(jsonResponse(gameStartFixture));
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();

  fireEvent.click(screen.getByRole("button", { name: /Choose Classic Simulation/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start New Game" }));
  expect(await screen.findByText("Simulation request failed")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

  expect(await screen.findByText("Key metrics")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("rejects unexpected start response data instead of rendering it", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(jsonResponse({ scenario_id: "startup-survival" })),
  );
  renderGameplay();

  fireEvent.click(screen.getByRole("button", { name: /Choose Classic Simulation/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start New Game" }));

  expect(await screen.findByText("Simulation request failed")).toBeInTheDocument();
  expect(screen.getByText(/unexpected simulation data/i)).toBeInTheDocument();
  expect(screen.queryByText("Key metrics")).not.toBeInTheDocument();
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

  expect(await screen.findByLabelText("Cash: $127,500")).toBeInTheDocument();
  expect(screen.getByText("Preparing briefing…")).toBeInTheDocument();
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

  expect((await screen.findAllByText(fallbackBriefingFixture.headline)).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Deterministic fallback").length).toBeGreaterThan(0);
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
  expect(await screen.findByText("Preparing briefing…")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));
  expect((await screen.findAllByText(latestBriefing.headline)).length).toBeGreaterThan(0);

  resolveOldBriefing?.(
    jsonResponse({ ...liveBriefingFixture, headline: "Outdated Briefing" }),
  );
  await waitFor(() => {
    expect(screen.queryByText("Outdated Briefing")).not.toBeInTheDocument();
    expect(screen.getAllByText(latestBriefing.headline).length).toBeGreaterThan(0);
  });
});

test("resumes saved decisions through stateless replay without briefing calls", async () => {
  localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(oneTurnSave));
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(gameStartFixture))
    .mockResolvedValueOnce(jsonResponse(gameTurnFixture));
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay(oneTurnSave);

  expect(await screen.findByText("Month 1 resolved")).toBeInTheDocument();
  expect(screen.getByText("Month 2 of 12")).toBeInTheDocument();
  expect(screen.getByText(/No AI requests were made during resume/)).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/ai/briefing"))).toHaveLength(0);
  expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe(JSON.stringify(oneTurnSave));
});

test("preserves incompatible saved progress and explains the version mismatch", async () => {
  const incompatibleSave = { ...oneTurnSave, scenario_version: "2.0.0" };
  const serialized = JSON.stringify(incompatibleSave);
  localStorage.setItem(SAVE_STORAGE_KEY, serialized);
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay(incompatibleSave);

  expect(await screen.findByText("Saved game could not resume")).toBeInTheDocument();
  expect(screen.getByText(/saved scenario version is no longer available/i)).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe(serialized);
});

test("keeps play active when localStorage writes are unavailable", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage disabled", "SecurityError");
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(gameStartFixture)));
  renderGameplay();

  await startSimulation();
  expect(screen.getByText(/Local storage is unavailable/)).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /Reduce Operating Expenses/ })).toBeEnabled();
});

test("restores terminal saves as completed reports without reopening decisions", async () => {
  const terminalSave: SavedRun = {
    ...oneTurnSave,
    action_history: [...terminalTurnFixture.action_history],
  };
  let replayCount = 0;
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) {
      return Promise.resolve(jsonResponse(gameStartFixture));
    }
    if (url.endsWith("/api/games/turn")) {
      replayCount += 1;
      return Promise.resolve(jsonResponse(terminalReplayFixture(replayCount)));
    }
    return Promise.reject(new Error(`Unexpected request ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay(terminalSave);

  expect(await screen.findByRole("heading", { name: "Victory" })).toBeInTheDocument();
  expect(screen.getByText("12 of 12 turns completed · Final status: Won")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirm Decision" })).not.toBeInTheDocument();
  expect(replayCount).toBe(12);
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/ai/briefing"))).toHaveLength(0);
});
