import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import {
  scenarioCatalogFixture,
  startupDefinitionFixture,
} from "../test/scenarioFixtures";
import { ScenarioCatalog } from "./ScenarioCatalog";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

test("renders all three scenarios with available and planned statuses", async () => {
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
    vi.fn().mockResolvedValue(jsonResponse(scenarioCatalogFixture)),
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
  fireEvent.click(await screen.findByRole("button", { name: /View Details/i }));

  expect(await screen.findByText("Definition validated")).toBeInTheDocument();
  expect(screen.getByText("Gameplay begins in a later brick.")).toBeInTheDocument();
});
