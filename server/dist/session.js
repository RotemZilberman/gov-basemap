"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionRouter = void 0;
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const crypto_1 = __importDefault(require("crypto"));
const express_1 = __importDefault(require("express"));
const redis_1 = require("./redis");
const mapLayers_1 = require("./mapLayers");
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
exports.sessionRouter = express_1.default.Router();
exports.sessionRouter.use((0, cookie_parser_1.default)());
exports.sessionRouter.use(express_1.default.json());
exports.sessionRouter.post("/bootstrap", async (req, res) => {
    const origin = req.headers.origin;
    if (origin !== FRONTEND_ORIGIN) {
        return res.status(403).json({ error: "Forbidden origin" });
    }
    const sessionId = crypto_1.default.randomUUID();
    const magic = crypto_1.default.randomBytes(32).toString("hex");
    const now = Date.now();
    const rawLayerCatalog = req.body?.layers ??
        req.body?.mapLayers ??
        req.body?.layerMetadata;
    const mapLayers = (0, mapLayers_1.normalizeLayerCatalog)(rawLayerCatalog);
    const sessionData = {
        id: sessionId,
        magic,
        magicExpiresAt: now + redis_1.MAGIC_LIFETIME_MS,
        createdAt: now,
        lastSeenAt: now,
        messages: [],
        mapLayers
    };
    const key = (0, redis_1.sessionKey)(sessionId);
    await redis_1.redis.set(key, JSON.stringify(sessionData), "EX", redis_1.SESSION_TTL_SECONDS);
    res.cookie("sid", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000 // 1 day cookie in browser
    });
    return res.json({ magic });
});
