/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Monomorphic doubly-linked list node holding cache key, value, and structural pointers.
 */
export class LruNode<K, V> {
  public readonly key: K;
  public value: V;
  public prev: LruNode<K, V> | null = null;
  public next: LruNode<K, V> | null = null;

  public constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}

/**
 * High-performance, zero-allocation LRU cache backed by a hash map and doubly-linked list.
 * Preserves O(1) access and eviction without Map tombstone churning or GC write barrier penalties on hits.
 */
export class LruCache<K, V> {
  private readonly capacity: number;
  private readonly map: Map<K, LruNode<K, V>> = new Map();
  private head: LruNode<K, V> | null = null;
  private tail: LruNode<K, V> | null = null;

  public constructor(capacity: number) {
    if (capacity <= 0) {
      throw new RangeError("LruCache capacity must be a positive integer.");
    }
    this.capacity = capacity;
  }

  public get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) {
      return undefined;
    }
    if (node === this.tail) {
      return node.value;
    }

    if (node.prev !== null) {
      node.prev.next = node.next;
    }
    if (node.next !== null) {
      node.next.prev = node.prev;
    }
    if (node === this.head) {
      this.head = node.next;
    }

    node.prev = this.tail;
    node.next = null;
    if (this.tail !== null) {
      this.tail.next = node;
    }
    this.tail = node;
    if (this.head === null) {
      this.head = node;
    }

    return node.value;
  }

  public set(key: K, value: V): void {
    const existing = this.map.get(key);
    if (existing !== undefined) {
      existing.value = value;
      this.get(key);
      return;
    }

    if (this.map.size >= this.capacity) {
      const evict = this.head;
      if (evict !== null) {
        this.map.delete(evict.key);
        this.head = evict.next;
        if (this.head !== null) {
          this.head.prev = null;
        } else {
          this.tail = null;
        }
        evict.prev = null;
        evict.next = null;
      }
    }

    const newNode = new LruNode<K, V>(key, value);
    this.map.set(key, newNode);
    if (this.head === null) {
      this.head = newNode;
      this.tail = newNode;
    } else if (this.tail !== null) {
      this.tail.next = newNode;
      newNode.prev = this.tail;
      this.tail = newNode;
    }
  }

  public has(key: K): boolean {
    return this.map.has(key);
  }

  public get size(): number {
    return this.map.size;
  }

  public clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }
}
