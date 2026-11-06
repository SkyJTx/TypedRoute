/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Elysia, t } from "elysia";

export const rawApp = new Elysia()
  .get("/", () => ({ status: "ok" }))
  .get("/user/:id", ({ params }) => ({
    id: params.id,
    name: `User ${params.id}`,
  }))
  .get("/items", ({ query }) => ({
    category: query.category ?? "all",
    limit: Number(query.limit ?? 50),
    items: [1, 2, 3],
  }))
  .post("/user", ({ body }) => ({
    id: "101",
    ...(body as Record<string, unknown>),
  }));

export const validatedApp = new Elysia()
  .get("/", () => ({ status: "ok" }))
  .get(
    "/user/:id",
    {
      params: t.Object({
        id: t.String(),
      }),
    },
    ({ params }) => ({
      id: params.id,
      name: `User ${params.id}`,
    }),
  )
  .get(
    "/items",
    {
      query: t.Object({
        category: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    },
    ({ query }) => ({
      category: query.category ?? "all",
      limit: Number(query.limit ?? 50),
      items: [1, 2, 3],
    }),
  )
  .post(
    "/user",
    {
      body: t.Object({
        name: t.String(),
        role: t.String(),
      }),
    },
    ({ body }) => ({
      id: "101",
      ...body,
    }),
  );

export const app = validatedApp;
export type ElysiaApp = typeof validatedApp;
