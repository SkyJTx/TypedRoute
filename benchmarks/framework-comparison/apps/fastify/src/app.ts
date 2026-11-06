/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import Fastify, { type FastifyInstance } from "fastify";

export function createFastifyApp(): FastifyInstance {
  const fastify = Fastify({ logger: false });
  const isRaw = process.env.BENCH_MODE === "raw";

  fastify.get("/", async () => ({ status: "ok" }));

  if (isRaw) {
    fastify.get("/user/:id", async (req) => {
      const { id } = req.params as { id: string };
      return { id, name: `User ${id}` };
    });

    fastify.get("/items", async (req) => {
      const query = req.query as { category?: string; limit?: string };
      const category = query.category ?? "all";
      const limit = Number(query.limit ?? 50);
      return { category, limit, items: [1, 2, 3] };
    });

    fastify.post("/user", async (req) => {
      const body = req.body as Record<string, unknown>;
      return { id: "101", ...body };
    });
  } else {
    fastify.get(
      "/user/:id",
      {
        schema: {
          params: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
          },
        },
      },
      async (req) => {
        const { id } = req.params as { id: string };
        return { id, name: `User ${id}` };
      },
    );

    fastify.get(
      "/items",
      {
        schema: {
          querystring: {
            type: "object",
            properties: {
              category: { type: "string", default: "all" },
              limit: { type: "number", default: 50 },
            },
          },
        },
      },
      async (req) => {
        const query = req.query as { category?: string; limit?: number };
        const category = query.category ?? "all";
        const limit = Number(query.limit ?? 50);
        return { category, limit, items: [1, 2, 3] };
      },
    );

    fastify.post(
      "/user",
      {
        schema: {
          body: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string" },
            },
            required: ["name", "role"],
          },
        },
      },
      async (req) => {
        const body = req.body as { name: string; role: string };
        return { id: "101", ...body };
      },
    );
  }

  return fastify;
}
