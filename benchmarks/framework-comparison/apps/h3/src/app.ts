/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { H3, getQuery, readBody } from "h3";
import * as v from "valibot";

export const app = new H3();
const isRaw = process.env.BENCH_MODE === "raw";

app.on("GET", "/", () => ({ status: "ok" }));

if (isRaw) {
  app.on("GET", "/user/:id", (event) => {
    const id = event.context.params?.id ?? "";
    return { id, name: `User ${id}` };
  });

  app.on("GET", "/items", (event) => {
    const query = getQuery(event);
    const category = (query.category as string) ?? "all";
    const limit = Number(query.limit ?? 50);
    return { category, limit, items: [1, 2, 3] };
  });

  app.on("POST", "/user", async (event) => {
    const body = (await readBody(event)) as Record<string, unknown>;
    return { id: "101", ...body };
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

  app.on("GET", "/user/:id", (event) => {
    const { id } = v.parse(userParamSchema, event.context.params ?? {});
    return { id, name: `User ${id}` };
  });

  app.on("GET", "/items", (event) => {
    const query = v.parse(itemsQuerySchema, getQuery(event));
    const category = query.category ?? "all";
    const limit = Number(query.limit ?? 50);
    return { category, limit, items: [1, 2, 3] };
  });

  app.on("POST", "/user", async (event) => {
    const body = v.parse(userBodySchema, await readBody(event));
    return { id: "101", ...body };
  });
}
