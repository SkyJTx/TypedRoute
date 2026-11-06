/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import "reflect-metadata";
import { Controller, Get, Post, Param, Query, Body, Module, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as v from "valibot";

const isRaw = process.env.BENCH_MODE === "raw";
const userParamSchema = v.object({ id: v.string() });
const itemsQuerySchema = v.object({
  category: v.optional(v.string(), "all"),
  limit: v.optional(v.string(), "50"),
});
const userBodySchema = v.object({
  name: v.string(),
  role: v.string(),
});

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return { status: "ok" };
  }

  @Get("user/:id")
  getUser(@Param("id") id: string) {
    if (!isRaw) {
      v.parse(userParamSchema, { id });
    }
    return { id, name: `User ${id}` };
  }

  @Get("items")
  getItems(@Query("category") category = "all", @Query("limit") limit = "50") {
    if (!isRaw) {
      const q = v.parse(itemsQuerySchema, { category, limit });
      return { category: q.category ?? "all", limit: Number(q.limit ?? 50), items: [1, 2, 3] };
    }
    return { category, limit: Number(limit), items: [1, 2, 3] };
  }

  @Post("user")
  createUser(@Body() body: Record<string, unknown>) {
    if (!isRaw) {
      const b = v.parse(userBodySchema, body);
      return { id: "101", ...b };
    }
    return { id: "101", ...body };
  }
}

@Module({
  controllers: [AppController],
})
export class AppModule {}

export async function createNestApp(): Promise<INestApplication> {
  return await NestFactory.create(AppModule, { logger: false });
}
