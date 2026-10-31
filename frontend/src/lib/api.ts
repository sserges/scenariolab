export interface HealthResponse {
  status: "ok";
  service: "scenariolab-api";
}

export type ScenarioAvailability = "available" | "planned";
export type GameStatus = "not-started" | "active" | "won" | "lost";
export type FavorableDirection = "higher" | "lower" | "neutral";
export type DisplayStyle = "currency" | "number" | "percentage" | "score";

export interface ScenarioCatalogEntry {
  scenario_id: string;
  title: string;
  description: string;
  category: string;
  objective: string;
  availability: ScenarioAvailability;
  planned_key_metrics: string[];
}

export interface MetricFormat {
  style: DisplayStyle;
  decimals: number;
  currency_code: string | null;
  suffix: string | null;
}

export interface MetricDefinition {
  metric_id: string;
  title: string;
  description: string;
  kind: string;
  unit: string;
  format: MetricFormat;
  initial_value: number;
  min_value: number;
  max_value: number;
  capacity: number | null;
  critical_threshold: number | null;
  favorable_direction: FavorableDirection;
}

export interface TurnConfiguration {
  duration: number;
  unit: string;
  max_turns: number;
}

export interface ScenarioDefinition {
  scenario_id: string;
  schema_version: string;
  version: string;
  title: string;
  description: string;
  category: string;
  metadata: {
    objective: string;
    disclaimer: string;
  };
  turn: TurnConfiguration;
  metrics: Array<{ metric_id: string; title: string }>;
}

export interface ScenarioAction {
  action_id: string;
  title: string;
  description: string;
}

export interface MetricChange {
  metric_id: string;
  previous_value: number;
  new_value: number;
  delta: number;
  exhausted: boolean;
  attempted_value: number | null;
}

export interface DecisionRecord {
  action_id: string;
  action_title: string;
  turn: number;
  sequence: number;
  event_id: string | null;
  metric_changes: MetricChange[];
  resulting_status: GameStatus;
  outcome_reason: string;
}

export interface GameState {
  scenario_id: string;
  scenario_version: string;
  current_turn: number;
  max_turns: number;
  metric_values: Record<string, number>;
  status: GameStatus;
  decision_history: DecisionRecord[];
  seed: {
    seed: number;
    stream_version: string;
  };
}

export interface ScenarioEvent {
  event_id: string;
  title: string;
  description: string;
}

export interface TurnResult {
  previous_state: GameState;
  new_state: GameState;
  selected_action: ScenarioAction;
  triggered_event: ScenarioEvent | null;
  metric_changes: MetricChange[];
  completed_turn_index: number;
  resulting_status: GameStatus;
  outcome_reason: string;
}

export interface ScenarioDisplayMetadata {
  title: string;
  description: string;
  objective: string;
  turn: TurnConfiguration;
  metrics: MetricDefinition[];
}

export interface GameStartResponse {
  scenario_id: string;
  scenario_version: string;
  seed: number;
  state: GameState;
  available_actions: ScenarioAction[];
  scenario: ScenarioDisplayMetadata;
}

export interface GameTurnRequest {
  scenario_id: string;
  scenario_version: string;
  seed: number;
  action_history: string[];
  action_id: string;
}

export interface GameTurnResponse {
  scenario_id: string;
  scenario_version: string;
  seed: number;
  state: GameState;
  turn_result: TurnResult;
  available_actions: ScenarioAction[];
  action_history: string[];
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_API_BASE_URL = "http://localhost:8000";

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  return (configuredUrl || DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export async function getApiHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const body = await requestJson("/api/health", "GET", undefined, signal);
  if (!isHealthResponse(body)) {
    throw new Error("Health response did not match the expected contract");
  }
  return body;
}

export async function getScenarioCatalog(
  signal?: AbortSignal,
): Promise<ScenarioCatalogEntry[]> {
  const body = await requestJson("/api/scenarios", "GET", undefined, signal);
  if (!Array.isArray(body) || !body.every(isScenarioCatalogEntry)) {
    throw new Error("Scenario catalog did not match the expected contract");
  }
  return body;
}

export async function getScenarioDefinition(
  scenarioId: string,
  signal?: AbortSignal,
): Promise<ScenarioDefinition> {
  const body = await requestJson(
    `/api/scenarios/${encodeURIComponent(scenarioId)}`,
    "GET",
    undefined,
    signal,
  );
  if (!isScenarioDefinition(body)) {
    throw new Error("Scenario definition did not match the expected contract");
  }
  return body;
}

export async function startGame(
  scenarioId: string,
  seed?: number,
  signal?: AbortSignal,
): Promise<GameStartResponse> {
  const requestBody: { scenario_id: string; seed?: number } = {
    scenario_id: scenarioId,
  };
  if (seed !== undefined) {
    requestBody.seed = seed;
  }
  const body = await requestJson("/api/games/start", "POST", requestBody, signal);
  if (!isGameStartResponse(body)) {
    throw new Error("Game start response did not match the expected contract");
  }
  return body;
}

export async function playTurn(
  request: GameTurnRequest,
  signal?: AbortSignal,
): Promise<GameTurnResponse> {
  const body = await requestJson("/api/games/turn", "POST", request, signal);
  if (!isGameTurnResponse(body)) {
    throw new Error("Game turn response did not match the expected contract");
  }
  return body;
}

async function requestJson(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const init: RequestInit = {
    headers,
    method,
    signal: signal ?? null,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, init);
  const responseBody = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    if (isApiErrorBody(responseBody)) {
      throw new ApiError(
        responseBody.detail.code,
        responseBody.detail.message,
        response.status,
      );
    }
    throw new ApiError(
      "api_request_failed",
      `API request failed with status ${response.status}`,
      response.status,
    );
  }
  return responseBody;
}

function isHealthResponse(value: unknown): value is HealthResponse {
  if (!isRecord(value)) {
    return false;
  }
  return value.status === "ok" && value.service === "scenariolab-api";
}

function isScenarioCatalogEntry(value: unknown): value is ScenarioCatalogEntry {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.scenario_id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.category === "string" &&
    typeof value.objective === "string" &&
    (value.availability === "available" || value.availability === "planned") &&
    isStringArray(value.planned_key_metrics)
  );
}

function isScenarioDefinition(value: unknown): value is ScenarioDefinition {
  if (!isRecord(value) || !isRecord(value.metadata) || !isTurn(value.turn)) {
    return false;
  }
  return (
    typeof value.scenario_id === "string" &&
    typeof value.schema_version === "string" &&
    typeof value.version === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.category === "string" &&
    typeof value.metadata.objective === "string" &&
    typeof value.metadata.disclaimer === "string" &&
    Array.isArray(value.metrics) &&
    value.metrics.every(
      (metric) =>
        isRecord(metric) &&
        typeof metric.metric_id === "string" &&
        typeof metric.title === "string",
    )
  );
}

function isGameStartResponse(value: unknown): value is GameStartResponse {
  return (
    isRecord(value) &&
    typeof value.scenario_id === "string" &&
    typeof value.scenario_version === "string" &&
    isSeed(value.seed) &&
    isGameState(value.state) &&
    Array.isArray(value.available_actions) &&
    value.available_actions.every(isScenarioAction) &&
    isScenarioDisplayMetadata(value.scenario)
  );
}

function isGameTurnResponse(value: unknown): value is GameTurnResponse {
  return (
    isRecord(value) &&
    typeof value.scenario_id === "string" &&
    typeof value.scenario_version === "string" &&
    isSeed(value.seed) &&
    isGameState(value.state) &&
    isTurnResult(value.turn_result) &&
    Array.isArray(value.available_actions) &&
    value.available_actions.every(isScenarioAction) &&
    isStringArray(value.action_history)
  );
}

function isScenarioDisplayMetadata(value: unknown): value is ScenarioDisplayMetadata {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.objective === "string" &&
    isTurn(value.turn) &&
    Array.isArray(value.metrics) &&
    value.metrics.every(isMetricDefinition)
  );
}

function isTurn(value: unknown): value is TurnConfiguration {
  return (
    isRecord(value) &&
    isInteger(value.duration) &&
    typeof value.unit === "string" &&
    isInteger(value.max_turns)
  );
}

function isMetricDefinition(value: unknown): value is MetricDefinition {
  if (!isRecord(value) || !isRecord(value.format)) {
    return false;
  }
  return (
    typeof value.metric_id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.kind === "string" &&
    typeof value.unit === "string" &&
    isDisplayStyle(value.format.style) &&
    isInteger(value.format.decimals) &&
    isNullableString(value.format.currency_code) &&
    isNullableString(value.format.suffix) &&
    isInteger(value.initial_value) &&
    isInteger(value.min_value) &&
    isInteger(value.max_value) &&
    isNullableInteger(value.capacity) &&
    isNullableInteger(value.critical_threshold) &&
    isFavorableDirection(value.favorable_direction)
  );
}

function isScenarioAction(value: unknown): value is ScenarioAction {
  return (
    isRecord(value) &&
    typeof value.action_id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string"
  );
}

function isGameState(value: unknown): value is GameState {
  return (
    isRecord(value) &&
    typeof value.scenario_id === "string" &&
    typeof value.scenario_version === "string" &&
    isInteger(value.current_turn) &&
    isInteger(value.max_turns) &&
    isIntegerRecord(value.metric_values) &&
    isGameStatus(value.status) &&
    Array.isArray(value.decision_history) &&
    value.decision_history.every(isDecisionRecord) &&
    isRecord(value.seed) &&
    isSeed(value.seed.seed) &&
    typeof value.seed.stream_version === "string"
  );
}

function isDecisionRecord(value: unknown): value is DecisionRecord {
  return (
    isRecord(value) &&
    typeof value.action_id === "string" &&
    typeof value.action_title === "string" &&
    isInteger(value.turn) &&
    isInteger(value.sequence) &&
    isNullableString(value.event_id) &&
    Array.isArray(value.metric_changes) &&
    value.metric_changes.every(isMetricChange) &&
    isGameStatus(value.resulting_status) &&
    typeof value.outcome_reason === "string"
  );
}

function isTurnResult(value: unknown): value is TurnResult {
  return (
    isRecord(value) &&
    isGameState(value.previous_state) &&
    isGameState(value.new_state) &&
    isScenarioAction(value.selected_action) &&
    (value.triggered_event === null || isScenarioEvent(value.triggered_event)) &&
    Array.isArray(value.metric_changes) &&
    value.metric_changes.every(isMetricChange) &&
    isInteger(value.completed_turn_index) &&
    isGameStatus(value.resulting_status) &&
    typeof value.outcome_reason === "string"
  );
}

function isMetricChange(value: unknown): value is MetricChange {
  return (
    isRecord(value) &&
    typeof value.metric_id === "string" &&
    isInteger(value.previous_value) &&
    isInteger(value.new_value) &&
    isInteger(value.delta) &&
    typeof value.exhausted === "boolean" &&
    isNullableInteger(value.attempted_value)
  );
}

function isScenarioEvent(value: unknown): value is ScenarioEvent {
  return (
    isRecord(value) &&
    typeof value.event_id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string"
  );
}

function isApiErrorBody(
  value: unknown,
): value is { detail: { code: string; message: string } } {
  return (
    isRecord(value) &&
    isRecord(value.detail) &&
    typeof value.detail.code === "string" &&
    typeof value.detail.message === "string"
  );
}

function isGameStatus(value: unknown): value is GameStatus {
  return value === "not-started" || value === "active" || value === "won" || value === "lost";
}

function isDisplayStyle(value: unknown): value is DisplayStyle {
  return value === "currency" || value === "number" || value === "percentage" || value === "score";
}

function isFavorableDirection(value: unknown): value is FavorableDirection {
  return value === "higher" || value === "lower" || value === "neutral";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isSeed(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

function isIntegerRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isInteger);
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || isInteger(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
