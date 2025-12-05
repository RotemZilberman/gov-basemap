"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionKey = exports.MAGIC_LIFETIME_MS = exports.SESSION_TTL_SECONDS = exports.redis = void 0;
// src/redis.ts
const ioredis_1 = __importDefault(require("ioredis"));
exports.redis = new ioredis_1.default(process.env.REDIS_URL ?? "redis://localhost:6379");
exports.SESSION_TTL_SECONDS = 60 * 60; // 1 hour
exports.MAGIC_LIFETIME_MS = 10 * 60 * 1000; // 10 minutes
const sessionKey = (sid) => `session:${sid}`;
exports.sessionKey = sessionKey;
