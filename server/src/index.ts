// src/index.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { sessionRouter } from "./session";
import { chatRouter } from "./chat";
import { searchRouter } from "./search";

const app = express();

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true
  })
);

app.use(cookieParser());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Session bootstrap
app.use("/session", sessionRouter);

// Chat endpoint
app.use("/chat", chatRouter);

// Search helpers (e.g., Google geocode fallback)
app.use("/search", searchRouter);

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`🚀 GovMap chat backend listening on http://localhost:${port}`);
});
