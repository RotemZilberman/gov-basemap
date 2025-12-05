// src/openaiClient.ts
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("[WARN] OPENAI_API_KEY is not set – OpenAI calls will fail.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});