/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import express, { type Express } from "express";
import * as v from "valibot";

export function createExpressApp(): Express {
  const app = express();
  app.use(express.json());
  const isRaw = process.env.BENCH_MODE === "raw";

  app.get("/", (_req, res) => {
    res.json({ status: "ok" });
  });

  if (isRaw) {
    app.get("/user/:id", (req, res) => {
      const { id } = req.params;
      res.json({ id, name: `User ${id}` });
    });

    app.get("/items", (req, res) => {
      const category = (req.query.category as string) ?? "all";
      const limit = Number(req.query.limit ?? 50);
      res.json({ category, limit, items: [1, 2, 3] });
    });

    app.post("/user", (req, res) => {
      res.json({ id: "101", ...req.body });
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

    app.get("/user/:id", (req, res) => {
      const { id } = v.parse(userParamSchema, req.params);
      res.json({ id, name: `User ${id}` });
    });

    app.get("/items", (req, res) => {
      const query = v.parse(itemsQuerySchema, req.query);
      const category = query.category ?? "all";
      const limit = Number(query.limit ?? 50);
      res.json({ category, limit, items: [1, 2, 3] });
    });

    app.post("/user", (req, res) => {
      const body = v.parse(userBodySchema, req.body);
      res.json({ id: "101", ...body });
    });
  }

  return app;
}
