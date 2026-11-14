export interface HealthResponse {
  status: "ok";
  service: "scenariolab-api";
}

export type ScenarioAvailability = "available" | "planned";
export type GameStatus = "not-started" | "active" | "won" | "lost";
export type FavorableDirection = "higher" | "lower" | "neutral";
export type DisplayStyle = "currency" | "number" | "percentage" | "score";
export type ScenarioAIFeature = "scenario-director" | "live-briefings";

export interface ScenarioCatalogEntry {
  scenario_id: string;
  title: string;
  description: string;
  category: string;
  objective: string;
  availability: ScenarioAvailability;
  planned_key_metrics: string[];
  /** Optional AI capabilities the backend catalog explicitly opts this scenario into. */
  ai_features?: string[];
}

export function hasAIFeature(entry: ScenarioCatalogEntry, feature: ScenarioAIFeature): boolean {
  return entry.ai_features?.includes(feature) ?? false;
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
  initial_state: Record<string, number>;
  turn: TurnConfiguration;
  metrics: MetricDefinition[];
  events: ScenarioEvent[];
  win_conditions: OutcomeConditionSummary[];
  loss_conditions: OutcomeConditionSummary[];
}

export interface OutcomeConditionSummary {
  condition_id: string;
  title: string;
  description: string;
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

export interface AIBriefingRequest {
  scenario_id: string;
  scenario_version: string;
  seed: number;
  action_history: string[];
}

export interface AIBriefingResponse {
  source: "live" | "fallback";
  headline: string;
  situation_summary: string;
  consequence_explanation: string;
  strategic_insight: string;
  next_turn_teaser: string;
}

export interface DirectorEffect {
  metric_id: string;
  operator: "add" | "subtract";
  value: number;
}

export interface DirectorChoice {
  choice_id: string;
  title: string;
  description: string;
  effects: DirectorEffect[];
}

export interface DirectorSituation {
  situation_id: string;
  beat_id: "acquisition" | "supplier" | "retention" | "partnership";
  headline: string;
  description: string;
}

export interface DirectorContextSnapshot {
  context_version: "1";
  scenario_id: string;
  scenario_version: string;
  profile_id: string;
  profile_version: string;
  seed: number;
  turn: number;
  metric_values: Record<string, number>;
  recent_action_ids: string[];
  recent_event_ids: string[];
  recent_beats: DirectorSituation["beat_id"][];
  recent_headline_digests: string[];
}

export interface DirectorProposalPayload {
  record_format_version: 1;
  context_version: "1";
  profile_id: string;
  profile_version: string;
  scenario_id: string;
  scenario_version: string;
  seed: number;
  turn: number;
  previous_state_digest: string;
  previous_history_digest: string;
  context_digest: string;
  context_snapshot: DirectorContextSnapshot;
  source: "live" | "fallback";
  situation: DirectorSituation;
  choices: DirectorChoice[];
}

export interface HMACSignature {
  algorithm: "HMAC-SHA256";
  key_id: string;
  value: string;
}

export interface SignedDirectorProposal {
  payload: DirectorProposalPayload;
  signature: HMACSignature;
}

export interface DirectorChoicePreview {
  choice_id: string;
  metric_changes: MetricChange[];
  projected_status: GameStatus;
  outcome_reason: string;
  scripted_event_id: string | null;
  scripted_event_title: string | null;
}

export interface DirectorReceiptPayload {
  record_format_version: 1;
  profile_id: string;
  profile_version: string;
  scenario_id: string;
  scenario_version: string;
  seed: number;
  turn: number;
  previous_state_digest: string;
  previous_history_digest: string;
  proposal_digest: string;
  selected_choice_id: string;
  resulting_state_digest: string;
  result_digest: string;
}

export interface SignedDirectorReceipt {
  payload: DirectorReceiptPayload;
  signature: HMACSignature;
}

export interface DirectorTurnRecord {
  proposal: SignedDirectorProposal;
  selected_choice_id: string;
  receipt: SignedDirectorReceipt;
}

export interface DirectorReplayHistory {
  format_version: 2;
  mode: "director";
  scenario_id: string;
  scenario_version: string;
  seed: number;
  profile_id: string;
  profile_version: string;
  turn_records: DirectorTurnRecord[];
}

export interface DirectorReplayRequest extends DirectorReplayHistory {
  pending_proposal?: SignedDirectorProposal | null;
}

export interface DirectorChoicePreviewResponse {
  choice_id: string;
  metric_changes: MetricChange[];
  projected_status: GameStatus;
  outcome_reason: string;
  scripted_event_id: string | null;
  scripted_event_title: string | null;
}

export interface DirectorProposalResponse {
  scenario_id: string;
  scenario_version: string;
  seed: number;
  state: GameState;
  proposal: SignedDirectorProposal;
  previews: DirectorChoicePreviewResponse[];
}

export interface DirectorReplayResponse {
  scenario_id: string;
  scenario_version: string;
  seed: number;
  state: GameState;
  latest_turn_record: DirectorTurnRecord | null;
  latest_turn_result: TurnResult | null;
  pending_proposal?: SignedDirectorProposal | null;
  pending_previews?: DirectorChoicePreviewResponse[];
}

export interface DirectorTurnResponse {
  scenario_id: string;
  scenario_version: string;
  seed: number;
  state: GameState;
  turn_result: TurnResult;
  turn_record: DirectorTurnRecord;
}

export interface DirectorTurnRequest extends DirectorReplayHistory {
  proposal: SignedDirectorProposal;
  selected_choice_id: string;
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

export async function getAIBriefing(
  request: AIBriefingRequest,
  signal?: AbortSignal,
): Promise<AIBriefingResponse> {
  const body = await requestJson("/api/ai/briefing", "POST", request, signal);
  if (!isAIBriefingResponse(body)) {
    throw new Error("AI briefing response did not match the expected contract");
  }
  return body;
}

export async function getDirectorProposal(
  request: DirectorReplayHistory,
  signal?: AbortSignal,
): Promise<DirectorProposalResponse> {
  const body = await requestJson("/api/ai/director/proposal", "POST", request, signal);
  if (!isDirectorProposalResponse(body)) {
    throw new Error("Director proposal response did not match the expected contract");
  }
  return body;
}

export async function playDirectorTurn(
  request: DirectorTurnRequest,
  signal?: AbortSignal,
): Promise<DirectorTurnResponse> {
  const body = await requestJson("/api/ai/director/turn", "POST", request, signal);
  if (!isDirectorTurnResponse(body)) {
    throw new Error("Director turn response did not match the expected contract");
  }
  return body;
}

export async function replayDirectorRun(
  request: DirectorReplayRequest,
  signal?: AbortSignal,
): Promise<DirectorReplayResponse> {
  const body = await requestJson("/api/ai/director/replay", "POST", request, signal);
  if (!isDirectorReplayResponse(body)) {
    throw new Error("Director replay response did not match the expected contract");
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
    isStringArray(value.planned_key_metrics) &&
    (value.ai_features === undefined || isStringArray(value.ai_features))
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
    isIntegerRecord(value.initial_state) &&
    Array.isArray(value.metrics) &&
    value.metrics.every(isMetricDefinition) &&
    Array.isArray(value.events) &&
    value.events.every(isScenarioEvent) &&
    Array.isArray(value.win_conditions) &&
    value.win_conditions.every(isOutcomeConditionSummary) &&
    Array.isArray(value.loss_conditions) &&
    value.loss_conditions.every(isOutcomeConditionSummary)
  );
}

function isOutcomeConditionSummary(value: unknown): value is OutcomeConditionSummary {
  return (
    isRecord(value) &&
    typeof value.condition_id === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string"
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

function isAIBriefingResponse(value: unknown): value is AIBriefingResponse {
  return (
    isRecord(value) &&
    (value.source === "live" || value.source === "fallback") &&
    isBriefingText(value.headline, 140) &&
    isBriefingText(value.situation_summary, 500) &&
    isBriefingText(value.consequence_explanation, 500) &&
    isBriefingText(value.strategic_insight, 500) &&
    isBriefingText(value.next_turn_teaser, 240)
  );
}

function isDirectorProposalResponse(value: unknown): value is DirectorProposalResponse {
  return (
    isRecord(value) &&
    typeof value.scenario_id === "string" &&
    typeof value.scenario_version === "string" &&
    isSeed(value.seed) &&
    isGameState(value.state) &&
    isSignedDirectorProposal(value.proposal) &&
    Array.isArray(value.previews) &&
    value.previews.every(isDirectorChoicePreview)
  );
}

function isDirectorReplayResponse(value: unknown): value is DirectorReplayResponse {
  return (
    isRecord(value) &&
    typeof value.scenario_id === "string" &&
    typeof value.scenario_version === "string" &&
    isSeed(value.seed) &&
    isGameState(value.state) &&
    (value.latest_turn_record === null || isDirectorTurnRecord(value.latest_turn_record)) &&
    (value.latest_turn_result === null || isTurnResult(value.latest_turn_result)) &&
    (value.pending_proposal === undefined || value.pending_proposal === null || isSignedDirectorProposal(value.pending_proposal)) &&
    (value.pending_previews === undefined || (Array.isArray(value.pending_previews) && value.pending_previews.every(isDirectorChoicePreview)))
  );
}

function isDirectorTurnResponse(value: unknown): value is DirectorTurnResponse {
  return (
    isRecord(value) &&
    typeof value.scenario_id === "string" &&
    typeof value.scenario_version === "string" &&
    isSeed(value.seed) &&
    isGameState(value.state) &&
    isTurnResult(value.turn_result) &&
    isDirectorTurnRecord(value.turn_record)
  );
}

export function isSignedDirectorProposal(value: unknown): value is SignedDirectorProposal {
  if (!hasExactKeys(value, ["payload", "signature"]) || !isRecord(value.payload) || !isSignature(value.signature)) {
    return false;
  }
  const payload = value.payload;
  return (
    hasExactKeys(payload, [
      "record_format_version", "context_version", "profile_id", "profile_version", "scenario_id",
      "scenario_version", "seed", "turn", "previous_state_digest", "previous_history_digest",
      "context_digest", "context_snapshot", "source", "situation", "choices",
    ]) &&
    payload.record_format_version === 1 &&
    payload.context_version === "1" &&
    typeof payload.profile_id === "string" &&
    typeof payload.profile_version === "string" &&
    typeof payload.scenario_id === "string" &&
    typeof payload.scenario_version === "string" &&
    isSeed(payload.seed) &&
    isInteger(payload.turn) &&
    isDigest(payload.previous_state_digest) &&
    isDigest(payload.previous_history_digest) &&
    isDigest(payload.context_digest) &&
    isDirectorContext(payload.context_snapshot) &&
    (payload.source === "fallback" || payload.source === "live") &&
    isDirectorSituation(payload.situation) &&
    Array.isArray(payload.choices) &&
    payload.choices.length >= 2 && payload.choices.length <= 4 &&
    payload.choices.every(isDirectorChoice) &&
    new Set(payload.choices.map((choice) => choice.choice_id)).size === payload.choices.length &&
    payload.context_snapshot.scenario_id === payload.scenario_id &&
    payload.context_snapshot.scenario_version === payload.scenario_version &&
    payload.context_snapshot.profile_id === payload.profile_id &&
    payload.context_snapshot.profile_version === payload.profile_version &&
    payload.context_snapshot.seed === payload.seed &&
    payload.context_snapshot.turn === payload.turn
  );
}

export function isDirectorTurnRecord(value: unknown): value is DirectorTurnRecord {
  return (
    hasExactKeys(value, ["proposal", "selected_choice_id", "receipt"]) &&
    isSignedDirectorProposal(value.proposal) &&
    typeof value.selected_choice_id === "string" &&
    isRecord(value.receipt) &&
    hasExactKeys(value.receipt, ["payload", "signature"]) &&
    isRecord(value.receipt.payload) &&
    hasExactKeys(value.receipt.payload, [
      "record_format_version", "profile_id", "profile_version", "scenario_id", "scenario_version", "seed",
      "turn", "previous_state_digest", "previous_history_digest", "proposal_digest", "selected_choice_id",
      "resulting_state_digest", "result_digest",
    ]) &&
    value.receipt.payload.record_format_version === 1 &&
    typeof value.receipt.payload.profile_id === "string" &&
    typeof value.receipt.payload.profile_version === "string" &&
    typeof value.receipt.payload.scenario_id === "string" &&
    typeof value.receipt.payload.scenario_version === "string" &&
    isSeed(value.receipt.payload.seed) &&
    isInteger(value.receipt.payload.turn) &&
    isDigest(value.receipt.payload.previous_state_digest) &&
    isDigest(value.receipt.payload.previous_history_digest) &&
    isDigest(value.receipt.payload.proposal_digest) &&
    isDigest(value.receipt.payload.resulting_state_digest) &&
    isDigest(value.receipt.payload.result_digest) &&
    isSignature(value.receipt.signature) &&
    value.receipt.payload.selected_choice_id === value.selected_choice_id &&
    value.receipt.payload.profile_id === value.proposal.payload.profile_id &&
    value.receipt.payload.profile_version === value.proposal.payload.profile_version &&
    value.receipt.payload.scenario_id === value.proposal.payload.scenario_id &&
    value.receipt.payload.scenario_version === value.proposal.payload.scenario_version &&
    value.receipt.payload.seed === value.proposal.payload.seed &&
    value.receipt.payload.turn === value.proposal.payload.turn &&
    value.receipt.signature.key_id === value.proposal.signature.key_id &&
    value.proposal.payload.choices.some((choice) => choice.choice_id === value.selected_choice_id)
  );
}

function isDirectorChoicePreview(value: unknown): value is DirectorChoicePreviewResponse {
  return (
    hasExactKeys(value, ["choice_id", "metric_changes", "projected_status", "outcome_reason", "scripted_event_id", "scripted_event_title"]) &&
    typeof value.choice_id === "string" &&
    Array.isArray(value.metric_changes) &&
    value.metric_changes.every(isMetricChange) &&
    isGameStatus(value.projected_status) &&
    typeof value.outcome_reason === "string" &&
    isNullableString(value.scripted_event_id) &&
    isNullableString(value.scripted_event_title)
  );
}

function isSignature(value: unknown): value is HMACSignature {
  return (
    hasExactKeys(value, ["algorithm", "key_id", "value"]) &&
    value.algorithm === "HMAC-SHA256" &&
    isStableIdentifier(value.key_id) &&
    typeof value.value === "string" &&
    /^[A-Za-z0-9_-]{43}$/.test(value.value)
  );
}

function isDirectorContext(value: unknown): value is DirectorContextSnapshot {
  return (
    hasExactKeys(value, [
      "context_version", "scenario_id", "scenario_version", "profile_id", "profile_version", "seed", "turn",
      "metric_values", "recent_action_ids", "recent_event_ids", "recent_beats", "recent_headline_digests",
    ]) &&
    value.context_version === "1" &&
    typeof value.scenario_id === "string" &&
    typeof value.scenario_version === "string" &&
    typeof value.profile_id === "string" &&
    typeof value.profile_version === "string" &&
    isSeed(value.seed) &&
    isInteger(value.turn) &&
    isIntegerRecord(value.metric_values) &&
    isStringArray(value.recent_action_ids) &&
    value.recent_action_ids.length <= 3 &&
    isStringArray(value.recent_event_ids) &&
    value.recent_event_ids.length <= 3 &&
    Array.isArray(value.recent_beats) &&
    value.recent_beats.length <= 3 &&
    value.recent_beats.every(isDirectorBeat) &&
    Array.isArray(value.recent_headline_digests) &&
    value.recent_headline_digests.length <= 12 &&
    value.recent_headline_digests.every(isDigest)
  );
}

function isDirectorSituation(value: unknown): value is DirectorSituation {
  return (
    hasExactKeys(value, ["situation_id", "beat_id", "headline", "description"]) &&
    isStableIdentifier(value.situation_id) &&
    isDirectorBeat(value.beat_id) &&
    isBriefingText(value.headline, 100) &&
    isBriefingText(value.description, 200)
  );
}

function isDirectorBeat(value: unknown): value is DirectorSituation["beat_id"] {
  return value === "acquisition" || value === "supplier" || value === "retention" || value === "partnership";
}

function isDirectorChoice(value: unknown): value is DirectorChoice {
  return (
    hasExactKeys(value, ["choice_id", "title", "description", "effects"]) &&
    isStableIdentifier(value.choice_id) &&
    isBriefingText(value.title, 64) &&
    isBriefingText(value.description, 120) &&
    Array.isArray(value.effects) &&
    value.effects.length >= 1 && value.effects.length <= 3 &&
    value.effects.every((effect) => hasExactKeys(effect, ["metric_id", "operator", "value"]) && isStableIdentifier(effect.metric_id) &&
      (effect.operator === "add" || effect.operator === "subtract") && isInteger(effect.value) && effect.value > 0)
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isStableIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
}

function hasExactKeys(value: unknown, expected: string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return keys.length === sortedExpected.length && keys.every((key, index) => key === sortedExpected[index]);
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

function isBriefingText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}
