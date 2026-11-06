/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it } from "vitest";
import {
  bunAdapter,
  createRuntimeAdapter,
  nodeAdapter,
  presetBun,
  presetNode,
  presetStandard,
  resolveRuntimeAdapter,
  standardAdapter,
  type RuntimeAdapter,
} from "~/adapters";
import { json, STATIC_JSON_200_INIT, STATIC_JSON_HEADERS } from "~/router/api-response";
import { createMiddleware } from "~/middleware/middleware";
import { defineRoute } from "~/router/define-route";

describe("Runtime Adapters", () => {
  describe("Resolution & Factory", () => {
    it("resolves built-in presets by name", () => {
      expect(resolveRuntimeAdapter("bun")).toBe(bunAdapter);
      expect(resolveRuntimeAdapter("node")).toBe(nodeAdapter);
      expect(resolveRuntimeAdapter("standard")).toBe(standardAdapter);
    });

    it("resolves custom adapter objects verbatim", () => {
      const custom = createRuntimeAdapter({
        name: "custom-test",
        parseQuery: () => ({ custom: "yes" }),
      });
      expect(resolveRuntimeAdapter(custom)).toBe(custom);
    });

    it("auto-resolves an adapter based on environment", () => {
      const resolved = resolveRuntimeAdapter("auto");
      expect(resolved).toBeDefined();
      expect(typeof resolved.parseQuery).toBe("function");
    });
  });

  describe("standardAdapter", () => {
    it("parses query strings and handles empty values", () => {
      const parsed = standardAdapter.parseQuery("?category=tools&limit=50");
      expect(parsed).toEqual({ category: "tools", limit: "50" });

      expect(standardAdapter.parseQuery("")).toEqual({});
      expect(standardAdapter.parseQuery("?")).toEqual({});
    });

    it("reads json and text payloads", async () => {
      const reqJson = new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify({ hello: "world" }),
      });
      expect(await standardAdapter.readJson?.(reqJson)).toEqual({ hello: "world" });

      const reqText = new Request("http://localhost/", {
        method: "POST",
        body: "raw-text-payload",
      });
      expect(await standardAdapter.readText?.(reqText)).toBe("raw-text-payload");
    });
  });

  describe("nodeAdapter", () => {
    it("parses query strings and protects against prototype pollution", () => {
      const parsed = nodeAdapter.parseQuery("?name=wriothesley&__proto__[admin]=true&constructor[evil]=1");
      expect(parsed.name).toBe("wriothesley");
      expect((parsed as any).admin).toBeUndefined();
      expect((parsed as any).evil).toBeUndefined();
    });

    it("reads stream payloads via stream consumers", async () => {
      const req = new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify({ role: "duke" }),
      });
      expect(await nodeAdapter.readJson?.(req)).toEqual({ role: "duke" });
    });
  });

  describe("bunAdapter", () => {
    it("parses query strings safely with fallback", () => {
      const clean = bunAdapter.parseQuery("?filter=active&count=10");
      expect(clean.filter).toBe("active");
      expect(clean.count).toBe("10");

      const encoded = bunAdapter.parseQuery("?tag=hello%20world");
      expect(encoded.tag).toBe("hello world");
    });

    it("extracts headers efficiently", () => {
      const headers = new Headers({ "x-trace-id": "trace-42" });
      const extracted = bunAdapter.parseHeaders?.(headers);
      expect(extracted?.["x-trace-id"]).toBe("trace-42");
    });
  });

  describe("Middleware Adapter Integration", () => {
    it("uses configured adapter in request pipeline", async () => {
      const route = defineRoute({});
      const getHandler = route.handler((event) => {
        return json({ search: event.search });
      });

      const custom = createRuntimeAdapter({
        name: "test-mock",
        parseQuery(s) {
          return { intercepted: s };
        },
      });

      const mw = createMiddleware(
        [
          {
            path: "/test",
            $$route: { require: () => ({ route }) },
            $GET: { require: () => ({ GET: getHandler }) },
          },
        ],
        { adapter: custom },
      );

      const res = await mw(new Request("http://localhost/test?query=abc"), () => new Response(null, { status: 404 }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ search: { intercepted: "query=abc" } });
    });
  });

  describe("Response Envelope Optimization", () => {
    it("uses static pre-allocated headers for default 200 responses", () => {
      const res = json({ status: "ok" });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
      expect(STATIC_JSON_HEADERS["content-type"]).toBe("application/json; charset=utf-8");
      expect(STATIC_JSON_200_INIT.status).toBe(200);
    });

    it("respects status code numbers and custom headers", () => {
      const res404 = json({ error: "missing" }, 404);
      expect(res404.status).toBe(404);
      expect(res404.headers.get("content-type")).toBe("application/json; charset=utf-8");

      const resCustom = json({ created: true }, { status: 201, headers: { "X-Custom": "test" } });
      expect(resCustom.status).toBe(201);
      expect(resCustom.headers.get("content-type")).toBe("application/json; charset=utf-8");
      expect(resCustom.headers.get("x-custom")).toBe("test");
    });
  });
});
