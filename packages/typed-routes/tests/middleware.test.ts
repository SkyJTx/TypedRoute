import { describe, it, expect, vi } from "vitest";
import { createMiddleware } from "~/middleware/middleware";
import { defineRoute } from "~/router/define-route";
import * as v from "valibot";
import type { APIEvent } from "filesystem-routing/api";

describe("Request Middleware (createMiddleware)", () => {
  it("dispatches API route and coerces validated parameters and query params", async () => {
    const userRoute = defineRoute({
      params: v.object({
        id: v.number(),
      }),
      search: v.object({
        tab: v.optional(v.string()),
      }),
    });

    const routes = [
      {
        path: "/api/users/:id",
        $GET: {
          require: () => ({
            GET: (event: APIEvent) => {
              return Response.json({
                userId: event.params?.id,
                search: (event as Record<string, unknown>).search,
              });
            },
          }),
        },
        $$route: {
          require: () => ({
            route: userRoute,
          }),
        },
      },
    ] as const;

    const middleware = createMiddleware(routes as never);
    const nextMock = vi.fn().mockResolvedValue(new Response("Page HTML"));

    const request = new Request("http://localhost:3000/api/users/42?tab=settings");
    const response = await middleware(request, nextMock);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.userId).toBe(42);
    expect(json.search).toEqual({ tab: "settings" });
    expect(nextMock).not.toHaveBeenCalled();
  });

  it("automatically rejects invalid parameters with 400 Bad Request", async () => {
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

    const middleware = createMiddleware(routes as never);
    const nextMock = vi.fn();

    const request = new Request("http://localhost:3000/api/users/not-a-number");
    const response = await middleware(request, nextMock);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Validation Failed");
    expect(json.target).toBe("params");
    expect(onErrorMock).toHaveBeenCalledTimes(1);
    expect(nextMock).not.toHaveBeenCalled();
  });

  it("automatically rejects invalid search parameters with 400 Bad Request", async () => {
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

    const middleware = createMiddleware(routes as never);
    const nextMock = vi.fn();

    const request = new Request("http://localhost:3000/api/items?limit=abc");
    const response = await middleware(request, nextMock);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.target).toBe("search");
    expect(nextMock).not.toHaveBeenCalled();
  });

  it("falls through to next() for unmatched routes or pages", async () => {
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

    const middleware = createMiddleware(routes as never);
    const nextMock = vi.fn().mockResolvedValue(new Response("Rendered Page HTML", { status: 200 }));

    const request = new Request("http://localhost:3000/about");
    const response = await middleware(request, nextMock);

    expect(nextMock).toHaveBeenCalledWith();
    expect(await response.text()).toBe("Rendered Page HTML");
  });

  it("allows custom onValidationError response", async () => {
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

    const middleware = createMiddleware(routes as never, {
      onValidationError: ({ error }) => {
        return new Response(`Custom Error: ${error.target}`, { status: 422 });
      },
    });

    const request = new Request("http://localhost:3000/api/users/not-number");
    const response = await middleware(request, vi.fn());

    expect(response.status).toBe(422);
    expect(await response.text()).toBe("Custom Error: params");
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

    const routes = [
      {
        path: "/api/search/:category",
        $QUERY: {
          require: () => ({
            QUERY: async (event: APIEvent) => {
              const body = await event.request.json();
              return Response.json({
                category: event.params?.category,
                sort: (event as Record<string, unknown>).search,
                filter: body,
              });
            },
          }),
        },
        $$route: {
          require: () => ({
            route: queryRoute,
          }),
        },
      },
    ] as const;

    const middleware = createMiddleware(routes as never);
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

    const middleware = createMiddleware(routes as never);
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

    const middleware = createMiddleware(routes as never);
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

  it("supports Solid 2.0 RequestEvent objects ({ request: Request }) and dispatches successfully", async () => {
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
            GET: (event: APIEvent) => {
              return Response.json({
                id: event.params?.id,
                hasLocals: Boolean((event as Record<string, unknown>).locals),
              });
            },
          }),
        },
        $$route: {
          require: () => ({
            route: userRoute,
          }),
        },
      },
    ] as const;

    const middleware = createMiddleware(routes as never);
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

    const middleware = createMiddleware(routes as never);

    const strictSolidNext = vi.fn((...args: unknown[]) => {
      if (args.length > 0 && args[0] !== undefined) {
        throw new TypeError(
          "[@solidjs/vite-plugin] start.middleware: next() takes no arguments. " +
          "Middleware receives the request event -- so to substitute the request, assign " +
          "event.request = newRequest before calling next()."
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
});
