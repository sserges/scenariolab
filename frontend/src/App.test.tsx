import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { App } from "./App";
import { scenarioCatalogFixture } from "./test/scenarioFixtures";

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
