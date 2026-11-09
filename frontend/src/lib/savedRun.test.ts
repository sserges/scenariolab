import { expect, test, vi } from "vitest";

import {
  DIRECTOR_SAVE_FORMAT_VERSION,
  SAVE_FORMAT_VERSION,
  SAVE_STORAGE_KEY,
  clearSavedRun,
  readSavedRun,
  writeSavedRun,
  type SavedRun,
  type StorageLike,
} from "./savedRun";
import type { SavedDirectorRun } from "./savedRun";
import { directorHistoryFixture, turnResponseFor, signedProposalFor } from "../test/directorFixtures";
import { gameStartFixture } from "../test/scenarioFixtures";

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

test("round-trips the strict v2 signed Director history envelope", () => {
  const record = turnResponseFor(signedProposalFor(gameStartFixture.state)).turn_record;
  const directorSave: SavedDirectorRun = {
    ...directorHistoryFixture([record]),
    format_version: DIRECTOR_SAVE_FORMAT_VERSION,
  };
  const storage = memoryStorage();

  expect(writeSavedRun(directorSave, storage)).toBe("saved");
  expect(readSavedRun(storage)).toEqual({ status: "valid", save: directorSave });
  const parsed = JSON.parse(storage.getItem(SAVE_STORAGE_KEY) ?? "null") as Record<string, unknown>;
  expect(Object.keys(parsed).sort()).toEqual([
    "format_version",
    "mode",
    "profile_id",
    "profile_version",
    "scenario_id",
    "scenario_version",
    "seed",
    "turn_records",
  ]);
});

test("persists a bounded pending signed proposal alongside v2 history", () => {
  const pending = signedProposalFor(gameStartFixture.state);
  const directorSave: SavedDirectorRun = {
    ...directorHistoryFixture(),
    format_version: DIRECTOR_SAVE_FORMAT_VERSION,
    pending_proposal: pending,
  };
  const storage = memoryStorage();

  expect(writeSavedRun(directorSave, storage)).toBe("saved");
  expect(readSavedRun(storage)).toEqual({ status: "valid", save: directorSave });
  expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY) ?? "null")).toHaveProperty("pending_proposal", pending);
  expect(writeSavedRun({ ...directorSave, pending_proposal: { ...pending, unexpected: true } } as never, storage)).toBe("invalid");
  expect(readSavedRun(storage)).toEqual({ status: "valid", save: directorSave });
});

test("rejects malformed or reordered v2 records without changing stored data", () => {
  const first = turnResponseFor(signedProposalFor(gameStartFixture.state)).turn_record;
  const directorSave: SavedDirectorRun = {
    ...directorHistoryFixture([first]),
    format_version: DIRECTOR_SAVE_FORMAT_VERSION,
  };
  const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(directorSave) });
  const reordered = {
    ...directorSave,
    turn_records: [{
      ...first,
      proposal: {
        ...first.proposal,
        payload: { ...first.proposal.payload, turn: 2 },
      },
    }],
  };

  expect(writeSavedRun(reordered, storage)).toBe("invalid");
  expect(readSavedRun(storage)).toEqual({ status: "valid", save: directorSave });
  expect(readSavedRun(memoryStorage({
    [SAVE_STORAGE_KEY]: JSON.stringify({ ...directorSave, mode: "classic" }),
  }))).toEqual({ status: "invalid" });
});
