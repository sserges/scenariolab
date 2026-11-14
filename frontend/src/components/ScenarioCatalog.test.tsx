import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import {
  plannedCatalogFixture,
  scenarioCatalogFixture,
  startupDefinitionFixture,
} from "../test/scenarioFixtures";
import { SAVE_FORMAT_VERSION, type SavedRun } from "../lib/savedRun";
import { ScenarioCatalog } from "./ScenarioCatalog";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

test("renders all three scenarios as available and playable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(jsonResponse(scenarioCatalogFixture)),
  );

  render(<ScenarioCatalog />);

  expect(
    await screen.findByRole("heading", { name: "Startup Survival" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Cybersecurity Crisis" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Space Colony" })).toBeInTheDocument();
  expect(screen.getAllByText("Available")).toHaveLength(3);
  expect(screen.queryByText("Coming Soon")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "View Details" })).toHaveLength(3);
});

test("still renders planned entries as Coming Soon when the catalog marks them planned", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(jsonResponse(plannedCatalogFixture)),
  );

  render(<ScenarioCatalog />);

  await screen.findByRole("heading", { name: "Startup Survival" });
  expect(screen.getByText("Available")).toBeInTheDocument();
  expect(screen.getAllByText("Coming Soon")).toHaveLength(4);
});

test("shows the catalog loading state", () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));

  render(<ScenarioCatalog />);

  expect(screen.getByText("Loading scenarios…")).toBeInTheDocument();
});

test("shows an API failure state", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

  render(<ScenarioCatalog />);

  expect(await screen.findByText("Scenario catalog unavailable")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Try Again" })).toBeEnabled();
});

test("planned scenarios cannot launch gameplay", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(jsonResponse(plannedCatalogFixture)),
  );

  render(<ScenarioCatalog />);
  await screen.findByRole("heading", { name: "Startup Survival" });

  for (const scenarioId of ["cybersecurity-crisis", "space-colony"]) {
    const card = document.querySelector(`[data-scenario-id="${scenarioId}"]`);
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByRole("button")).toBeDisabled();
  }
  expect(screen.queryByRole("button", { name: /play/i })).not.toBeInTheDocument();
});

test("loads the available Startup Survival definition without starting gameplay", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scenarioCatalogFixture))
      .mockResolvedValueOnce(jsonResponse(startupDefinitionFixture)),
  );

  render(<ScenarioCatalog />);
  const startupCard = (await screen.findByRole("heading", { name: "Startup Survival" })).closest("article");
  fireEvent.click(within(startupCard as HTMLElement).getByRole("button", { name: /View Details/i }));

  expect(await screen.findByText("Definition validated")).toBeInTheDocument();
  expect(screen.getByText("12 month-long turns · 7 tracked metrics")).toBeInTheDocument();
  expect(screen.getByText("Ready for deterministic browser play.")).toBeInTheDocument();
});

test("offers saved progress and opens it only after current definition validation", async () => {
  const savedRun: SavedRun = {
    format_version: SAVE_FORMAT_VERSION,
    scenario_id: "startup-survival",
    scenario_version: "1.0.0",
    seed: 42,
    action_history: ["reduce-operating-expenses"],
  };
  const onOpenScenario = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scenarioCatalogFixture))
      .mockResolvedValueOnce(jsonResponse(startupDefinitionFixture)),
  );

  render(
    <ScenarioCatalog
      onOpenScenario={onOpenScenario}
      saveState={{ status: "valid", save: savedRun }}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Continue Saved Game" }));

  await waitFor(() => {
    expect(onOpenScenario).toHaveBeenCalledWith(
      scenarioCatalogFixture[0],
      startupDefinitionFixture,
      savedRun,
    );
  });
});

test("keeps incompatible saves and offers an explicit new game path", async () => {
  const savedRun: SavedRun = {
    format_version: SAVE_FORMAT_VERSION,
    scenario_id: "startup-survival",
    scenario_version: "0.9.0",
    seed: 42,
    action_history: [],
  };
  const onOpenScenario = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(scenarioCatalogFixture))
      .mockResolvedValueOnce(jsonResponse(startupDefinitionFixture)),
  );
  render(
    <ScenarioCatalog
      onOpenScenario={onOpenScenario}
      saveState={{ status: "valid", save: savedRun }}
    />,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Continue Saved Game" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/incompatible/i);
  expect(onOpenScenario).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "New Game" })).toBeEnabled();
});
