import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { App } from "./App";

test("renders the application title", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: "ok", service: "scenariolab-api" }),
        { status: 200 },
      ),
    ),
  );

  render(<App />);

  expect(
    screen.getByRole("heading", { level: 1, name: "ScenarioLab" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Make decisions. Explore consequences."),
  ).toBeInTheDocument();
});
