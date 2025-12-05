// src/serverTools.ts
import type {
  ChatCompletionMessageToolCall,
  ChatCompletionTool
} from "openai/resources/chat/completions";
import type { ChatMessage } from "./redis";
import { wgs84ToItm } from "./projection";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

type WebSearchArgs = { query?: string; maxResults?: number };
type PlaceLookupArgs = { query?: string; maxResults?: number; language?: string };
type GeocodeArgs = { query?: string; language?: string };
type RouteArgs = {
  origin?: string;
  destination?: string;
  mode?: "driving" | "walking" | "bicycling" | "transit";
  language?: string;
};

/**
 * Tool definitions for server-handled calls (executed immediately on the backend).
 */
export const serverTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the public web (Tavily). Use only if the answer is not in conversation context.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query with key nouns. Avoid full questions; keep it short."
          },
          maxResults: {
            type: "number",
            description: "Maximum results (1-5). Default 3."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "google_places_lookup",
      description:
        "Lookup businesses or places via Google Places text search. Returns name, address, and coordinates including Israel Transverse Mercator (ITM) x/y.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Business or place text to search." },
          maxResults: {
            type: "number",
            description: "Limit results (1-5). Default 3."
          },
          language: {
            type: "string",
            description: "Response language code (e.g., he, en). Defaults to he."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "google_geocode",
      description:
        "Geocode a free-text address or place name via Google Geocoding. Returns formatted address and coordinates including Israel Transverse Mercator (ITM) x/y.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Address or place text to geocode." },
          language: {
            type: "string",
            description: "Response language code (e.g., he, en). Defaults to he."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "google_route",
      description:
        "Get an estimated route, distance, and duration between two places via Google Directions. Returns start/end coordinates including Israel Transverse Mercator (ITM) x/y.",
      parameters: {
        type: "object",
        properties: {
          origin: { type: "string", description: "Starting address or place text." },
          destination: { type: "string", description: "Destination address or place text." },
          mode: {
            type: "string",
            enum: ["driving", "walking", "bicycling", "transit"],
            description: "Travel mode. Defaults to driving."
          },
          language: {
            type: "string",
            description: "Response language code (e.g., he, en). Defaults to he."
          }
        },
        required: ["origin", "destination"]
      }
    }
  }
];

/**
 * Execute server-handled tool calls immediately and return tool messages.
 */
export async function executeServerToolCalls(
  toolCalls: ChatCompletionMessageToolCall[]
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [];

  for (const toolCall of toolCalls) {
    const name = toolCall.function?.name;
    const id = toolCall.id ?? name ?? `tool_${messages.length}`;

    const rawArgs = toolCall.function?.arguments ?? "{}";
    let args: any = {};
    try {
      args = JSON.parse(rawArgs);
    } catch {
      args = {};
    }

    let content: any = { ok: false, error: `Unknown tool: ${name}` };

    if (name === "web_search") {
      content = await handleWebSearch(args as WebSearchArgs);
    } else if (name === "google_places_lookup") {
      content = await handlePlacesLookup(args as PlaceLookupArgs);
    } else if (name === "google_geocode") {
      content = await handleGeocodeLookup(args as GeocodeArgs);
    } else if (name === "google_route") {
      content = await handleRouteLookup(args as RouteArgs);
    }

    messages.push({
      role: "tool",
      content: JSON.stringify(content ?? {}),
      tool_call_id: id
    });
  }

  return messages;
}

async function handleWebSearch(args: WebSearchArgs): Promise<any> {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  const maxResults = clamp(Math.floor(args.maxResults ?? 3), 1, 5);

  if (!query) {
    return { ok: false, error: "Missing query" };
  }

  if (!TAVILY_API_KEY) {
    return { ok: false, error: "Web search requires TAVILY_API_KEY to be set" };
  }

  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: "advanced",
        include_answer: true,
        include_raw_content: false,
        auto_parameters: true
      })
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `Tavily HTTP ${resp.status}: ${text}` };
    }

    const data = await resp.json();

    const results =
      Array.isArray(data.results)
        ? data.results.slice(0, maxResults).map((item: any) => ({
            title: item.title,
            link: item.url,
            snippet: item.content
          }))
        : [];

    return {
      ok: true,
      query: data.query ?? query,
      answer: data.answer ?? null,
      results,
      provider: "tavily"
    };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Search request failed (Tavily)" };
  }
}

/**
 * More “Google Maps–like” Places lookup:
 * - Detect Hebrew vs English.
 * - First try Israel-biased search (region=il).
 * - If no results, fallback to global search with alternate language.
 */
async function handlePlacesLookup(args: PlaceLookupArgs): Promise<any> {
  const rawQuery = typeof args.query === "string" ? args.query.trim() : "";
  if (!rawQuery) return { ok: false, error: "Missing query" };
  if (!GOOGLE_API_KEY) return { ok: false, error: "GOOGLE_MAPS_API_KEY/GOOGLE_API_KEY is not set" };

  // Detect language if not provided explicitly
  const hasHebrew = /[\u0590-\u05FF]/.test(rawQuery);
  const language = typeof args.language === "string" ? args.language : hasHebrew ? "he" : "en";
  const maxResults = clamp(Math.floor(args.maxResults ?? 3), 1, 5);

  async function textSearch(query: string, opts: { language: string; region?: string | null }) {

    if (!GOOGLE_API_KEY) return { ok: false, error: "GOOGLE_MAPS_API_KEY/GOOGLE_API_KEY is not set" };

    const key: string = GOOGLE_API_KEY; // now it's definitely string

    const params = new URLSearchParams({
      query,
      language,
      key
    });

    if (opts.region) {
      params.set("region", opts.region);
    }

    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`
    );
    if (!resp.ok) {
      const text = await resp.text();
      return {
        httpError: true,
        status: resp.status,
        error: `Places HTTP ${resp.status}: ${text}`
      };
    }
    const data = await resp.json();
    return { httpError: false, status: data.status, data, error: data.error_message };
  }

  try {
    // 1) First attempt: Israel-biased search
    let first = await textSearch(rawQuery, { language, region: "il" });
    if (first.httpError) {
      return { ok: false, status: first.status, error: first.error ?? "Places lookup failed" };
    }

    let data = first.data;
    let status = data.status;
    let resultsArray = Array.isArray(data.results) ? data.results : [];

    // 2) Fallback: if no useful results, try global search with possibly different language
    if (status !== "OK" || resultsArray.length === 0) {
      const fallbackLang = language === "he" ? "en" : language;
      const fallback = await textSearch(rawQuery, { language: fallbackLang, region: null });

      if (!fallback.httpError && fallback.data) {
        data = fallback.data;
        status = data.status;
        resultsArray = Array.isArray(data.results) ? data.results : resultsArray;
      }
    }

    if (status !== "OK" || !resultsArray.length) {
      return {
        ok: false,
        status,
        error: data.error_message ?? "Places lookup failed or returned no results"
      };
    }

    const results = resultsArray.slice(0, maxResults).map((place: any) => {
      const lat = place.geometry?.location?.lat;
      const lng = place.geometry?.location?.lng;
      const itm = lat !== undefined && lng !== undefined ? wgs84ToItm(lng, lat) : null;

      return {
        name: place.name,
        address: place.formatted_address,
        types: place.types,
        rating: place.rating,
        user_ratings_total: place.user_ratings_total,
        location: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
        itm: itm ?? undefined,
        place_id: place.place_id
      };
    });

    return { ok: true, query: rawQuery, results };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Places lookup failed" };
  }
}

/**
 * Improved Geocode:
 * - Detect Hebrew vs English.
 * - First try Israel region bias.
 * - Fallback to global geocode with alternate language if needed.
 */
async function handleGeocodeLookup(args: GeocodeArgs): Promise<any> {
  const rawQuery = typeof args.query === "string" ? args.query.trim() : "";
  if (!rawQuery) return { ok: false, error: "Missing query" };
  if (!GOOGLE_API_KEY) return { ok: false, error: "GOOGLE_MAPS_API_KEY/GOOGLE_API_KEY is not set" };

  const hasHebrew = /[\u0590-\u05FF]/.test(rawQuery);
  const language = typeof args.language === "string" ? args.language : hasHebrew ? "he" : "en";

  async function geocodeOnce(query: string, opts: { language: string; region?: string | null }) {
    if (!GOOGLE_API_KEY) return { ok: false, error: "GOOGLE_MAPS_API_KEY/GOOGLE_API_KEY is not set" };

    const key: string = GOOGLE_API_KEY; // now it's definitely string

    const params = new URLSearchParams({
      query,
      language,
      key
    });

    if (opts.region) {
      params.set("region", opts.region);
    }

    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );
    if (!resp.ok) {
      const text = await resp.text();
      return {
        httpError: true,
        status: resp.status,
        error: `Geocode HTTP ${resp.status}: ${text}`
      };
    }

    const data = await resp.json();
    return { httpError: false, status: data.status, data, error: data.error_message };
  }

  try {
    // 1) Israel-biased geocode
    let first = await geocodeOnce(rawQuery, { language, region: "il" });
    if (first.httpError) {
      return { ok: false, status: first.status, error: first.error ?? "Geocode failed" };
    }

    let data = first.data;
    let status = data.status;
    let resultsArray = Array.isArray(data.results) ? data.results : [];

    // 2) Fallback: global geocode if needed
    if (status !== "OK" || resultsArray.length === 0) {
      const fallbackLang = language === "he" ? "en" : language;
      const fallback = await geocodeOnce(rawQuery, { language: fallbackLang, region: null });

      if (!fallback.httpError && fallback.data) {
        data = fallback.data;
        status = data.status;
        resultsArray = Array.isArray(data.results) ? data.results : resultsArray;
      }
    }

    if (status !== "OK" || !resultsArray.length) {
      return {
        ok: false,
        status,
        error: data.error_message ?? "Geocode failed or returned no results"
      };
    }

    const results = resultsArray.map((hit: any) => {
      const lat = hit.geometry?.location?.lat;
      const lng = hit.geometry?.location?.lng;
      const itm = lat !== undefined && lng !== undefined ? wgs84ToItm(lng, lat) : null;

      return {
        formatted_address: hit.formatted_address,
        types: hit.types,
        location: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
        itm: itm ?? undefined,
        place_id: hit.place_id
      };
    });

    return { ok: true, query: rawQuery, results };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Geocode failed" };
  }
}

async function handleRouteLookup(args: RouteArgs): Promise<any> {
  const origin = typeof args.origin === "string" ? args.origin.trim() : "";
  const destination = typeof args.destination === "string" ? args.destination.trim() : "";
  const mode = args.mode ?? "driving";
  const language = typeof args.language === "string" ? args.language : "he";

  if (!origin || !destination) {
    return { ok: false, error: "Missing origin or destination" };
  }
  if (!GOOGLE_API_KEY) return { ok: false, error: "GOOGLE_MAPS_API_KEY/GOOGLE_API_KEY is not set" };

  const params = new URLSearchParams({
    origin,
    destination,
    mode,
    language,
    units: "metric",
    key: GOOGLE_API_KEY
  });

  try {
    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`
    );
    const data = await resp.json();

    if (data.status !== "OK") {
      return { ok: false, status: data.status, error: data.error_message ?? "Directions lookup failed" };
    }

    const routes = Array.isArray(data.routes)
      ? data.routes.slice(0, 1).map((route: any) => {
          const leg = route.legs?.[0];
          const startLocation = leg?.start_location;
          const endLocation = leg?.end_location;

          const startItm = startLocation ? wgs84ToItm(startLocation.lng, startLocation.lat) : null;
          const endItm = endLocation ? wgs84ToItm(endLocation.lng, endLocation.lat) : null;

          return {
            summary: route.summary,
            distance_meters: leg?.distance?.value,
            duration_seconds: leg?.duration?.value,
            start_address: leg?.start_address,
            end_address: leg?.end_address,
            start_location: startLocation ? { lat: startLocation.lat, lng: startLocation.lng } : undefined,
            end_location: endLocation ? { lat: endLocation.lat, lng: endLocation.lng } : undefined,
            start_itm: startItm ?? undefined,
            end_itm: endItm ?? undefined,
            warnings: route.warnings,
            overview_polyline: route.overview_polyline?.points
          };
        })
      : [];

    return { ok: true, origin, destination, mode, routes };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Directions lookup failed" };
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}
