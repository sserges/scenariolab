import { expect, test, vi } from "vitest";

import {
  SAVE_FORMAT_VERSION,
  SAVE_STORAGE_KEY,
  clearSavedRun,
  readSavedRun,
  writeSavedRun,
  type SavedRun,
  type StorageLike,
} from "./savedRun";

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => { values.delete(key); },
  };
}

const save: SavedRun = {
  format_version: SAVE_FORMAT_VERSION,
  scenario_id: "startup-survival",
  scenario_version: "1.0.0",
  seed: 42,
  action_history: ["reduce-operating-expenses"],
};

test("reads only a versioned replay identity and ordered action history", () => {
  const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(save) });

  expect(readSavedRun(storage)).toEqual({ status: "valid", save });
  expect(readSavedRun(memoryStorage())).toEqual({ status: "missing" });
});

test("rejects malformed, incompatible, and extra saved state", () => {
  expect(readSavedRun(memoryStorage({ [SAVE_STORAGE_KEY]: "{" }))).toEqual({ status: "invalid" });
  expect(readSavedRun(memoryStorage({
    [SAVE_STORAGE_KEY]: JSON.stringify({ ...save, format_version: 2 }),
  }))).toEqual({ status: "invalid" });
  expect(readSavedRun(memoryStorage({
    [SAVE_STORAGE_KEY]: JSON.stringify({ ...save, cash: 10_000 }),
  }))).toEqual({ status: "invalid" });
  expect(readSavedRun(memoryStorage({
    [SAVE_STORAGE_KEY]: JSON.stringify({ ...save, action_history: ["Reduce Expenses"] }),
  }))).toEqual({ status: "invalid" });
});

test("does not expose stored metrics and safely handles unavailable storage", () => {
  const storage = memoryStorage();
  expect(writeSavedRun(save, storage)).toBe("saved");
  const stored = storage.getItem(SAVE_STORAGE_KEY);
  expect(stored).not.toBeNull();
  expect(Object.keys(JSON.parse(stored as string)).sort()).toEqual([
    "action_history",
    "format_version",
    "scenario_id",
    "scenario_version",
    "seed",
  ]);
  expect(readSavedRun(null)).toEqual({ status: "unavailable" });
  expect(writeSavedRun(save, null)).toBe("unavailable");
  expect(clearSavedRun(null)).toBe(false);
});

test("storage failures preserve the existing valid save", () => {
  const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(save) });
  vi.spyOn(storage, "setItem").mockImplementation(() => {
    throw new DOMException("Storage is full", "QuotaExceededError");
  });

  expect(writeSavedRun({ ...save, action_history: [] }, storage)).toBe("unavailable");
  expect(readSavedRun(storage)).toEqual({ status: "valid", save });
});

test("clears a saved run only when storage accepts the removal", () => {
  const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(save) });
  expect(clearSavedRun(storage)).toBe(true);
  expect(readSavedRun(storage)).toEqual({ status: "missing" });
});
