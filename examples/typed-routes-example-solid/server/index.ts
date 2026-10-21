import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

const app = new Hono();

// Global enterprise middleware chain
app.use("*", secureHeaders());
app.use("*", cors());

app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  c.header("X-Response-Time", `${(performance.now() - start).toFixed(2)}ms`);
});

// Direct integration: forward to Solid Start production server handler
app.all("*", async (c) => {
  try {
    const serverModule = await import("../dist/server/server.js");
    const handler = serverModule.default?.fetch ?? serverModule.fetch;
    if (typeof handler === "function") {
      return handler(c.req.raw);
    }
    return c.json({ error: "Invalid server handler" }, 500);
  } catch (err) {
    return c.json({
      error: "Solid Start server bundle not available. Execute 'bun run build' before launching the standalone Hono server.",
      details: err instanceof Error ? err.message : String(err),
    }, 503);
  }
});

export { app };
export default {
  port: Number(process.env.PORT) || 3000,
  fetch: app.fetch,
};