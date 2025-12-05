// src/session.ts
import { Request, Response } from "express";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import express from "express";
import { redis, SessionData, SESSION_TTL_SECONDS, MAGIC_LIFETIME_MS, sessionKey } from "./redis";
import { normalizeLayerCatalog } from "./mapLayers";

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

export const sessionRouter = express.Router();

sessionRouter.use(cookieParser());
sessionRouter.use(express.json());

sessionRouter.post("/bootstrap", async (req: Request, res: Response) => {
  const origin = req.headers.origin;

  if (origin !== FRONTEND_ORIGIN) {
    return res.status(403).json({ error: "Forbidden origin" });
  }

  const sessionId = crypto.randomUUID();
  const magic = crypto.randomBytes(32).toString("hex");
  const now = Date.now();

  const rawLayerCatalog =
    (req.body as any)?.layers ??
    (req.body as any)?.mapLayers ??
    (req.body as any)?.layerMetadata;
  const mapLayers = normalizeLayerCatalog(rawLayerCatalog);

  const sessionData: SessionData = {
    id: sessionId,
    magic,
    magicExpiresAt: now + MAGIC_LIFETIME_MS,
    createdAt: now,
    lastSeenAt: now,
    messages: [],
    mapLayers
  };

  const key = sessionKey(sessionId);
  await redis.set(key, JSON.stringify(sessionData), "EX", SESSION_TTL_SECONDS);

  res.cookie("sid", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000 // 1 day cookie in browser
  });

  return res.json({ magic });
});
