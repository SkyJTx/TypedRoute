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

describe("Security Hardening: Bounded LRU Cache (Memory Exhaustion / DoS Defense)", () => {
  beforeEach(() => {
    clearBuilderCache();
  });

  it("caps builderCache size at MAX_BUILDER_CACHE_SIZE (2048)", () => {
    expect(getBuilderCacheSize()).toBe(0);

    // Flood the cache with 3,000 unique dynamically generated route patterns
    for (let i = 0; i < 3_000; i++) {
      buildUrl(`/dynamic_route_${i}/:id`, { params: { id: i } });
    }

    expect(getBuilderCacheSize()).toBe(MAX_BUILDER_CACHE_SIZE);
  });

  it("promotes accessed entries and evicts least recently used patterns first", () => {
    // Fill up to capacity
    for (let i = 0; i < MAX_BUILDER_CACHE_SIZE; i++) {
      buildUrl(`/route_${i}/:param`, { params: { param: "val" } });
    }
    expect(getBuilderCacheSize()).toBe(MAX_BUILDER_CACHE_SIZE);

    // Re-access route_0 to promote it to MRU
    buildUrl("/route_0/:param", { params: { param: "val" } });

    // Insert a new pattern: should evict route_1, NOT route_0
    buildUrl("/route_brand_new/:param", { params: { param: "val" } });
    expect(getBuilderCacheSize()).toBe(MAX_BUILDER_CACHE_SIZE);

    // Route 0 is still in cache
    expect(buildUrl("/route_0/:param", { params: { param: "test" } })).toBe("/route_0/test");
  });
});
