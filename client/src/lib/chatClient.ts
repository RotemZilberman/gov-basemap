// src/lib/chatClient.ts
import type { LayerFieldMeta } from "../config/layers";

export type GovmapCommand = {
  fn: string;
  args: any;
  toolCallId?: string;
  tool_call_id?: string;
};

export type ToolResult = {
  fn: string;
  result: unknown;
  tool_call_id?: string;
  toolCallId?: string;
};

export type ChatMessage = { role: "assistant" | "user"; content: string };

export interface ChatResponse {
  assistantMessage?: ChatMessage;
  govmapCommands?: GovmapCommand[];
  newMagic?: string;
}

export interface LayerMetadataPayload {
  id: string;
  label: string;
  description?: string;
  groupId: string;
  fields?: Pick<LayerFieldMeta, "name" | "type" | "options" | "min" | "max">[];
  zoomCenter?: { x: number; y: number; level?: number };
}

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001";

export async function bootstrapSession(
  layerMetadata?: LayerMetadataPayload[]
): Promise<string> {
  const res = await fetch(`${API_BASE}/session/bootstrap`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      layerMetadata
    })
  });

  if (!res.ok) {
    throw new Error(`Session bootstrap failed: ${res.status}`);
  }

  const data = (await res.json()) as { magic?: string };
  if (!data.magic) {
    throw new Error("Missing magic token from bootstrap");
  }

  return data.magic;
}

export async function sendChatRequest(params: {
  message?: string;
  toolResults?: ToolResult[];
  layerMetadata?: LayerMetadataPayload[];
  magic: string;
}): Promise<ChatResponse> {
  const { message, toolResults, layerMetadata, magic } = params;

  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Session-Magic": magic
    },
    body: JSON.stringify({
      message,
      toolResults,
      layerMetadata
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat call failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as ChatResponse;
  return data;
}

export async function executeGovmapCommands(
  commands: GovmapCommand[],
  defaultMapDivId?: string
): Promise<ToolResult[]> {
  const govmap = (window as any).govmap;
  if (!govmap) throw new Error("GovMap API is not ready yet (window.govmap missing).");

  const results: ToolResult[] = [];

  for (const cmd of commands) {
    if (!cmd || typeof cmd.fn !== "string") continue;
    let args = typeof cmd.args === "object" && cmd.args !== null ? cmd.args : {};
    const toolCallId = (cmd as any).tool_call_id;

    const fn = govmap[cmd.fn];
    if (typeof fn !== "function") {
      console.warn(`GovMap function not found: ${cmd.fn}`);
      results.push({
        fn: cmd.fn,
        tool_call_id: toolCallId,
        result: "Error: Function not found",
      });
      continue;
    }

    // Inject mapDivId client-side (both for positional arrays and object calls)
    if (defaultMapDivId) {
      if (Array.isArray((args as any)._UNPACK_ARGS_)) {
        const unpack = [...(args as any)._UNPACK_ARGS_];
        const hasMapDiv = unpack.some((val) => val === defaultMapDivId);
        if (!hasMapDiv) {
          unpack.push(defaultMapDivId);
        }
        args = { _UNPACK_ARGS_: unpack };
      } else if ((args as any).mapDivId === undefined) {
        args = { ...args, mapDivId: defaultMapDivId };
      }
    }

    let callArgs: any[] = [];
    let isPositional = false;

    if (Array.isArray((args as any)._UNPACK_ARGS_)) {
      callArgs = (args as any)._UNPACK_ARGS_;
      isPositional = true;
    } else {
      callArgs = args;
      isPositional = false;
    }

    try {
      let result;

      if (isPositional) {
        // Use .apply() to spread the array elements as distinct positional arguments
        result = fn.apply(govmap, callArgs);
      } else {
        // Use .call() to pass the single object argument
        result = fn.call(govmap, callArgs);
      }

      const awaited = result && typeof result.then === "function" ? await result : result;

      if (awaited !== undefined) {
        results.push({
          fn: cmd.fn,
          result: awaited,
          tool_call_id: toolCallId,
        });
      } else {
        results.push({
          fn: cmd.fn,
          result: "Finish the action in GovMap but returned no result (its ok if intended but problematic if expected to data).",
          tool_call_id: toolCallId,
        });
      }
    } catch (err: any) {
      console.error("Error executing govmap command", cmd.fn, err);
      results.push({ 
        fn: cmd.fn, 
        result: `Execution Error: ${err.message || "Unknown GovMap error"}`,
        tool_call_id: toolCallId,
      });
    }
  }

  return results;
}
