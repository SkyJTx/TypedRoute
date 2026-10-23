/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect } from "vitest";
import { LruCache } from "../src/utils/lru-cache";

describe("LruCache", () => {
  it("rejects non-positive capacity", () => {
    expect(() => new LruCache(0)).toThrow(RangeError);
    expect(() => new LruCache(-5)).toThrow(RangeError);
  });

  it("stores and retrieves key-value entries", () => {
    const cache = new LruCache<string, number>(3);
    cache.set("a", 100);
    cache.set("b", 200);

    expect(cache.get("a")).toBe(100);
    expect(cache.get("b")).toBe(200);
    expect(cache.get("c")).toBeUndefined();
    expect(cache.has("a")).toBe(true);
    expect(cache.has("c")).toBe(false);
    expect(cache.size).toBe(2);
  });

  it("updates existing keys and promotes them to MRU", () => {
    const cache = new LruCache<string, string>(2);
    cache.set("k1", "v1");
    cache.set("k2", "v2");

    // Overwrite k1
    cache.set("k1", "v1-updated");
    expect(cache.size).toBe(2);
    expect(cache.get("k1")).toBe("v1-updated");

    // Adding k3 should evict k2, NOT k1
    cache.set("k3", "v3");
    expect(cache.has("k2")).toBe(false);
    expect(cache.has("k1")).toBe(true);
    expect(cache.has("k3")).toBe(true);
  });

  it("promotes accessed keys on get() and evicts least recently used", () => {
    const cache = new LruCache<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    // Access 'a' -> order becomes b, c, a (a is now MRU, b is LRU)
    expect(cache.get("a")).toBe(1);

    // Insert 'd' -> 'b' should be evicted
    cache.set("d", 4);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
    expect(cache.size).toBe(3);
  });

  it("fast paths subsequent hits on the current tail MRU", () => {
    const cache = new LruCache<string, string>(3);
    cache.set("x", "foo");

    // Multiple consecutive accesses on the same key
    for (let i = 0; i < 100; i++) {
      expect(cache.get("x")).toBe("foo");
    }
  });

  it("clears all entries and resets head/tail pointers", () => {
    const cache = new LruCache<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.has("b")).toBe(false);

    // Should continue functioning after clear
    cache.set("c", 3);
    expect(cache.size).toBe(1);
    expect(cache.get("c")).toBe(3);
  });
});
