import { expect, test } from "vitest";

import { describeTurnLength, turnLabel } from "./turns";

test("keeps time-based turn summaries and labels unchanged", () => {
  expect(describeTurnLength({ duration: 1, unit: "month", max_turns: 12 })).toBe("12 month-long turns");
  expect(turnLabel("month")).toBe("Month");
});

test("uses scenario vocabulary for non-time turn units", () => {
  expect(describeTurnLength({ duration: 1, unit: "round", max_turns: 12 })).toBe("12 decision rounds");
  expect(describeTurnLength({ duration: 1, unit: "cycle", max_turns: 1 })).toBe("1 decision cycle");
  expect(turnLabel("cycle")).toBe("Cycle");
});
