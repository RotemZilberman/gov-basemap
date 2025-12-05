"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openai = void 0;
// src/openaiClient.ts
const openai_1 = __importDefault(require("openai"));
if (!process.env.OPENAI_API_KEY) {
    console.warn("[WARN] OPENAI_API_KEY is not set – OpenAI calls will fail.");
}
exports.openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY
});
