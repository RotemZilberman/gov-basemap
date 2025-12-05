// src/redis.ts
import Redis from "ioredis";
import type { LayerCatalog } from "./mapLayers";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  tool_call_id?: string; // required when role === "tool"
  tool_calls?: any; // populated when assistant requested tools
}

export interface SessionData {
  id: string;                // session id (sid)
  magic: string;             // current magic token
  magicExpiresAt: number;    // unix ms
  createdAt: number;         // unix ms
  lastSeenAt: number;        // unix ms
  messages: ChatMessage[];   // chat history
  mapLayers?: LayerCatalog;  // optional layer metadata provided by the client
}

export const SESSION_TTL_SECONDS = 60 * 60;        // 1 hour
export const MAGIC_LIFETIME_MS = 10 * 60 * 1000;   // 10 minutes

export const sessionKey = (sid: string) => `session:${sid}`;
