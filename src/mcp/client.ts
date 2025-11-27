export type McpRequest = {
  command: string;
  args?: Record<string, unknown>;
};

export type McpResponse = {
  status: "ok" | "error";
  message?: string;
  data?: unknown;
};

export const sendMcpCommand = async (payload: McpRequest): Promise<McpResponse> => {
  const res = await fetch("http://localhost:4000/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`MCP request failed: ${res.status}`);
  }

  return res.json();
};
