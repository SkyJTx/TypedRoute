/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect, vi } from "vitest";
import * as v from "valibot";
import { z } from "zod";
import {
  CUSTOM_INSPECT_SYMBOL,
  DefinedRoute,
  ROUTE_FLAG_CONFIG_RESOLVED,
  ROUTE_FLAG_HAS_PARAMS_SCHEMA,
  ROUTE_FLAG_HAS_SEARCH_SCHEMA,
  ROUTE_FLAG_IS_PAGE,
  ROUTE_FLAG_VALIDATION_ONLY,
  RouteNodeMeta,
  compileValidator,
  createMiddleware,
  defineRoute,
  describeValidator,
  formatRouteFlags,
  inspectPathBuilder,
  inspectRoute,
} from "~/index";

describe("Engine Memory Layout & Human-Readable Diagnostics", () => {
  it("shares handler method on DefinedRoute.prototype across all route instances (zero per-route closure allocation)", () => {
    const routeA = defineRoute({
      params: v.object({ id: v.number() }),
    });
    const routeB = defineRoute({
      search: v.object({ q: v.string() }),
    });

    expect(routeA).toBeInstanceOf(DefinedRoute);
    expect(routeB).toBeInstanceOf(DefinedRoute);
    expect(routeA.handler).toBe(routeB.handler);
    expect(Object.keys(routeA)).toEqual(["config"]);
  });

  it("memoizes compiled validators in WeakMap so schema classification runs once per schema", () => {
    const schema = v.object({ id: v.number() });
    const compiled1 = compileValidator(schema);
    const compiled2 = compileValidator(schema);

    expect(compiled1).toBe(compiled2);
    expect(compiled1.name).toBe("validateStandardSchema");
  });

  it("memoizes extracted HTTP handlers across requests in createMiddleware (zero per-request handler extraction)", async () => {
    const requireSpy = vi.fn(() => ({
      GET: () => Response.json({ ok: true }),
    }));

    const routes = [
      {
        path: "/api/ping",
        $GET: {
          require: requireSpy,
        },
      },
    ] as const;

    const middleware = createMiddleware(routes);
    const next = vi.fn();

    await middleware(new Request("http://localhost/api/ping"), next);
    await middleware(new Request("http://localhost/api/ping"), next);
    await middleware(new Request("http://localhost/api/ping"), next);

    expect(requireSpy).toHaveBeenCalledTimes(1);
  });

  it("formats Smi route bitflags and inspects RouteNodeMeta and DefinedRoute in human-readable form", () => {
    const route = defineRoute({
      params: v.object({ orgId: v.string() }),
      search: z.object({ page: z.number() }),
      preload: () => ({ loaded: true }),
      info: { role: "admin" },
    });

    const summary = inspectRoute(route);
    expect(summary).toEqual({
      paramsValidator: "StandardSchema(valibot)",
      searchValidator: "StandardSchema(zod)",
      stateValidator: "none",
      hashValidator: "none",
      hasPreload: true,
      hasOnError: false,
      infoKeys: ["role"],
    });

    expect(String(route)).toBe(
      "DefinedRoute(params=StandardSchema(valibot), search=StandardSchema(zod))",
    );

    const customInspected = (
      route as unknown as { [CUSTOM_INSPECT_SYMBOL](): Record<string, unknown> }
    )[CUSTOM_INSPECT_SYMBOL]();
    expect(customInspected.paramsValidator).toBe("StandardSchema(valibot)");
    expect(describeValidator(function customParse(x: unknown) { return x; })).toBe(
      "Function(customParse)",
    );

    const meta = new RouteNodeMeta(
      { path: "/orgs/:orgId", page: true },
      ROUTE_FLAG_IS_PAGE | ROUTE_FLAG_VALIDATION_ONLY,
      route.config,
    );

    expect(formatRouteFlags(meta.flags)).toEqual([
      "IS_PAGE",
      "VALIDATION_ONLY",
      "CONFIG_RESOLVED",
      "HAS_PARAMS_SCHEMA",
      "HAS_SEARCH_SCHEMA",
    ]);

    const expectedMask =
      ROUTE_FLAG_IS_PAGE |
      ROUTE_FLAG_VALIDATION_ONLY |
      ROUTE_FLAG_CONFIG_RESOLVED |
      ROUTE_FLAG_HAS_PARAMS_SCHEMA |
      ROUTE_FLAG_HAS_SEARCH_SCHEMA;
    expect(meta.flags).toBe(expectedMask);
  });

  it("inspects compiled path builder segments in human-readable form", () => {
    const info = inspectPathBuilder("/orgs/:orgId/projects/:projectId/issues/:issueId?");
    expect(info.isStatic).toBe(false);
    expect(info.hasOptionalParam).toBe(true);
    expect(info.segments).toEqual([
      { type: "static", value: "/orgs/", optional: false },
      { type: "param", value: "orgId", optional: false },
      { type: "static", value: "/projects/", optional: false },
      { type: "param", value: "projectId", optional: false },
      { type: "static", value: "/issues/", optional: false },
      { type: "param", value: "issueId", optional: true },
    ]);
  });
});