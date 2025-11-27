type Handler = (args: Record<string, unknown>) => Promise<unknown>;

const registry: Record<string, Handler> = {};

export const register = (command: string, handler: Handler) => {
  registry[command] = handler;
};

export const getHandler = (command: string): Handler | undefined => registry[command];

register("ping", async () => ({ status: "ok" }));

register("chat", async (args) => ({
  status: "ok",
  echo: args,
  note: "Wire this to browser map actions.",
}));

register("draw_point", async () => ({
  status: "ok",
  action: "draw_point",
}));

register("zoom_to", async (args) => ({
  status: "ok",
  action: "zoom_to",
  args,
}));
