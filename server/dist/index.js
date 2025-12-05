"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const session_1 = require("./session");
const chat_1 = require("./chat");
const search_1 = require("./search");
const app = (0, express_1.default)();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
app.use((0, cors_1.default)({
    origin: FRONTEND_ORIGIN,
    credentials: true
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
// Health check
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});
// Session bootstrap
app.use("/session", session_1.sessionRouter);
// Chat endpoint
app.use("/chat", chat_1.chatRouter);
// Search helpers (e.g., Google geocode fallback)
app.use("/search", search_1.searchRouter);
const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
    console.log(`🚀 GovMap chat backend listening on http://localhost:${port}`);
});
