/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  parseFastQueryString,
  normalizeSearchParams,
  coerceRecord,
  parseFastUrl,
  buildUrl,
  clearBuilderCache,
  getBuilderCacheSize,
  MAX_BUILDER_CACHE_SIZE,
} from "../src/index";

describe("Security Hardening: Prototype Pollution Defense", () => {
  it("drops dangerous prototype keys (__proto__, constructor, prototype) in parseFastQueryString", () => {
    const raw = "?__proto__[polluted]=true&__proto__=evil&constructor=hacked&prototype=pwnd&safe=valid";
    const result = parseFastQueryString(raw);

    expect(result.safe).toBe("valid");
    expect((result as Record<string, unknown>).__proto__).not.toBe("evil");
    expect((result as Record<string, unknown>).constructor).toBe(Object);
    expect((result as Record<string, unknown>).prototype).toBeUndefined();

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
