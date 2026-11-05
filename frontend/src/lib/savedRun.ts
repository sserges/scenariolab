export const SAVE_FORMAT_VERSION = 1;
export const SAVE_STORAGE_KEY = "scenariolab.saved-run";
const MAX_SAVED_ACTIONS = 10_000;
const MAX_SAVE_CHARACTERS = 1_000_000;

export interface SavedRun {
  format_version: typeof SAVE_FORMAT_VERSION;
  scenario_id: string;
  scenario_version: string;
  seed: number;
  action_history: string[];
}

export type SaveReadResult =
  | { status: "missing" }
  | { status: "valid"; save: SavedRun }
  | { status: "invalid" }
  | { status: "unavailable" };

export type SaveWriteResult = "saved" | "invalid" | "unavailable";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readSavedRun(storage?: StorageLike | null): SaveReadResult {
  const resolvedStorage = resolveStorage(storage);
  if (resolvedStorage === null) {
    return { status: "unavailable" };
  }

  try {
    const serialized = resolvedStorage.getItem(SAVE_STORAGE_KEY);
    if (serialized === null) {
      return { status: "missing" };
    }
    if (serialized.length > MAX_SAVE_CHARACTERS) {
      return { status: "invalid" };
    }
    let value: unknown;
    try {
      value = JSON.parse(serialized);
    } catch {
      return { status: "invalid" };
    }
    return isSavedRun(value) ? { status: "valid", save: value } : { status: "invalid" };
  } catch {
    return { status: "unavailable" };
  }
}

export function writeSavedRun(
  save: SavedRun,
  storage?: StorageLike | null,
): SaveWriteResult {
  const resolvedStorage = resolveStorage(storage);
  if (resolvedStorage === null) {
    return "unavailable";
  }
  if (!isSavedRun(save)) {
    return "invalid";
  }

  try {
    resolvedStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
    return "saved";
  } catch {
    return "unavailable";
  }
}

export function clearSavedRun(storage?: StorageLike | null): boolean {
  const resolvedStorage = resolveStorage(storage);
  if (resolvedStorage === null) {
    return false;
  }
  try {
    resolvedStorage.removeItem(SAVE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function isSavedRun(value: unknown): value is SavedRun {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    "action_history",
    "format_version",
    "scenario_id",
    "scenario_version",
    "seed",
  ];
  return (
    keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]) &&
    value.format_version === SAVE_FORMAT_VERSION &&
    isStableId(value.scenario_id) &&
    typeof value.scenario_version === "string" &&
    value.scenario_version.length <= 32 &&
    /^\d+\.\d+\.\d+$/.test(value.scenario_version) &&
    isSeed(value.seed) &&
    Array.isArray(value.action_history) &&
    value.action_history.length <= MAX_SAVED_ACTIONS &&
    value.action_history.every(isStableId)
  );
}

function resolveStorage(storage: StorageLike | null | undefined): StorageLike | null {
  if (storage !== undefined) {
    return storage;
  }
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isStableId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)
  );
}

function isSeed(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
