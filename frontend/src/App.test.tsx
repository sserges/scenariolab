import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { App } from "./App";
import {
  gameStartFixture,
  gameTurnFixture,
  scenarioCatalogFixture,
  startupDefinitionFixture,
  liveBriefingFixture,
} from "./test/scenarioFixtures";
import { SAVE_STORAGE_KEY } from "./lib/savedRun";
import { THEME_STORAGE_KEY } from "./lib/theme";

test("renders the application title", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const body = String(input).endsWith("/api/health")
        ? { status: "ok", service: "scenariolab-api" }
        : scenarioCatalogFixture;
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200 }),
      );
    }),
  );

  render(<App />);

  expect(
    screen.getByRole("heading", { level: 1, name: "ScenarioLab" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Make decisions. Explore consequences."),
  ).toBeInTheDocument();
});

test("opens Startup Survival from the catalog and starts browser gameplay", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      let body: unknown;
      if (url.endsWith("/api/health")) {
        body = { status: "ok", service: "scenariolab-api" };
      } else if (url.endsWith("/api/scenarios/startup-survival")) {
        body = startupDefinitionFixture;
      } else if (url.endsWith("/api/scenarios")) {
        body = scenarioCatalogFixture;
      } else if (url.endsWith("/api/games/start")) {
        body = gameStartFixture;
      } else {
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      }
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200 }),
      );
    }),
  );

  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "View Details" }));
  fireEvent.click(await screen.findByRole("button", { name: "Open Simulation" }));
  fireEvent.click(screen.getByRole("button", { name: /Choose Classic Simulation/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start New Game" }));

  expect(await screen.findByText("Key metrics")).toBeInTheDocument();
  expect(screen.getByText("$150,000")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirm Decision" })).toBeDisabled();
});

test("switches themes during gameplay without resetting simulation progress", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      let body: unknown;
      if (url.endsWith("/api/health")) body = { status: "ok", service: "scenariolab-api" };
      else if (url.endsWith("/api/scenarios/startup-survival")) body = startupDefinitionFixture;
      else if (url.endsWith("/api/scenarios")) body = scenarioCatalogFixture;
      else if (url.endsWith("/api/games/start")) body = gameStartFixture;
      else if (url.endsWith("/api/games/turn")) body = gameTurnFixture;
      else if (url.endsWith("/api/ai/briefing")) body = liveBriefingFixture;
      else return Promise.reject(new Error(`Unexpected request: ${url}`));
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }),
  );

  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "View Details" }));
  fireEvent.click(await screen.findByRole("button", { name: "Open Simulation" }));
  fireEvent.click(screen.getByRole("button", { name: /Choose Classic Simulation/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start New Game" }));
  await screen.findByText("Key metrics");

  fireEvent.click(screen.getByRole("radio", { name: /Reduce Operating Expenses/ }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm Decision" }));
  await screen.findByText("Month 1 resolved");
  const savedProgress = localStorage.getItem(SAVE_STORAGE_KEY);
  expect(savedProgress).not.toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Switch to Dark Mode" }));

  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  expect(screen.getByText("Month 2 of 12")).toBeInTheDocument();
  expect(screen.getByLabelText("Cash: $127,500")).toBeInTheDocument();
  expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBe(savedProgress);
});

test("theme switching remains available for the session when localStorage is blocked", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(scenarioCatalogFixture), { status: 200 }),
    ),
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage unavailable", "SecurityError");
  });

  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Switch to Dark Mode" }));

  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(screen.getByRole("button", { name: "Switch to Classic Mode" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
