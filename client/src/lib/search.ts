// src/lib/search.ts
import type {
  GovmapSearchAndLocateItem,
  GovmapSearchAndLocateResponse
} from "./govmap.types";
import { applyNewMagic, ensureMagicToken } from "./sessionManager";

const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001";

export type SearchAction =
  | { type: "zoom"; x: number; y: number; level?: number; term?: string }
  | { type: "layer"; layerId: string }
  | { type: "keyword"; keyword: string }
  | { type: "parcel"; gush: number; parcel: number };

export type SearchSuggestionKind = "layer" | "address" | "feature" | "parcel" | "keyword";

export interface SearchSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  kind: SearchSuggestionKind;
  badge?: string;
  action: SearchAction;
}

export function normalizeSearchResponse(raw: unknown): GovmapSearchAndLocateItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as GovmapSearchAndLocateItem[];

  const maybe = (raw as GovmapSearchAndLocateResponse) ?? {};
  const buckets = [maybe.data, maybe.results, maybe.Result];

  for (const bucket of buckets) {
    if (Array.isArray(bucket)) {
      return bucket as GovmapSearchAndLocateItem[];
    }
  }

  return [];
}

export function extractXY(candidate: unknown): { x: number; y: number } | null {
  if (!candidate || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;

  const possibleX = c.x ?? c.X ?? c.lon ?? c.longitude ?? c.Lon ?? c.Longitude;
  const possibleY = c.y ?? c.Y ?? c.lat ?? c.latitude ?? c.Lat ?? c.Latitude;

  if (typeof possibleX === "number" && typeof possibleY === "number") {
    return { x: possibleX, y: possibleY };
  }

  if (typeof c.wkt === "string") {
    const wktPoint = parseWkt(c.wkt);
    if (wktPoint) return wktPoint;
  }

  if (c.geometry && typeof c.geometry === "object") {
    const geom = c.geometry as Record<string, unknown>;
    const rings = geom.rings ?? geom.paths;
    if (rings) {
      const centroid = centroidFromRings(rings);
      if (centroid) return centroid;
    }
  }

  return null;
}

export function parseWkt(wkt: string | undefined): { x: number; y: number } | null {
  if (!wkt) return null;
  const match = wkt.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  if (match) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      return { x, y };
    }
  }
  return null;
}

export function centroidFromRings(rings: unknown): { x: number; y: number } | null {
  if (!Array.isArray(rings) || !Array.isArray(rings[0])) return null;
  const ring = rings[0] as unknown[];
  if (!Array.isArray(ring) || ring.length === 0) return null;

  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const coord of ring) {
    if (Array.isArray(coord) && coord.length >= 2) {
      const [x, y] = coord;
      if (typeof x === "number" && typeof y === "number") {
        sumX += x;
        sumY += y;
        count += 1;
      }
    }
  }

  if (count === 0) return null;
  return { x: sumX / count, y: sumY / count };
}

export interface AutocompleteResult {
  id: string;
  text: string;
  type?: string;
  score?: number;
  shape?: string;
  data?: Record<string, unknown>;
  originalText?: string;
}

export interface AutocompleteResponse {
  resultsCount?: number;
  results?: AutocompleteResult[];
}

export async function fetchGovmapAutocomplete(
  searchText: string,
  opts?: { language?: "he" | "en"; maxResults?: number; isAccurate?: boolean; signal?: AbortSignal }
): Promise<AutocompleteResult[]> {
  if (!searchText.trim()) return [];

  const body = {
    searchText,
    language: opts?.language ?? "he",
    isAccurate: opts?.isAccurate ?? false,
    maxResults: opts?.maxResults ?? 10
  };

  const res = await fetch("https://www.govmap.gov.il/api/search-service/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts?.signal
  });

  if (!res.ok) {
    throw new Error(`autocomplete request failed: ${res.status}`);
  }

  const json = (await res.json()) as AutocompleteResponse;
  return json.results ?? [];
}

interface BackendGeocodeResponse {
  suggestions?: SearchSuggestion[];
  error?: string;
  newMagic?: string;
}

export async function fetchServerGeocodeSuggestions(
  searchText: string,
  opts?: { signal?: AbortSignal }
): Promise<SearchSuggestion[]> {
  if (!searchText.trim()) return [];

  let magic: string;
  try {
    magic = await ensureMagicToken();
  } catch (err) {
    console.warn("Failed to ensure session for geocode suggestions", err);
    return [];
  }

  const params = new URLSearchParams({
    q: searchText
  });

  const res = await fetch(`${BACKEND_BASE}/search/google-geocode?${params.toString()}`, {
    signal: opts?.signal,
    credentials: "include",
    headers: {
      "X-Session-Magic": magic
    }
  });
  if (!res.ok) {
    throw new Error(`backend geocode request failed: ${res.status}`);
  }

  const json = (await res.json()) as BackendGeocodeResponse;
  applyNewMagic(json.newMagic);
  return json.suggestions ?? [];
}
