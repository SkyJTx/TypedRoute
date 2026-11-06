/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Hono } from "hono";
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";

export const app = new Hono();
const isRaw = process.env.BENCH_MODE === "raw";

app.get("/", (c) => c.json({ status: "ok" }));

if (isRaw) {
  app.get("/user/:id", (c) => {
    const id = c.req.param("id");
    return c.json({ id, name: `User ${id}` });
  });

  app.get("/items", (c) => {
    const category = c.req.query("category") ?? "all";
    const limit = Number(c.req.query("limit") ?? 50);
    return c.json({ category, limit, items: [1, 2, 3] });
  });

  app.post("/user", async (c) => {
    const body = (await c.req.json()) as Record<string, unknown>;
    return c.json({ id: "101", ...body });
  });
} else {
  const userParamSchema = v.object({ id: v.string() });
  const itemsQuerySchema = v.object({
    category: v.optional(v.string(), "all"),
    limit: v.optional(v.string(), "50"),
  });
  const userBodySchema = v.object({
    name: v.string(),
    role: v.string(),
  });

  app.get("/user/:id", vValidator("param", userParamSchema), (c) => {
    const { id } = c.req.valid("param");
    return c.json({ id, name: `User ${id}` });
  });

  app.get("/items", vValidator("query", itemsQuerySchema), (c) => {
    const query = c.req.valid("query");
    const category = query.category ?? "all";
    const limit = Number(query.limit ?? 50);
    return c.json({ category, limit, items: [1, 2, 3] });
  });

  app.post("/user", vValidator("json", userBodySchema), (c) => {
    const body = c.req.valid("json");
    return c.json({ id: "101", ...body });
  });
}
