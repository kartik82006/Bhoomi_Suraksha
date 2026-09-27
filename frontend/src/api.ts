import type { PrioritizationItem, Session, Summary } from "./types";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8000/api";

  
export async function login(email: string, password: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Login failed");
  }
  const data = await res.json();
  return { ...data, email };
}

async function authedFetch(path: string, session: Session | null, params?: Record<string, string | undefined>) {
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) query.set(key, value);
  }
  const qs = query.toString();

  const res = await fetch(`${API_BASE}${path}${qs ? `?${qs}` : ""}`, { headers });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export function getHazardZones() {
  return authedFetch("/hazards", null) as Promise<GeoJSON.FeatureCollection>;
}

export function getSummary() {
  return authedFetch("/summary", null) as Promise<Summary>;
}

export interface PrioritizationFilters {
  [key: string]: string | undefined;
  district?: string;
  tier?: string;
}

export function getPrioritization(session: Session, filters: PrioritizationFilters = {}) {
  return authedFetch("/prioritization", session, filters) as Promise<PrioritizationItem[]>;
}

export function getHabitations(session: Session, filters: PrioritizationFilters = {}) {
  return authedFetch("/habitations", session, filters) as Promise<GeoJSON.FeatureCollection>;
}

export function getSites() {
  return authedFetch("/sites", null) as Promise<GeoJSON.FeatureCollection>;
}

export interface SimulationResult {
  rainfallMultiplier: number;
  results: {
    habitationId: string;
    name: string;
    state: string;
    district: string;
    population: number;
    tier: import("./types").Tier;
    priorityScore: number;
    componentScores: PrioritizationItem["componentScores"];
    breakdown: PrioritizationItem["breakdown"];
    weights: PrioritizationItem["weights"];
  }[];
}

export function simulatePrioritization(session: Session, rainfall: number, state?: string) {
  return authedFetch("/prioritization/simulate", session, {
    rainfall: String(rainfall),
    state,
  }) as Promise<SimulationResult>;
}

export async function translateStrings(texts: string[], target = "hi-IN"): Promise<string[]> {
  const res = await fetch(`${API_BASE}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, target }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Translation failed: ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.translations) || data.translations.length !== texts.length) {
    throw new Error("Sarvam returned an incomplete translation");
  }
  return data.translations as string[];
}
