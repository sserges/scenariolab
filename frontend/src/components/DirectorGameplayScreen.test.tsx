import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { GameplayScreen } from "./GameplayScreen";
import {
  DIRECTOR_SAVE_FORMAT_VERSION,
  SAVE_STORAGE_KEY,
  type SavedDirectorRun,
} from "../lib/savedRun";
import {
  directorHistoryFixture,
  directorInitialProposalFixture,
  directorReplayResponseFor,
  proposalResponseFor,
  signedProposalFor,
  turnResponseFor,
} from "../test/directorFixtures";
import {
  gameStartFixture,
  startupDefinitionFixture,
} from "../test/scenarioFixtures";
import type { DirectorTurnRecord } from "../lib/api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const startupEntry = {
  scenario_id: "startup-survival",
  title: "Startup Survival",
  description: "Guide a startup through twelve months of hard tradeoffs.",
  category: "business",
  objective: "Keep a startup alive for 12 simulated months.",
  availability: "available" as const,
  planned_key_metrics: ["Cash", "Monthly Revenue"],
};

function renderGameplay(resumeSave: SavedDirectorRun | null = null, existingSave: SavedDirectorRun | null = null, onSaveStateChange = vi.fn()) {
  render(
    <GameplayScreen
      catalogEntry={startupEntry}
      existingSave={existingSave}
      onBack={vi.fn()}
      onSaveStateChange={onSaveStateChange}
      resumeSave={resumeSave}
      scenarioDefinition={startupDefinitionFixture}
    />,
  );
  return onSaveStateChange;
}

function chooseDirector() {
  fireEvent.click(screen.getByRole("button", { name: /Choose AI Scenario Director/ }));
}

function startDirector() {
  chooseDirector();
  fireEvent.click(screen.getByRole("button", { name: "Start Director Simulation" }));
}

function createOneTurnDirectorSave(record?: DirectorTurnRecord): SavedDirectorRun {
  const firstProposal = signedProposalFor(gameStartFixture.state);
  const firstTurn = record ?? turnResponseFor(firstProposal).turn_record;
  return {
    ...directorHistoryFixture([firstTurn]),
    format_version: DIRECTOR_SAVE_FORMAT_VERSION,
  };
}

test("offers Classic and Director mode choices before starting Startup Survival", () => {
  renderGameplay();
  expect(screen.getByRole("heading", { level: 1, name: "Startup Survival" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Choose Classic Simulation/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Choose AI Scenario Director/ })).toBeInTheDocument();
  expect(screen.getByText(/Director availability is controlled by the backend/)).toBeInTheDocument();
});

test("shows Director disabled response and leaves Classic playable", async () => {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) return Promise.resolve(jsonResponse(gameStartFixture));
    if (url.endsWith("/api/ai/director/proposal")) return Promise.resolve(jsonResponse({ detail: { code: "director_disabled", message: "Director mode is disabled by backend configuration." } }, 503));
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();

  startDirector();
  expect(await screen.findByText("Director mode is disabled or its backend signing configuration is unavailable. Choose Classic Simulation to continue. Any saved run remains unchanged.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Play Classic Simulation" }));
  fireEvent.click(screen.getByRole("button", { name: /Choose Classic Simulation/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start New Game" }));
  expect(await screen.findByRole("heading", { name: "Key metrics" })).toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/ai/director/proposal"))).toHaveLength(1);
});

test("shows proposal loading before enabling Director choices", async () => {
  let resolveProposal: ((value: Response) => void) | undefined;
  const pendingProposal = new Promise<Response>((resolve) => { resolveProposal = resolve; });
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) return Promise.resolve(jsonResponse(gameStartFixture));
    if (url.endsWith("/api/ai/director/proposal")) return pendingProposal;
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();
  startDirector();

  expect(await screen.findByRole("button", { name: "Starting Director…" })).toBeDisabled();
  expect(screen.queryByRole("radio", { name: /Fund a demand test/ })).not.toBeInTheDocument();
  resolveProposal?.(jsonResponse(directorInitialProposalFixture));
  expect(await screen.findByRole("radio", { name: /Fund a demand test/ })).toBeEnabled();
});

test("loads and renders the fallback situation, generated choices, previews, and source badge", async () => {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) return Promise.resolve(jsonResponse(gameStartFixture));
    if (url.endsWith("/api/ai/director/proposal")) return Promise.resolve(jsonResponse(directorInitialProposalFixture));
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();
  startDirector();

  expect(await screen.findByRole("heading", { name: "Supplier terms need a decision 1" })).toBeInTheDocument();
  expect(screen.getByText("Authored fallback")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /Fund a demand test/ })).toBeEnabled();
  expect(screen.getByRole("radio", { name: /Reduce overhead now/ })).toBeEnabled();
  expect(screen.getByRole("radio", { name: /Protect the core team/ })).toBeEnabled();
  expect(screen.getAllByTestId("director-preview")).toHaveLength(3);
  expect(screen.getAllByText("Authoritative preview")).toHaveLength(3);
  expect(screen.getByRole("button", { name: "Confirm Director Choice" })).toBeDisabled();
});

test("labels a live generated proposal distinctly", async () => {
  const liveProposal = {
    ...directorInitialProposalFixture,
    proposal: {
      ...directorInitialProposalFixture.proposal,
      payload: { ...directorInitialProposalFixture.proposal.payload, source: "live" as const },
    },
  };
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) return Promise.resolve(jsonResponse(gameStartFixture));
    if (url.endsWith("/api/ai/director/proposal")) return Promise.resolve(jsonResponse(liveProposal));
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();
  startDirector();

  expect(await screen.findByRole("heading", { name: "Supplier terms need a decision 1" })).toBeInTheDocument();
  expect(screen.getByLabelText("Situation source: AI generated")).toHaveTextContent("AI generated");
});

test("restores a valid pending proposal from replay without requesting a replacement", async () => {
  const pending = directorInitialProposalFixture.proposal;
  const save: SavedDirectorRun = {
    ...directorHistoryFixture(),
    format_version: DIRECTOR_SAVE_FORMAT_VERSION,
    pending_proposal: pending,
  };
  const replay = {
    ...directorReplayResponseFor(directorHistoryFixture(), gameStartFixture.state, null, null),
    pending_proposal: pending,
    pending_previews: directorInitialProposalFixture.previews,
  };
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) return Promise.resolve(jsonResponse(gameStartFixture));
    if (url.endsWith("/api/ai/director/replay")) {
      expect(JSON.parse(String(init?.body))).toHaveProperty("pending_proposal", pending);
      return Promise.resolve(jsonResponse(replay));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay(save);

  expect(await screen.findByRole("heading", { name: "Supplier terms need a decision 1" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /Fund a demand test/ })).toBeEnabled();
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/ai/director/proposal"))).toHaveLength(0);
});

test("rejects a tampered pending proposal and preserves the existing valid local save", async () => {
  const valid: SavedDirectorRun = {
    ...directorHistoryFixture(),
    format_version: DIRECTOR_SAVE_FORMAT_VERSION,
    pending_proposal: directorInitialProposalFixture.proposal,
  };
  const tampered: SavedDirectorRun = {
    ...valid,
    pending_proposal: {
      ...valid.pending_proposal!,
      signature: { ...valid.pending_proposal!.signature, value: "B".repeat(43) },
    },
  };
  localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(valid));
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) return Promise.resolve(jsonResponse(gameStartFixture));
    if (url.endsWith("/api/ai/director/replay")) return Promise.resolve(jsonResponse({ detail: { code: "invalid_director_signature", message: "Proposal signature invalid." } }, 422));
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  const saveChange = renderGameplay(tampered);

  expect(await screen.findByText(/backend rejected the saved signed history/i)).toBeInTheDocument();
  expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe(JSON.stringify(valid));
  expect(saveChange).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/ai/director/proposal"))).toHaveLength(0);
});

test("submits a selected signed choice and updates only from the authoritative turn response", async () => {
  const proposal = directorInitialProposalFixture;
  const turn = turnResponseFor(proposal.proposal, proposal.proposal.payload.choices[1]!.choice_id);
  const nextProposal = proposalResponseFor(turn.state);
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) return Promise.resolve(jsonResponse(gameStartFixture));
    if (url.endsWith("/api/ai/director/proposal")) {
      const body = JSON.parse(String(init?.body)) as { turn_records: unknown[] };
      return Promise.resolve(jsonResponse(body.turn_records.length === 0 ? proposal : nextProposal));
    }
    if (url.endsWith("/api/ai/director/turn")) return Promise.resolve(jsonResponse(turn));
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();
  startDirector();
  await screen.findByRole("heading", { name: "Supplier terms need a decision 1" });
  fireEvent.click(screen.getByRole("radio", { name: /Reduce overhead now/ }));
  expect(screen.getByRole("radio", { name: /Reduce overhead now/ })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Confirm Director Choice" }));

  expect(await screen.findByLabelText("Cash: $127,500")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Turn 1 resolved" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Supplier terms need a decision 1" })).toBeInTheDocument();
  expect(screen.getByText("Signed by director-test")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Supplier terms need a decision 2" })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY) ?? "null")).toMatchObject({
    format_version: 2,
    mode: "director",
    turn_records: [{ selected_choice_id: proposal.proposal.payload.choices[1]!.choice_id }],
  });
  expect(fetchMock.mock.calls.map(([url]) => String(url).split("/").at(-1))).toEqual(["start", "proposal", "turn", "proposal"]);
});

test("blocks duplicate Director submissions while the backend turn request is pending", async () => {
  let resolveTurn: ((value: Response) => void) | undefined;
  const pendingTurn = new Promise<Response>((resolve) => { resolveTurn = resolve; });
  const proposal = directorInitialProposalFixture;
  const turn = turnResponseFor(proposal.proposal);
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) return Promise.resolve(jsonResponse(gameStartFixture));
    if (url.endsWith("/api/ai/director/proposal")) return Promise.resolve(jsonResponse(proposal));
    if (url.endsWith("/api/ai/director/turn")) return pendingTurn;
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();
  startDirector();
  await screen.findByRole("heading", { name: "Supplier terms need a decision 1" });
  fireEvent.click(screen.getByRole("radio", { name: /Fund a demand test/ }));
  const submit = screen.getByRole("button", { name: "Confirm Director Choice" });
  fireEvent.click(submit);
  fireEvent.click(submit);

  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/ai/director/turn"))).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Verifying and resolving…" })).toBeDisabled();
  resolveTurn?.(jsonResponse(turn));
  expect(await screen.findByRole("heading", { name: "Turn 1 resolved" })).toBeInTheDocument();
});

test("rejects a stale proposal and requires loading a fresh signed situation", async () => {
  let proposalCalls = 0;
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) return Promise.resolve(jsonResponse(gameStartFixture));
    if (url.endsWith("/api/ai/director/proposal")) {
      proposalCalls += 1;
      return Promise.resolve(jsonResponse(directorInitialProposalFixture));
    }
    if (url.endsWith("/api/ai/director/turn")) return Promise.resolve(jsonResponse({ detail: { code: "stale_director_proposal", message: "Stale proposal." } }, 409));
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay();
  startDirector();
  await screen.findByRole("heading", { name: "Supplier terms need a decision 1" });
  fireEvent.click(screen.getByRole("radio", { name: /Fund a demand test/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Director Choice" }));
  expect(await screen.findByText(/signed proposal is stale or invalid/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Load Fresh Situation" }));
  expect(await screen.findByRole("heading", { name: "Supplier terms need a decision 1" })).toBeInTheDocument();
  expect(proposalCalls).toBe(2);
});

test("restores v2 history through backend replay and requests only the current incomplete turn", async () => {
  const turn = turnResponseFor(signedProposalFor(gameStartFixture.state));
  const saved = createOneTurnDirectorSave(turn.turn_record);
  const history = directorHistoryFixture(saved.turn_records);
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) return Promise.resolve(jsonResponse(gameStartFixture));
    if (url.endsWith("/api/ai/director/replay")) return Promise.resolve(jsonResponse(directorReplayResponseFor(history, turn.state, turn.turn_record, turn.turn_result)));
    if (url.endsWith("/api/ai/director/proposal")) return Promise.resolve(jsonResponse(proposalResponseFor(turn.state)));
    return Promise.reject(new Error(`Unexpected request: ${url}; ${String(init?.body)}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderGameplay(saved);

  expect(await screen.findByRole("heading", { name: "Supplier terms need a decision 2" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Director history" })).toBeInTheDocument();
  const proposalRequest = JSON.parse(String(fetchMock.mock.calls.find(([url]) => String(url).endsWith("/proposal"))?.[1]?.body)) as { turn_records: unknown[] };
  expect(proposalRequest.turn_records).toHaveLength(1);
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/ai/director/turn"))).toHaveLength(0);
});

test("preserves an existing valid save when backend rejects tampered v2 history", async () => {
  const record = turnResponseFor(signedProposalFor(gameStartFixture.state)).turn_record;
  const valid = createOneTurnDirectorSave(record);
  const tampered = {
    ...valid,
    turn_records: [{
      ...record,
      receipt: { ...record.receipt, signature: { ...record.receipt.signature, value: "B".repeat(43) } },
    }],
  } as SavedDirectorRun;
  localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(valid));
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) return Promise.resolve(jsonResponse(gameStartFixture));
    if (url.endsWith("/api/ai/director/replay")) return Promise.resolve(jsonResponse({ detail: { code: "invalid_director_signature", message: "Invalid Director signature." } }, 422));
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  const saveChange = renderGameplay(tampered);

  expect(await screen.findByText(/backend rejected the saved signed history/i)).toBeInTheDocument();
  expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe(JSON.stringify(valid));
  expect(saveChange).not.toHaveBeenCalled();
});

test("shows the terminal report from replay and uses theme tokens in dark mode", async () => {
  const terminalState = {
    ...gameStartFixture.state,
    current_turn: 12,
    status: "won" as const,
    decision_history: Array.from({ length: 12 }, (_, index) => ({
      action_id: `director-choice-turn-${index + 1}`,
      action_title: `Director choice ${index + 1}`,
      turn: index + 1,
      sequence: index + 1,
      event_id: null,
      metric_changes: [],
      resulting_status: index === 11 ? "won" as const : "active" as const,
      outcome_reason: index === 11 ? "survived-the-year" : "turn-completed",
    })),
  };
  const records = Array.from({ length: 12 }, (_, index) => {
    const state = { ...gameStartFixture.state, current_turn: index + 1 };
    const proposal = signedProposalFor(state, index + 1);
    return turnResponseFor(proposal, proposal.payload.choices[0]!.choice_id).turn_record;
  });
  const terminalSave: SavedDirectorRun = { ...directorHistoryFixture(records), format_version: 2 };
  const history = directorHistoryFixture(records);
  const latestResult = {
    ...turnResponseFor(records[11]!.proposal, records[11]!.selected_choice_id).turn_result,
    completed_turn_index: 12,
    resulting_status: "won" as const,
    outcome_reason: "survived-the-year",
    new_state: terminalState,
  };
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/games/start")) return Promise.resolve(jsonResponse(gameStartFixture));
    if (url.endsWith("/api/ai/director/replay")) return Promise.resolve(jsonResponse(directorReplayResponseFor(history, terminalState, records[11]!, latestResult)));
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
  document.documentElement.dataset.theme = "dark";
  renderGameplay(terminalSave);

  expect(await screen.findByRole("heading", { name: "Victory" })).toBeInTheDocument();
  expect(screen.getByText("Final report", { exact: true })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Confirm Director Choice" })).not.toBeInTheDocument();
  expect(document.querySelector(".bg-surface")).not.toBeNull();
  await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/ai/director/proposal"))).toHaveLength(0));
});
