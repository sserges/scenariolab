import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { App } from "./App";
import {
  gameStartFixture,
  scenarioCatalogFixture,
  startupDefinitionFixture,
} from "./test/scenarioFixtures";

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
  fireEvent.click(screen.getByRole("button", { name: "Start Simulation" }));

  expect(await screen.findByText("Company metrics")).toBeInTheDocument();
  expect(screen.getByText("$150,000")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirm Decision" })).toBeDisabled();
});
