export interface HealthResponse {
  status: "ok";
  service: "scenariolab-api";
}

export type ScenarioAvailability = "available" | "planned";

export interface ScenarioCatalogEntry {
  scenario_id: string;
  title: string;
  description: string;
  category: string;
  objective: string;
  availability: ScenarioAvailability;
  planned_key_metrics: string[];
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
  turn: {
    duration: number;
    unit: string;
    max_turns: number;
  };
  metrics: Array<{ metric_id: string; title: string }>;
}

const DEFAULT_API_BASE_URL = "http://localhost:8000";

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  return (configuredUrl || DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export async function getApiHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const body = await requestJson("/api/health", signal);
  if (!isHealthResponse(body)) {
    throw new Error("Health response did not match the expected contract");
  }

  return body;
}

export async function getScenarioCatalog(
  signal?: AbortSignal,
): Promise<ScenarioCatalogEntry[]> {
  const body = await requestJson("/api/scenarios", signal);
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
    signal,
  );
  if (!isScenarioDefinition(body)) {
    throw new Error("Scenario definition did not match the expected contract");
  }
  return body;
}

async function requestJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { Accept: "application/json" },
    signal: signal ?? null,
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.status === "ok" && candidate.service === "scenariolab-api";
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
  if (!isRecord(value) || !isRecord(value.metadata) || !isRecord(value.turn)) {
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
    typeof value.turn.duration === "number" &&
    typeof value.turn.unit === "string" &&
    typeof value.turn.max_turns === "number" &&
    Array.isArray(value.metrics) &&
    value.metrics.every(
      (metric) =>
        isRecord(metric) &&
        typeof metric.metric_id === "string" &&
        typeof metric.title === "string",
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
