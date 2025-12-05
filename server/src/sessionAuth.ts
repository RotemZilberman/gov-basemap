import type { Request } from "express";
import crypto from "crypto";
import { redis, SESSION_TTL_SECONDS, MAGIC_LIFETIME_MS, sessionKey, type SessionData } from "./redis";

export class SessionAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface SessionAuthResult {
  sid: string;
  session: SessionData;
  newMagic?: string;
}

/**
 * Validate session + magic token from the request.
 * - Ensures sid cookie + X-Session-Magic header exist and match.
 * - Enforces idle timeout.
 * - Rotates magic token when expired.
 * - Updates lastSeenAt; caller is responsible to persist the session (persistSession).
 */
export async function authenticateSession(req: Request): Promise<SessionAuthResult> {
  const sid = req.cookies?.sid;
  const clientMagic = typeof req.headers["x-session-magic"] === "string" ? req.headers["x-session-magic"] : undefined;

  if (!sid || !clientMagic) {
    throw new SessionAuthError(401, "Missing session");
  }

  const key = sessionKey(sid);
  const sessionJson = await redis.get(key);
  if (!sessionJson) {
    throw new SessionAuthError(401, "Session expired or invalid");
  }

  const session: SessionData = JSON.parse(sessionJson);
  const now = Date.now();

  if (session.lastSeenAt + SESSION_TTL_SECONDS * 1000 < now) {
    await redis.del(key);
    throw new SessionAuthError(401, "Session idle timeout");
  }

  if (clientMagic !== session.magic) {
    throw new SessionAuthError(401, "Invalid magic");
  }

  let newMagic: string | undefined;
  if (session.magicExpiresAt < now) {
    newMagic = crypto.randomBytes(32).toString("hex");
    session.magic = newMagic;
    session.magicExpiresAt = now + MAGIC_LIFETIME_MS;
  }

  session.lastSeenAt = now;

  return { sid, session, newMagic };
}

export async function persistSession(sid: string, session: SessionData): Promise<void> {
  await redis.set(sessionKey(sid), JSON.stringify(session), "EX", SESSION_TTL_SECONDS);
}
