/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import * as v from "valibot";
import {
  defineRoute,
  json,
  createMiddleware,
  type MiddlewareRouteEntry,
} from "@skyjt/typed-routes";

const isRaw = process.env.BENCH_MODE === "raw";

// 1. Root route
export const rootRoute = defineRoute({});
export const getRoot = rootRoute.handler(() => json({ status: "ok" }));

// 2. Dynamic route
const rawUserRoute = defineRoute({});
const valUserRoute = defineRoute({
  params: v.object({
    id: v.string(),
  }),
});
const rawGetUser = rawUserRoute.handler((event: any) => {
  const id = event.params?.id ?? "";
  return json({ id, name: `User ${id}` });
});
const valGetUser = valUserRoute.handler((event) => {
  return json({ id: event.params.id, name: `User ${event.params.id}` });
});

export const userRoute = isRaw ? rawUserRoute : valUserRoute;
export const getUser = isRaw ? rawGetUser : valGetUser;

// 3. Query route
const rawItemsRoute = defineRoute({});
const valItemsRoute = defineRoute({
  search: v.object({
    category: v.optional(v.string(), "all"),
    limit: v.optional(v.number(), 50),
  }),
});
const rawGetItems = rawItemsRoute.handler((event: any) => {
  const url = new URL(event.request.url);
  const category = url.searchParams.get("category") ?? "all";
  const limit = Number(url.searchParams.get("limit") ?? 50);
  return json({ category, limit, items: [1, 2, 3] });
});
const valGetItems = valItemsRoute.handler((event) => {
  return json({
    category: event.search.category,
    limit: event.search.limit,
    items: [1, 2, 3],
  });
});

export const itemsRoute = isRaw ? rawItemsRoute : valItemsRoute;
export const getItems = isRaw ? rawGetItems : valGetItems;

// 4. POST route
export const postUserRoute = defineRoute({});
export const userBodySchema = v.object({
  name: v.string(),
  role: v.string(),
});
const rawPostUser = postUserRoute.handler(async (event: any) => {
  const body = (await event.request.json()) as Record<string, unknown>;
  return json({ id: "101", ...body });
});
const valPostUser = postUserRoute.handler(
  {
    body: userBodySchema,
  },
  (event) => {
    return json({ id: "101", ...event.body });
  },
);
export const postUser = isRaw ? rawPostUser : valPostUser;

export const routes: MiddlewareRouteEntry[] = [
  {
    path: "/",
    $$route: { require: () => ({ route: rootRoute }) },
    $GET: { require: () => ({ GET: getRoot }) },
  },
  {
    path: "/user/:id",
    $$route: { require: () => ({ route: userRoute }) },
    $GET: { require: () => ({ GET: getUser as any }) },
  },
  {
    path: "/items",
    $$route: { require: () => ({ route: itemsRoute }) },
    $GET: { require: () => ({ GET: getItems as any }) },
  },
  {
    path: "/user",
    $$route: { require: () => ({ route: postUserRoute }) },
    $POST: { require: () => ({ POST: postUser as any }) },
  },
];

const notFound = () => new Response("Not Found", { status: 404 });
export const middleware = createMiddleware(routes);

export async function fetch(req: Request): Promise<Response> {
  const res = await middleware(req, notFound);
  return (res as Response) ?? notFound();
}
