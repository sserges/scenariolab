import { isDirectorTurnRecord, isSignedDirectorProposal, type DirectorReplayHistory, type SignedDirectorProposal } from "./api";

export const SAVE_FORMAT_VERSION = 1;
export const DIRECTOR_SAVE_FORMAT_VERSION = 2;
export const SAVE_STORAGE_KEY = "scenariolab.saved-run";
const MAX_SAVED_ACTIONS = 10_000;
const MAX_SAVE_CHARACTERS = 1_000_000;
const MAX_DIRECTOR_SAVE_BYTES = 56_000;

export interface SavedScriptedRun {
  format_version: typeof SAVE_FORMAT_VERSION;
  scenario_id: string;
  scenario_version: string;
  seed: number;
  action_history: string[];
}

export interface SavedDirectorRun extends DirectorReplayHistory {
  format_version: typeof DIRECTOR_SAVE_FORMAT_VERSION;
  mode: "director";
  pending_proposal?: SignedDirectorProposal;
}

export type SavedRun = SavedScriptedRun | SavedDirectorRun;

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
  if (value.format_version === DIRECTOR_SAVE_FORMAT_VERSION) {
    return isSavedDirectorRun(value);
  }
  return isSavedScriptedRun(value);
}

export function isSavedDirectorRun(value: unknown): value is SavedDirectorRun {
  if (!isRecord(value)) {
    return false;
  }
  const keys = Object.keys(value).sort();
  const requiredKeys = [
    "format_version",
    "mode",
    "profile_id",
    "profile_version",
    "scenario_id",
    "scenario_version",
    "seed",
    "turn_records",
  ];
  const hasPendingProposal = Object.hasOwn(value, "pending_proposal");
  const keysMatch = keys.length === requiredKeys.length + (hasPendingProposal ? 1 : 0) &&
    requiredKeys.every((key) => keys.includes(key)) &&
    (!hasPendingProposal || keys.includes("pending_proposal"));
  return (
    keysMatch &&
    value.format_version === DIRECTOR_SAVE_FORMAT_VERSION &&
    value.mode === "director" &&
    isStableId(value.scenario_id) &&
    isVersion(value.scenario_version) &&
    isSeed(value.seed) &&
    isStableId(value.profile_id) &&
    isVersion(value.profile_version) &&
    Array.isArray(value.turn_records) &&
    value.turn_records.length <= 12 &&
    value.turn_records.every((record, index) =>
      isDirectorTurnRecord(record) &&
      record.proposal.payload.turn === index + 1 &&
      record.receipt.payload.turn === index + 1 &&
      record.proposal.payload.scenario_id === value.scenario_id &&
      record.proposal.payload.scenario_version === value.scenario_version &&
      record.proposal.payload.seed === value.seed &&
      record.proposal.payload.profile_id === value.profile_id &&
      record.proposal.payload.profile_version === value.profile_version &&
      record.receipt.payload.scenario_id === value.scenario_id &&
      record.receipt.payload.scenario_version === value.scenario_version &&
      record.receipt.payload.seed === value.seed &&
      record.receipt.payload.profile_id === value.profile_id &&
      record.receipt.payload.profile_version === value.profile_version
    ) &&
    (!hasPendingProposal || isSignedDirectorProposal(value.pending_proposal)) &&
    byteLength(value) <= MAX_DIRECTOR_SAVE_BYTES
  );
}

function isSavedScriptedRun(value: unknown): value is SavedScriptedRun {
  if (!isRecord(value)) return false;
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
    isVersion(value.scenario_version) &&
    isSeed(value.seed) &&
    Array.isArray(value.action_history) &&
    value.action_history.length <= MAX_SAVED_ACTIONS &&
    value.action_history.every(isStableId)
  );
}

function isVersion(value: unknown): value is string {
  return typeof value === "string" && value.length <= 32 && /^\d+\.\d+\.\d+$/.test(value);
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

function byteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
