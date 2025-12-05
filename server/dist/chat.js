"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRouter = void 0;
// src/chat.ts
const express = __importStar(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const mapLayers_1 = require("./mapLayers");
const openaiClient_1 = require("./openaiClient");
const govmapTools_1 = require("./govmapTools");
const serverTools_1 = require("./serverTools");
const sessionAuth_1 = require("./sessionAuth");
exports.chatRouter = express.Router();
exports.chatRouter.use((0, cookie_parser_1.default)());
exports.chatRouter.use(express.json());
const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const HISTORY_LIMIT = 30; // max number of messages to keep in history
const SUMMARY_THRESHOLD = HISTORY_LIMIT; // trigger summarization once we exceed this length
const SUMMARY_KEEP_RECENT = SUMMARY_THRESHOLD - 10; // keep recent messages + one summary ≈ HISTORY_LIMIT
const CACHEABLE = { type: "ephemeral" };
function combineToolResultsByCallId(toolResults) {
    const grouped = new Map();
    for (const result of toolResults) {
        const id = typeof result?.tool_call_id === "string" ? result.tool_call_id : undefined;
        if (!id)
            continue;
        const arr = grouped.get(id) ?? [];
        arr.push(result);
        grouped.set(id, arr);
    }
    return Array.from(grouped.entries()).map(([tool_call_id, items]) => ({
        tool_call_id,
        items
    }));
}
const SYSTEM_PROMPT = `
You are a professional maps assistant operating inside an application.

## Language behavior
- Detect the user's language automatically.
- If the last user message is in Hebrew, respond in clear, concise Hebrew.
- If the last user message is in English, respond in clear, concise English.
- If the user explicitly asks you to switch language, do so.
- Keep explanations short and to the point.

## Core behavior
- You control the map ONLY by returning commands for the "govmap_call" tool.
- You NEVER execute GovMap functions yourself. You only plan them; the frontend will run them as 'govmap[fn](args)'.
- Prefer as few commands as possible to achieve the user’s goal.

## Tool choice – high-level rules
- If the user is asking about **layers / parcels / gush / filters / attributes / opacity / styles / GIS / spatial queries** → use ONLY 'govmap_call'.
- If the user is asking about a **real-world place or route** (address, POI, beach, school, café, city, etc.) → you MAY use Google tools to get coordinates or directions.
- If the user wants general **internet information** (not map control) → use 'web_search'.
- If you already know exactly which GovMap commands to use, do NOT call any Google tools.

## Map-tool usage rules (GovMap)
- When the user wants to change the map (zoom, pan, layers, filters, selections, etc.), call ONLY the 'govmap_call' tool. This is the ONLY way to change the visual map.
- When you want to get info about a specific data object that is in the map (for example: attributes of a parcel, gush, address, or feature), call ONLY the 'govmap_call' tool with the appropriate function and arguments.
- Use ONLY real GovMap API function names from the reference below. If you are unsure which function or arguments to use, ask a short clarifying question instead of guessing.
- If you need data from the map (for example: 'geocode', 'searchAndLocate', 'intersectFeatures', 'selectFeaturesOnMap', spatial queries, etc.):
  - Specify clearly which fields / attributes you want returned in 'returnFields' or similar arguments.
  - Let the client respond with a tool message containing 'toolResults'.
  - If a tool message with 'toolResults' for that operation already exists in the conversation, USE it to answer the user instead of running the same command again, unless the user’s request clearly changed.

## Google tools usage rules
- Never call Google tools for pure layer / GIS operations.
  - If the user talks about parcels, gush, layers, filters, attributes, styles, opacity, zoom levels, or spatial analysis → use ONLY 'govmap_call'.
  - In those cases, you MUST NOT call 'google_places_lookup', 'google_geocode', or 'google_route'.
- Google tools ('google_places_lookup', 'google_geocode', 'google_route') are ONLY allowed when:
  - The user is asking about a real-world place or route (e.g. school, café, address, city, POI), AND
  - You need coordinates or directions that GovMap tools cannot give you directly.
- Do NOT mix GovMap commands and Google tools in the SAME tool call.
  - It is OK to first call ONLY a Google tool to get coordinates, then in the NEXT turn use ONLY 'govmap_call' using those coordinates.
- If you want internet info about a subject (not map control), call 'web_search' and summarize the top results concisely for the user.
- Google tools are for addresses/POIs/schools/places—not GIS layers (e.g., parcels/gush). If a request sounds like a layer search, start with GovMap. If unclear whether the user means a layer or a place with the same name, ask one short clarification before choosing a tool.

## Layer catalog usage
- You receive a system message listing available layers—USE IT.
- When the user refers explicitly to a layer NAME or FIELD NAME that appears in the layer catalog system message (exact or very close match), you must handle the DATA/LAYER part of the request using 'govmap_call' (functions such as 'setVisibleLayers', 'filterLayers', 'selectFeaturesOnMap', 'intersectFeatures', etc.).
- This rule applies ONLY to the layer/attribute operations themselves. It does NOT forbid you from using Google tools to resolve a separate real-world place (address, beach, city, POI) mentioned in the same request.
- If the request combines:
  - a place that is NOT a layer name, and
  - an operation on a known layer (e.g., bus_stops layer),
  then:
  1) First use a Google tool ('google_places_lookup' / 'google_geocode') to get coordinates for the place.
  2) On a later turn, use ONLY 'govmap_call' with those coordinates to query/filter the relevant layer.
- Do NOT treat generic words like "תחנות אוטובוס", "חוף", "בית ספר" as layer names UNLESS they exactly match a layer from the catalog. Generic words may still require Google geocoding for the place part.
- If the user asks to filter/search/toggle/query a layer name that exists in that list, use 'govmap_call' (do not use Google). If unsure whether the name is a layer vs a real-world place, ask one brief clarification before choosing.

## Interaction pattern
- If a required parameter (layer name, address text, zoom level, coordinates, whereClause, etc.) is missing or ambiguous:
  - Ask the user ONE short clarifying question.
  - Do not invent or guess critical values.
- After you return GovMap commands (via 'govmap_call'):
  - Also return a very short natural-language explanation to the user, in their language (Hebrew or English), describing what changed on the map and what they now see.
  - Example (Hebrew): "מרכזתי את המפה לנקודה שביקשת והפעלתי את שכבת הכתובות."
  - Example (English): "I centered the map on the requested point and turned on the addresses layer."

## Examples
User (Hebrew): "תמצא לי את כל תחנות האוטובוס שקרובות ל-Sunny Beach תל אביב"

Assistant (first step):
- Use ONLY 'google_places_lookup' or 'google_geocode' to get coordinates for "Sunny Beach Tel Aviv".
- Do NOT call 'govmap_call' in this turn.

Assistant (next step, after getting coordinates):
- Use ONLY 'govmap_call' to select bus stations around that point in the bus-stops layer (for example with 'selectFeaturesOnMap' or 'getLayerData').
- Then explain in one short sentence what you did.

User (Hebrew): "תשנה את הבהירות של שכבת החלקות ל-20 ותסנן לשטח גדול מ-5000"

Assistant:
- Use ONLY 'govmap_call'.
- Do NOT call any Google tools.

GovMap tool payload:
{"commands":[
  {
    "fn":"setLayerOpacity",
    "args":{"layerName":"PARCEL_ALL","opacity":20}
  },
  {
    "fn":"filterLayers",
    "args":{"layerName":"PARCEL_ALL","whereClause":"(legal_area > 5000)"}
  }
],
"explanation":"שיניתי את הבהירות של שכבת החלקות ל-20 וסיננתי לחלקות עם שטח גדול מ-5000."}

## Example tool payload (for illustration)
{"commands":[{"fn":"zoomToXY","args":{"x":220000,"y":630000,"level":10}}],"explanation":"Centered the map on the point you requested."}

## GovMap API reference
Use this reference when choosing function names and arguments. Do NOT invent new functions.

${govmapTools_1.GOVMAP_API_GUIDE}
`;
/**
 * POST /chat
 * Body: { message?: string, toolResults?: any[] }
 * Cookie: sid
 * Header: X-Session-Magic
 */
exports.chatRouter.post("/", async (req, res) => {
    try {
        const { sid, session, newMagic } = await (0, sessionAuth_1.authenticateSession)(req);
        const toolResults = Array.isArray(req.body.toolResults)
            ? req.body.toolResults
            : undefined;
        const hasToolResults = Array.isArray(toolResults) && toolResults.length > 0;
        const rawUserMessage = req.body.message;
        const hasUserText = typeof rawUserMessage === "string" && rawUserMessage.trim().length > 0;
        const userMessageText = hasUserText
            ? rawUserMessage
            : undefined;
        if (!userMessageText && !hasToolResults) {
            return res
                .status(400)
                .json({ error: "Missing message or toolResults payload" });
        }
        session.lastSeenAt = Date.now();
        // Append tool results (if provided) before the new user text so the model
        // can treat them as the outcome of the previous govmap_call.
        if (hasToolResults) {
            const toolMessages = [];
            const grouped = combineToolResultsByCallId(toolResults);
            const missingId = toolResults.filter((r) => typeof r?.tool_call_id !== "string");
            for (const group of grouped) {
                toolMessages.push({
                    role: "tool",
                    content: JSON.stringify({ results: group.items }),
                    tool_call_id: group.tool_call_id
                });
            }
            // If no valid tool_call_id was provided, fall back to a user message to avoid invalid tool ordering.
            if (toolMessages.length > 0) {
                session.messages.push(...toolMessages);
            }
            if (missingId.length > 0 && toolMessages.length === 0) {
                session.messages.push({
                    role: "user",
                    content: JSON.stringify({
                        toolResults,
                        note: "Client-side GovMap tool results (no tool_calls provided)"
                    })
                });
            }
        }
        // Append user message to history
        if (userMessageText) {
            const userMessage = {
                role: "user",
                content: userMessageText
            };
            session.messages.push(userMessage);
        }
        if (session.messages.length > SUMMARY_THRESHOLD) {
            await summarizeHistory(session, DEFAULT_MODEL);
        }
        session.messages = trimHistory(session.messages, HISTORY_LIMIT);
        const layerContext = (0, mapLayers_1.formatLayerCatalogPrompt)(session.mapLayers);
        // Build messages for Chat Completions API
        const messagesForModel = [
            withCacheControl({ role: "system", content: SYSTEM_PROMPT })
        ];
        if (layerContext) {
            messagesForModel.push(withCacheControl({
                role: "system",
                content: layerContext
            }));
        }
        messagesForModel.push(...mapMessagesForModel(session.messages));
        const { history, commands } = await runAiGovmapLoop(messagesForModel);
        const assistantMessage = history[history.length - 1] ?? {
            role: "assistant",
            content: ""
        };
        // Save assistant/tool messages to session history
        session.messages.push(...history);
        session.messages = trimHistory(session.messages, HISTORY_LIMIT);
        // Save back to Redis, refresh TTL
        await (0, sessionAuth_1.persistSession)(sid, session);
        return res.json({
            assistantMessage,
            govmapCommands: commands,
            newMagic
        });
    }
    catch (err) {
        if (err instanceof sessionAuth_1.SessionAuthError) {
            return res.status(err.status).json({ error: err.message });
        }
        console.error("[/chat] Error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * AI loop using Chat Completions + tools.
 * - Calls model with tools.
 * - If tool_calls are returned, we handle them, append tool results, and call again.
 * - When model stops calling tools, we return the final assistant text and all govmap commands.
 */
async function runAiGovmapLoop(messages) {
    const model = DEFAULT_MODEL;
    const history = [];
    const commands = [];
    let workingMessages = [...messages];
    const MAX_TOOL_LOOPS = 3;
    for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
        const completion = await openaiClient_1.openai.chat.completions.create({
            model,
            messages: workingMessages,
            tools: [...govmapTools_1.govmapTools, ...serverTools_1.serverTools],
            tool_choice: "auto"
        });
        const msg = completion.choices[0].message;
        const toolCalls = msg.tool_calls ?? [];
        const assistantMessage = {
            role: "assistant",
            content: normalizeAssistantContent(msg.content),
            ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
        };
        if (toolCalls.length > 0) {
            const govmapCalls = toolCalls.filter((t) => t.type === "function" && t.function?.name === "govmap_call");
            const serverCalls = toolCalls.filter((t) => !(t.type === "function" && t.function?.name === "govmap_call"));
            let pushed = false;
            // Server tools
            if (serverCalls.length > 0) {
                history.push(assistantMessage);
                pushed = true;
                workingMessages.push(msg);
                const toolMessages = await (0, serverTools_1.executeServerToolCalls)(serverCalls);
                for (const tmsg of toolMessages) {
                    history.push(tmsg);
                    workingMessages.push({
                        role: "tool",
                        content: tmsg.content,
                        tool_call_id: tmsg.tool_call_id
                    });
                }
            }
            // Govmap tools (return immediately)
            if (govmapCalls.length > 0) {
                if (!pushed)
                    history.push(assistantMessage);
                for (const call of govmapCalls) {
                    const rawArgs = call.function?.arguments ?? "{}";
                    let args;
                    try {
                        args = JSON.parse(rawArgs);
                    }
                    catch {
                        args = {};
                    }
                    const result = (0, govmapTools_1.handleGovmapToolCall)(args);
                    const id = typeof call.id === "string" ? call.id : undefined;
                    const cmds = id
                        ? result.commands.map((c) => ({ ...c, tool_call_id: id }))
                        : result.commands;
                    commands.push(...cmds);
                }
                return { history, commands };
            }
            // Only server tools → continue loop
            if (serverCalls.length > 0)
                continue;
        }
        // No tool calls → final answer
        history.push(assistantMessage);
        return { history, commands };
    }
    // Fallback: force final answer without tools
    const final = await openaiClient_1.openai.chat.completions.create({
        model,
        messages: workingMessages
    });
    const finalMsg = final.choices[0].message;
    history.push({
        role: "assistant",
        content: normalizeAssistantContent(finalMsg.content)
    });
    return { history, commands };
}
function trimHistory(messages, limit = HISTORY_LIMIT) {
    if (messages.length <= limit)
        return messages;
    return messages.slice(messages.length - limit);
}
function mapMessagesForModel(messages) {
    const mapped = [];
    let expectedToolCallIds = null;
    for (const m of messages) {
        if (m.role === "assistant") {
            const toolCalls = m.tool_calls;
            if (Array.isArray(toolCalls) && toolCalls.length > 0) {
                const ids = toolCalls
                    .map((tc) => tc?.id)
                    .filter((id) => typeof id === "string");
                expectedToolCallIds = ids.length > 0 ? new Set(ids) : null;
                mapped.push({
                    role: "assistant",
                    content: m.content,
                    tool_calls: toolCalls
                });
                continue;
            }
            expectedToolCallIds = null;
            mapped.push({
                role: "assistant",
                content: m.content
            });
            continue;
        }
        if (m.role === "tool") {
            const toolCallId = m.tool_call_id;
            if (expectedToolCallIds && typeof toolCallId === "string" && expectedToolCallIds.has(toolCallId)) {
                mapped.push({
                    role: "tool",
                    content: m.content,
                    tool_call_id: toolCallId
                });
            }
            // Skip tool messages that do not match the most recent assistant tool_calls to avoid API errors.
            continue;
        }
        // user
        expectedToolCallIds = null;
        mapped.push({
            role: "user",
            content: m.content
        });
    }
    return mapped;
}
function withCacheControl(msg) {
    msg.cache_control = CACHEABLE;
    return msg;
}
/**
 * Summarize older parts of the conversation to reduce token usage while keeping intent/context.
 */
async function summarizeHistory(session, model) {
    if (session.messages.length <= SUMMARY_THRESHOLD)
        return;
    const recent = session.messages.slice(session.messages.length - SUMMARY_KEEP_RECENT);
    const toSummarize = session.messages.slice(0, session.messages.length - SUMMARY_KEEP_RECENT);
    if (toSummarize.length === 0)
        return;
    const formatted = toSummarize
        .map((m) => {
        const label = m.role === "user"
            ? "משתמש"
            : m.role === "assistant"
                ? "עוזר"
                : "כלי";
        return `${label}: ${m.content}`;
    })
        .join("\n");
    const summaryPrompt = [
        { role: "system", content: "Briefly summarize (3–5 sentences) what has been done so far—such as map zooms, activated or filtered layers, open questions, and important instructions to remember. The summary should be written in the same language the user used (Hebrew or English)." },
        { role: "user", content: formatted }
    ];
    try {
        const completion = await openaiClient_1.openai.chat.completions.create({
            model,
            messages: summaryPrompt
        });
        const summaryText = normalizeAssistantContent(completion.choices[0].message.content);
        const summaryMessage = {
            role: "assistant",
            content: `סיכום שיחה עד כה: ${summaryText}`
        };
        session.messages = [summaryMessage, ...recent];
    }
    catch (err) {
        console.warn("[chat] Failed to summarize history:", err);
    }
}
/**
 * Helper: normalize ChatCompletionMessage.content (string or array) to string.
 */
function normalizeAssistantContent(content) {
    if (!content)
        return "";
    if (typeof content === "string")
        return content;
    // content is array of parts
    return content
        .map((part) => {
        if (typeof part === "string")
            return part;
        if ("text" in part && typeof part.text === "string")
            return part.text;
        return "";
    })
        .join("");
}
