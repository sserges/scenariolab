import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { ApiStatus } from "./ApiStatus";

test("shows a loading state before reporting a successful connection", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: "ok", service: "scenariolab-api" }),
        { status: 200 },
      ),
    ),
  );

  render(<ApiStatus />);

  expect(screen.getByText("Checking API")).toBeInTheDocument();
  expect(await screen.findByText("API Connected")).toBeInTheDocument();
});

test("reports when the API is unavailable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

  render(<ApiStatus />);

  expect(await screen.findByText("API Unavailable")).toBeInTheDocument();
});
