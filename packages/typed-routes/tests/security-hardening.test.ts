/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as v from "valibot";
import {
  parseFastQueryString,
  normalizeSearchParams,
  coerceRecord,
  parseFastUrl,
  buildUrl,
  clearBuilderCache,
  getBuilderCacheSize,
  MAX_BUILDER_CACHE_SIZE,
  parseRequestCookies,
  parseRequestBody,
  problem,
  redirect,
  joinBaseAndPath,
  navigateCrossApp,
  renderOpenAPIUI,
  extractRequestPathname,
  serializeFastQuery,
  defineRoute,
  createMiddleware,
  json,
} from "../src/index";

describe("Security Hardening: Prototype Pollution Defense", () => {
  it("drops dangerous prototype keys (__proto__, constructor, prototype) in parseFastQueryString", () => {
    const raw = "?__proto__[polluted]=true&__proto__=evil&constructor=hacked&prototype=pwnd&safe=valid";
    const result = parseFastQueryString(raw);

    expect(result.safe).toBe("valid");
    expect(Object.getPrototypeOf(result)).toBeNull();
    expect(Object.hasOwn(result, "__proto__")).toBe(false);
    expect(Object.hasOwn(result, "constructor")).toBe(false);
    expect(Object.hasOwn(result, "prototype")).toBe(false);

    // Verify global Object.prototype was NOT polluted
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("drops dangerous prototype keys in normalizeSearchParams from string and object inputs", () => {
    const rawQuery = "?__proto__=malicious&constructor=tampered&legit=123";
    const fromStr = normalizeSearchParams(rawQuery);

    expect(fromStr.legit).toBe("123");
    expect((fromStr as Record<string, unknown>).__proto__).not.toBe("malicious");

    const rawObj: Record<string, unknown> = {
      legit: "hello",
      __proto__: { polluted: "yes" },
      constructor: "evil",
    };
    const fromObj = normalizeSearchParams(rawObj as Record<string, string | string[] | undefined>);

    expect(fromObj.legit).toBe("hello");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("guards against property hijacking on coerceRecord", () => {
    const input: Record<string, unknown> = {
      count: "100",
      active: "true",
      __proto__: { exploit: true },
      constructor: "fake",
    };
    const coerced = coerceRecord(input);

    expect(coerced.count).toBe(100);
    expect(coerced.active).toBe(true);
    expect(({} as Record<string, unknown>).exploit).toBeUndefined();
  });
});

describe("Security Hardening: Open Redirect & Protocol-Relative URL Sanitization", () => {
  it("sanitizes leading double slashes (protocol-relative URLs) into origin-relative paths", () => {
    const parsed1 = parseFastUrl("//attacker.com/evil");
    expect(parsed1.pathname).toBe("/attacker.com/evil");

    const parsed2 = parseFastUrl("///attacker.com/nested");
    expect(parsed2.pathname).toBe("/attacker.com/nested");

    const parsed3 = parseFastUrl("////attacker.com/many");
    expect(parsed3.pathname).toBe("/attacker.com/many");
  });

  it("neutralizes leading and internal backslashes", () => {
    const parsed1 = parseFastUrl("/\\attacker.com/evil");
    expect(parsed1.pathname).toBe("/attacker.com/evil");

    const parsed2 = parseFastUrl("\\attacker.com/evil");
    expect(parsed2.pathname).toBe("/attacker.com/evil");
  });

  it("sanitizes protocol-relative pathnames within full URLs", () => {
    const full1 = parseFastUrl("https://fontaine.gov//attacker.com/evil?tab=activity");
    expect(full1.pathname).toBe("/attacker.com/evil");
    expect(full1.searchStr).toBe("tab=activity");

    const full2 = parseFastUrl("https://fontaine.gov/\\attacker.com/evil");
    expect(full2.pathname).toBe("/attacker.com/evil");
  });

  it("preserves standard valid pathnames without corruption", () => {
    expect(parseFastUrl("/users/42").pathname).toBe("/users/42");
    expect(parseFastUrl("/").pathname).toBe("/");
    expect(parseFastUrl("https://example.com/api/v1/projects").pathname).toBe("/api/v1/projects");
  });
});

describe("Security Hardening: Bounded Native Map Builder Cache & URL Parameter Guards", () => {
  beforeEach(() => {
    clearBuilderCache();
  });

  it("caps builderCache size at MAX_BUILDER_CACHE_SIZE (2048) under dynamic pattern flooding", () => {
    expect(getBuilderCacheSize()).toBe(0);

    for (let i = 0; i < 3_000; i++) {
      buildUrl(`/dynamic_route_${i}/:id`, { params: { id: i } });
    }

    expect(getBuilderCacheSize()).toBe(MAX_BUILDER_CACHE_SIZE);
  });

  it("evicts oldest pattern in FIFO order when capacity is exceeded and recompiles cleanly on demand", () => {
    for (let i = 0; i < MAX_BUILDER_CACHE_SIZE; i++) {
      buildUrl(`/route_${i}/:param`, { params: { param: "val" } });
    }
    expect(getBuilderCacheSize()).toBe(MAX_BUILDER_CACHE_SIZE);

    // Insert a new pattern beyond MAX_BUILDER_CACHE_SIZE: evicts oldest entry (/route_0/:param)
    expect(buildUrl("/route_brand_new/:param", { params: { param: "fresh" } })).toBe(
      "/route_brand_new/fresh",
    );
    expect(getBuilderCacheSize()).toBe(MAX_BUILDER_CACHE_SIZE);

    // Re-building /route_0/:param still succeeds and keeps size bounded at MAX_BUILDER_CACHE_SIZE
    expect(buildUrl("/route_0/:param", { params: { param: "test" } })).toBe("/route_0/test");
    expect(getBuilderCacheSize()).toBe(MAX_BUILDER_CACHE_SIZE);
  });

  it("encodes finite numbers, scientific notation, and optional params accurately (success path)", () => {
    expect(buildUrl("/items/:id", { params: { id: 42 }, search: { scale: 1e21, flag: true } })).toBe(
      "/items/42?scale=1e%2B21&flag=true",
    );
    expect(buildUrl("/users/:id?", { params: {} })).toBe("/users");
    expect(buildUrl("/users/:id?", { params: { id: 7 } })).toBe("/users/7");
  });

  it("rejects non-finite numeric parameters (NaN, Infinity, -Infinity) with RangeError (failure path)", () => {
    expect(() => buildUrl("/users/:id", { params: { id: Number.NaN } })).toThrow(RangeError);
    expect(() => buildUrl("/users/:id", { params: { id: Number.POSITIVE_INFINITY } })).toThrow(
      RangeError,
    );
    expect(() => buildUrl("/users/:id", { params: { id: Number.NEGATIVE_INFINITY } })).toThrow(
      RangeError,
    );
    expect(() =>
      buildUrl("/users/:id", { params: { id: 1 }, search: { page: Number.POSITIVE_INFINITY } }),
    ).toThrow(RangeError);
  });
});

describe("Security Hardening: Malformed Percent-Encoding, Cookie Bypass & Prototype Guards", () => {
  it("handles malformed percent-encoding without throwing URIError in parseFastQueryString and middleware", async () => {
    const parsed = parseFastQueryString("?q=%&bad=%zz&utf=%E0%A4&ok=1");
    expect(parsed.q).toBe("%");
    expect(parsed.bad).toBe("%zz");
    expect(parsed.ok).toBe("1");

    const route = defineRoute({});
    const GET = route.handler(
      { search: v.object({ q: v.string() }) },
      (event) => json({ q: event.search.q }),
    );
    const mw = createMiddleware([
      {
        path: "/api/search",
        $$route: { require: () => ({ route }) },
        $GET: { require: () => ({ GET }) },
      },
    ]);
    const res = await mw(new Request("http://localhost/api/search?q=%"), () => new Response("next"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ q: "%" });
  });

  it("rejects encoded prototype pollution keys in parseRequestCookies", () => {
    const cookies = parseRequestCookies(
      "%5f%5fproto%5f%5f=evil; %63onstructor=bad; %70rototype=pwnd; session=safe",
    );
    expect(cookies.session).toBe("safe");
    expect(Object.hasOwn(cookies, "__proto__")).toBe(false);
    expect(Object.hasOwn(cookies, "constructor")).toBe(false);
    expect(Object.hasOwn(cookies, "prototype")).toBe(false);
  });

  it("ignores __proto__, constructor, and prototype options in problem()", async () => {
    const evilOpts = JSON.parse('{"__proto__":{"polluted":true},"constructor":"bad","prototype":"x","traceId":"t-1"}');
    const res = problem(400, "Invalid", evilOpts);
    const body = await res.json();
    expect(body.traceId).toBe("t-1");
    expect(Object.hasOwn(body, "__proto__")).toBe(false);
    expect(Object.hasOwn(body, "constructor")).toBe(false);
    expect(Object.hasOwn(body, "prototype")).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("ignores inherited prototype keys in serializeFastQuery", () => {
    const proto = { inherited: "evil" };
    const search = Object.assign(Object.create(proto) as Record<string, unknown>, { q: "safe" });
    expect(serializeFastQuery(search)).toBe("q=safe");
  });
});

describe("Security Hardening: Bounded Body Ingestion & Non-Coercing JSON Bodies", () => {
  it("rejects request payloads exceeding maxBodySize via Content-Length and streaming checks", async () => {
    const tooBigHeaderReq = new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "2048" },
      body: "{}",
    });
    const headerRes = await parseRequestBody(tooBigHeaderReq, undefined, 1024);
    expect(headerRes.success).toBe(false);
    expect(headerRes.issues?.[0]?.message).toContain("exceeds maximum allowed size");

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ payload: "x".repeat(500) })));
        controller.close();
      },
    });
    const chunkedReq = new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    const streamRes = await parseRequestBody(chunkedReq, undefined, 128);
    expect(streamRes.success).toBe(false);
    expect(streamRes.issues?.[0]?.message).toContain("exceeds maximum allowed size");

    const form = new FormData();
    form.append("bio", "a".repeat(300));
    const multipartReq = new Request("http://localhost/api/upload", {
      method: "POST",
      body: form,
    });
    const multipartRes = await parseRequestBody(multipartReq, undefined, 128);
    expect(multipartRes.success).toBe(false);
    expect(multipartRes.issues?.[0]?.message).toContain("exceeds maximum allowed size");
  });

  it("redacts raw stream error details in parseRequestBody", async () => {
    const failingStream = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error("ECONNRESET internal socket secret");
      },
    });
    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: failingStream,
      duplex: "half",
    } as RequestInit);
    const res = await parseRequestBody(req);
    expect(res.success).toBe(false);
    expect(res.issues?.[0]?.message).toBe("Failed to read request body stream");
  });

  it("does not coerce string literals into numbers or booleans for JSON bodies while preserving form coercion", async () => {
    const route = defineRoute({});
    const POST = route.handler(
      { body: v.object({ count: v.number(), active: v.boolean() }) },
      (event) => json(event.body),
    );
    const mw = createMiddleware([
      {
        path: "/api/strict-json",
        $$route: { require: () => ({ route }) },
        $POST: { require: () => ({ POST }) },
      },
    ]);

    const jsonRes = await mw(
      new Request("http://localhost/api/strict-json", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: "42", active: "true" }),
      }),
      () => new Response("next"),
    );
    expect(jsonRes.status).toBe(400);

    const formRes = await mw(
      new Request("http://localhost/api/strict-json", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "count=42&active=true",
      }),
      () => new Response("next"),
    );
    expect(formRes.status).toBe(200);
    expect(await formRes.json()).toEqual({ count: 42, active: true });
  });
});

describe("Security Hardening: Redirects, Cross-App URLs & OpenAPI HTML Escaping", () => {
  it("rejects dangerous URI schemes and collapses leading protocol-relative slashes", () => {
    expect(() => redirect("javascript:alert(1)")).toThrow(TypeError);
    expect(() => redirect("  DaTa:text/html,<script>")).toThrow(TypeError);
    expect(() => redirect("vbscript:msgbox(1)")).toThrow(TypeError);

    expect(redirect("//attacker.com/login").headers.get("location")).toBe("/attacker.com/login");
    expect(redirect("https://trusted.example.com/ok").headers.get("location")).toBe(
      "https://trusted.example.com/ok",
    );

    expect(joinBaseAndPath("", "//attacker.com")).toBe("/attacker.com");
    expect(joinBaseAndPath("/", "///attacker.com")).toBe("/attacker.com");
    expect(extractRequestPathname("//attacker.com/path?x=1")).toBe("/attacker.com/path");

    expect(() =>
      navigateCrossApp({ baseUrl: "javascript:alert(1)" }, "/"),
    ).toThrow(TypeError);
  });

  it("escapes single quotes and safely serializes Swagger specUrl inside script tags", async () => {
    const res = await renderOpenAPIUI(
      {
        title: "O'Reilly <API>",
        specUrl: '/spec.json", a: alert(1) }</script><script>alert(2)//',
        spec: { openapi: "3.1.0", info: { title: "O'Reilly", version: "1.0.0" }, paths: {} },
      },
      "swagger",
    );
    const html = await res.text();
    expect(html).toContain("<title>O&#39;Reilly &lt;API&gt;</title>");
    expect(html).not.toContain("</script><script>alert(2)");
    expect(html).toContain("\\u003c/script>");
  });
});
