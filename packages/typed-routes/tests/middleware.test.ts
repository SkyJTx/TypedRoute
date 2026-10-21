/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect, vi } from "vitest";
import { createMiddleware } from "~/middleware/middleware";
import { defineRoute } from "~/router/define-route";
import * as v from "valibot";

describe("Request Middleware (createMiddleware)", () => {
  describe("Success Cases", () => {
    it("dispatches API route and coerces validated parameters and query params via route.handler", async () => {
      const userRoute = defineRoute({
        params: v.object({
          id: v.number(),
        }),
        search: v.object({
          tab: v.optional(v.string()),
        }),
      });

      const GET = userRoute.handler((event) => {
        return Response.json({
          userId: event.params.id,
          search: event.search,
        });
      });

      const routes = [
        {
          path: "/api/users/:id",
          $GET: {
            require: () => ({ GET }),
          },
          $$route: {
            require: () => ({ route: userRoute }),
          },
        },
      ] as const;

      const middleware = createMiddleware(routes);
      const nextMock = vi.fn().mockResolvedValue(new Response("Page HTML"));

      const request = new Request("http://localhost:3000/api/users/42?tab=settings");
      const response = await middleware(request, nextMock);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.userId).toBe(42);
      expect(json.search).toEqual({ tab: "settings" });
      expect(nextMock).not.toHaveBeenCalled();
    });

    it("falls through to next() for unmatched routes", async () => {
      const routes = [
        {
          path: "/api/hello",
          $GET: {
            require: () => ({
              GET: () => Response.json({ message: "hello" }),
            }),
          },
        },
      ] as const;

      const middleware = createMiddleware(routes);
      const nextMock = vi.fn().mockResolvedValue(new Response("Rendered Page HTML", { status: 200 }));

      const request = new Request("http://localhost:3000/about");
      const response = await middleware(request, nextMock);

      expect(nextMock).toHaveBeenCalledWith();
      expect(await response.text()).toBe("Rendered Page HTML");
    });

    it("dispatches QUERY request with validated params, search, and body payload", async () => {
      const queryRoute = defineRoute({
        params: v.object({
          category: v.string(),
        }),
        search: v.object({
          sort: v.optional(v.string()),
        }),
      });

      const QUERY = queryRoute.handler(async (event) => {
        const body = await event.request.json();
        return Response.json({
          category: event.params.category,
          sort: event.search,
          filter: body,
        });
      });

      const routes = [
        {
          path: "/api/search/:category",
          $QUERY: {
            require: () => ({ QUERY }),
          },
          $$route: {
            require: () => ({ route: queryRoute }),
          },
        },
      ] as const;

      const middleware = createMiddleware(routes);
      const nextMock = vi.fn();

      const request = new Request("http://localhost:3000/api/search/books?sort=desc", {
        method: "QUERY",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author: "Fontaine" }),
      });

      const response = await middleware(request, nextMock);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.category).toBe("books");
      expect(json.sort).toEqual({ sort: "desc" });
      expect(json.filter).toEqual({ author: "Fontaine" });
      expect(nextMock).not.toHaveBeenCalled();
    });

    it("correctly matches pure QUERY-only route while falling through on GET", async () => {
      const routes = [
        {
          path: "/api/query-only",
          $QUERY: {
            require: () => ({
              QUERY: () => Response.json({ ok: true }),
            }),
          },
        },
      ] as const;

      const middleware = createMiddleware(routes);
      const nextMock = vi.fn().mockResolvedValue(new Response("Fallback to Next", { status: 200 }));

      const queryRequest = new Request("http://localhost:3000/api/query-only", {
        method: "QUERY",
      });
      const queryResponse = await middleware(queryRequest, nextMock);
      expect(queryResponse.status).toBe(200);
      expect(await queryResponse.json()).toEqual({ ok: true });
      expect(nextMock).not.toHaveBeenCalled();

      const getRequest = new Request("http://localhost:3000/api/query-only", {
        method: "GET",
      });
      const getResponse = await middleware(getRequest, nextMock);
      expect(nextMock).toHaveBeenCalledWith();
      expect(await getResponse.text()).toBe("Fallback to Next");
    });

    it("supports Solid 2.0 RequestEvent objects ({ request: Request }) and dispatches successfully", async () => {
      const userRoute = defineRoute({
        params: v.object({
          id: v.number(),
        }),
      });

      const GET = userRoute.handler((event) => {
        return Response.json({
          id: event.params.id,
          hasLocals: Boolean(event.locals),
        });
      });

      const routes = [
        {
          path: "/api/users/:id",
          $GET: {
            require: () => ({ GET }),
          },
          $$route: {
            require: () => ({ route: userRoute }),
          },
        },
      ] as const;

      const middleware = createMiddleware(routes);
      const nextMock = vi.fn();

      const request = new Request("http://localhost:3000/api/users/99");
      const solidEvent = {
        request,
        locals: { user: "wriothesley" },
        response: { headers: new Headers() },
      };

      const response = await middleware(solidEvent, nextMock);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.id).toBe(99);
      expect(json.hasLocals).toBe(true);
      expect(nextMock).not.toHaveBeenCalled();
    });

    it("calls next() with zero arguments on fallthrough for Solid Start compatibility", async () => {
      const routes = [
        {
          path: "/api/items",
          $GET: {
            require: () => ({
              GET: () => Response.json({ ok: true }),
            }),
          },
        },
      ] as const;

      const middleware = createMiddleware(routes);

      const strictSolidNext = vi.fn((...args: unknown[]) => {
        if (args.length > 0 && args[0] !== undefined) {
          throw new TypeError(
            "[@solidjs/vite-plugin] start.middleware: next() takes no arguments.",
          );
        }
        return Promise.resolve(new Response("Fallback Passed"));
      });

      const request = new Request("http://localhost:3000/non-api-page");
      const solidEvent = {
        request,
        locals: {},
      };

      const response = await middleware(solidEvent, strictSolidNext);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("Fallback Passed");
      expect(strictSolidNext).toHaveBeenCalledTimes(1);
      expect(strictSolidNext).toHaveBeenCalledWith();
    });

    it("validates UI page route (page: true) and falls through to next() with zero arguments", async () => {
      const pageRoute = defineRoute({
        params: v.object({ id: v.number() }),
      });

      const routes = [
        {
          path: "/(main)/users/:id",
          page: true,
          $component: { src: "users/[id].tsx", import: () => Promise.resolve({}) },
          $$route: { require: () => ({ route: pageRoute }) },
        },
      ] as const;

      const middleware = createMiddleware(routes);
      const nextMock = vi.fn().mockResolvedValue(new Response("SSR Page HTML", { status: 200 }));

      const event = { request: new Request("http://localhost:3000/users/7") } as Record<string, unknown> & {
        request: Request;
      };
      const res = await middleware(event, nextMock);

      expect(res.status).toBe(200);
      expect(event.params).toEqual({ id: 7 });
      expect(nextMock).toHaveBeenCalledWith();
    });
  });

  describe("Expected Failure & Validation Error Cases", () => {
    it("automatically rejects invalid API parameters with 400 Bad Request (isPage: false)", async () => {
      const onErrorMock = vi.fn();
      const userRoute = defineRoute({
        params: v.object({
          id: v.number(),
        }),
        onError: onErrorMock,
      });

      const routes = [
        {
          path: "/api/users/:id",
          $GET: {
            require: () => ({
              GET: () => Response.json({ status: "ok" }),
            }),
          },
          $$route: {
            require: () => ({
              route: userRoute,
            }),
          },
        },
      ] as const;

      const middleware = createMiddleware(routes);
      const nextMock = vi.fn();

      const request = new Request("http://localhost:3000/api/users/not-a-number");
      const response = await middleware(request, nextMock);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Validation Failed");
      expect(json.target).toBe("params");
      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock.mock.calls[0][0].error.rawParams).toEqual({ id: "not-a-number" });
      expect(nextMock).not.toHaveBeenCalled();
    });

    it("automatically rejects invalid API search parameters with 400 Bad Request", async () => {
      const userRoute = defineRoute({
        search: v.object({
          limit: v.number(),
        }),
      });

      const routes = [
        {
          path: "/api/items",
          $GET: {
            require: () => ({
              GET: () => Response.json({ items: [] }),
            }),
          },
          $$route: {
            require: () => ({
              route: userRoute,
            }),
          },
        },
      ] as const;

      const middleware = createMiddleware(routes);
      const nextMock = vi.fn();

      const request = new Request("http://localhost:3000/api/items?limit=abc");
      const response = await middleware(request, nextMock);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.target).toBe("search");
      expect(nextMock).not.toHaveBeenCalled();
    });

    it("enforces parameter validation on QUERY requests", async () => {
      const filterRoute = defineRoute({
        params: v.object({
          version: v.number(),
        }),
      });

      const routes = [
        {
          path: "/api/filter/:version",
          $QUERY: {
            require: () => ({
              QUERY: () => Response.json({ ok: true }),
            }),
          },
          $$route: {
            require: () => ({
              route: filterRoute,
            }),
          },
        },
      ] as const;

      const middleware = createMiddleware(routes);
      const nextMock = vi.fn();

      const request = new Request("http://localhost:3000/api/filter/invalid-version", {
        method: "QUERY",
      });
      const response = await middleware(request, nextMock);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("Validation Failed");
      expect(json.target).toBe("params");
      expect(nextMock).not.toHaveBeenCalled();
    });

    it("allows custom onValidationError response and passes isPage flag", async () => {
      const userRoute = defineRoute({
        params: v.object({
          id: v.number(),
        }),
      });

      const routes = [
        {
          path: "/api/users/:id",
          $GET: {
            require: () => ({
              GET: () => Response.json({ status: "ok" }),
            }),
          },
          $$route: {
            require: () => ({
              route: userRoute,
            }),
          },
        },
      ] as const;

      const onValidationError = vi.fn(({ error, isPage }) => {
        return new Response(`Custom Error: ${error.target} (isPage=${isPage})`, { status: 422 });
      });

      const middleware = createMiddleware(routes, { onValidationError });

      const request = new Request("http://localhost:3000/api/users/not-number");
      const response = await middleware(request, vi.fn());

      expect(response.status).toBe(422);
      expect(await response.text()).toBe("Custom Error: params (isPage=false)");
      expect(onValidationError).toHaveBeenCalledTimes(1);
    });

    it("attaches validationError and falls through to next() when UI page validation fails and onValidationError returns void", async () => {
      const onErrorMock = vi.fn();
      const onValidationErrorMock = vi.fn();

      const userPageRoute = defineRoute({
        params: v.object({ id: v.number() }),
        onError: onErrorMock,
      });

      const directoryPageRoute = defineRoute({
        search: v.object({ role: v.picklist(["admin", "operator"]) }),
      });

      const routes = [
        {
          path: "/(main)/users/:id",
          page: true,
          $component: { src: "users/[id].tsx", import: () => Promise.resolve({}) },
          $$route: { require: () => ({ route: userPageRoute }) },
        },
        {
          path: "/(main)/users/",
          page: true,
          $component: { src: "users/index.tsx", import: () => Promise.resolve({}) },
          $$route: { require: () => ({ route: directoryPageRoute }) },
        },
      ] as const;

      const middleware = createMiddleware(routes, {
        onValidationError: onValidationErrorMock,
      });

      const nextMock = vi.fn().mockResolvedValue(new Response("SSR Error Component HTML", { status: 200 }));

      // Test 1: Invalid params on /users/d
      const event1 = { request: new Request("http://localhost:3000/users/d") } as Record<string, unknown> & {
        request: Request;
      };
      const res1 = await middleware(event1, nextMock);
      expect(res1.status).toBe(200);
      expect(await res1.text()).toBe("SSR Error Component HTML");
      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onValidationErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          isPage: true,
          rawParams: { id: "d" },
        }),
      );
      expect(event1.validationError).toBeDefined();
      expect(nextMock).toHaveBeenCalledWith();

      // Test 2: Invalid search on /users/?role=invalid (verifies no WeakMap collision between multiple page routes)
      const event2 = { request: new Request("http://localhost:3000/users/?role=invalid") } as Record<
        string,
        unknown
      > & { request: Request };
      const res2 = await middleware(event2, nextMock);
      expect(res2.status).toBe(200);
      expect(onValidationErrorMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isPage: true,
          rawSearch: { role: "invalid" },
        }),
      );
      expect(event2.validationError).toBeDefined();
    });

    it("computes isPage deterministically without $component and marks non-GET methods on hybrid page routes as isPage: false", async () => {
      const onValidationErrorMock = vi.fn();
      const hybridRoute = defineRoute({
        params: v.object({ id: v.number() }),
      });

      const routes = [
        {
          path: "/hybrid/:id",
          page: true,
          // Notice $component is omitted; isPage is determined from page: true + HTTP method
          $$route: { require: () => ({ route: hybridRoute }) },
          $GET: {
            require: () => ({
              // Returning undefined on GET declines API handling and falls through to SSR page rendering
              GET: () => undefined,
            }),
          },
          $POST: {
            require: () => ({
              POST: () => Response.json({ updated: true }),
            }),
          },
        },
      ] as const;

      const middleware = createMiddleware(routes, {
        onValidationError: onValidationErrorMock,
      });
      const nextMock = vi.fn().mockResolvedValue(new Response("Hybrid SSR Page", { status: 200 }));

      // 1. Invalid GET request on hybrid route -> isPage: true, falls through to SSR
      const getRes = await middleware(new Request("http://localhost:3000/hybrid/abc"), nextMock);
      expect(getRes.status).toBe(200);
      expect(onValidationErrorMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ isPage: true, rawParams: { id: "abc" } }),
      );

      // 2. Invalid POST request on hybrid route -> isPage: false, returns 400 Bad Request JSON
      const postRes = await middleware(
        new Request("http://localhost:3000/hybrid/abc", { method: "POST" }),
        nextMock,
      );
      expect(postRes.status).toBe(400);
      expect(onValidationErrorMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ isPage: false, rawParams: { id: "abc" } }),
      );
    });

    it("falls through to next() when a HEAD request targets a QUERY-only route", async () => {
      const routes = [
        {
          path: "/api/query-endpoint",
          $QUERY: {
            require: () => ({
              QUERY: () => Response.json({ ok: true }),
            }),
          },
        },
      ] as const;

      const middleware = createMiddleware(routes);
      const nextMock = vi.fn().mockResolvedValue(new Response("HEAD Fallback", { status: 200 }));

      const headRes = await middleware(
        new Request("http://localhost:3000/api/query-endpoint", { method: "HEAD" }),
        nextMock,
      );
      expect(headRes.status).toBe(200);
      expect(await headRes.text()).toBe("HEAD Fallback");
      expect(nextMock).toHaveBeenCalledWith();
    });
  });
});