import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { getHandler } from "./handlers";

dotenv.config();

const app = express();
const port = Number(process.env.MCP_PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const { command, args } = req.body ?? {};
  if (!command || typeof command !== "string") {
    return res.status(400).json({ status: "error", message: "command is required" });
  }

  const handler = getHandler(command);
  if (!handler) {
    return res.status(404).json({ status: "error", message: `Unknown command: ${command}` });
  }

  try {
    const data = await handler(args ?? {});
    return res.json({ status: "ok", message: "Handled", data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Handler failed";
    return res.status(500).json({ status: "error", message });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[MCP] Server listening on http://localhost:${port}/mcp`);
});
