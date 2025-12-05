"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionAuthError = void 0;
exports.authenticateSession = authenticateSession;
exports.persistSession = persistSession;
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = require("./redis");
class SessionAuthError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.SessionAuthError = SessionAuthError;
/**
 * Validate session + magic token from the request.
 * - Ensures sid cookie + X-Session-Magic header exist and match.
 * - Enforces idle timeout.
 * - Rotates magic token when expired.
 * - Updates lastSeenAt; caller is responsible to persist the session (persistSession).
 */
async function authenticateSession(req) {
    const sid = req.cookies?.sid;
    const clientMagic = typeof req.headers["x-session-magic"] === "string" ? req.headers["x-session-magic"] : undefined;
    if (!sid || !clientMagic) {
        throw new SessionAuthError(401, "Missing session");
    }
    const key = (0, redis_1.sessionKey)(sid);
    const sessionJson = await redis_1.redis.get(key);
    if (!sessionJson) {
        throw new SessionAuthError(401, "Session expired or invalid");
    }
    const session = JSON.parse(sessionJson);
    const now = Date.now();
    if (session.lastSeenAt + redis_1.SESSION_TTL_SECONDS * 1000 < now) {
        await redis_1.redis.del(key);
        throw new SessionAuthError(401, "Session idle timeout");
    }
    if (clientMagic !== session.magic) {
        throw new SessionAuthError(401, "Invalid magic");
    }
    let newMagic;
    if (session.magicExpiresAt < now) {
        newMagic = crypto_1.default.randomBytes(32).toString("hex");
        session.magic = newMagic;
        session.magicExpiresAt = now + redis_1.MAGIC_LIFETIME_MS;
    }
    session.lastSeenAt = now;
    return { sid, session, newMagic };
}
async function persistSession(sid, session) {
    await redis_1.redis.set((0, redis_1.sessionKey)(sid), JSON.stringify(session), "EX", redis_1.SESSION_TTL_SECONDS);
}
