import type { TurnConfiguration } from "./api";

const TIME_UNITS = new Set(["day", "week", "month", "year"]);

/** Display label for one turn, e.g. "Month", "Round", or "Cycle". */
export function turnLabel(unit: string): string {
  return unit.charAt(0).toUpperCase() + unit.slice(1).replaceAll("-", " ");
}

/** Catalog summary of a scenario's length using its own turn vocabulary. */
export function describeTurnLength(turn: TurnConfiguration): string {
  if (TIME_UNITS.has(turn.unit)) {
    return `${turn.max_turns} ${turn.unit}-long turns`;
  }
  const plural = turn.max_turns === 1 ? turn.unit : `${turn.unit}s`;
  return `${turn.max_turns} decision ${plural}`;
}
