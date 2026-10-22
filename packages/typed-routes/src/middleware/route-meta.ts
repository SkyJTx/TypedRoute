/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { RouteConfig, MiddlewareRouteEntry } from "~/types/route-definition";
import {
  CUSTOM_INSPECT_SYMBOL,
  ROUTE_FLAG_CONFIG_RESOLVED,
  ROUTE_FLAG_HAS_PARAMS_SCHEMA,
  ROUTE_FLAG_HAS_SEARCH_SCHEMA,
  formatRouteFlags,
  inspectRoute,
  type InspectableRouteConfig,
} from "~/debug/inspect";

/**
 * Runtime guard narrowing an unknown value to a non-null key-value record.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Monomorphic metadata node associated with each radix-indexed `APIHandlerRef`.
 *
 * Memory Layout:
 * - Uses a 31-bit Small Integer (`Smi`) `flags` field instead of multiple boolean properties.
 * - Pre-initializes all 3 in-object slots (`route`, `flags`, `config`) in the constructor
 *   so lazy `config` resolution never triggers a V8 Map or JavaScriptCore Structure transition.
 */
export class RouteNodeMeta {
  public readonly route: MiddlewareRouteEntry;
  public flags: number;
  public config: RouteConfig | undefined;

  public constructor(
    route: MiddlewareRouteEntry,
    baseFlags: number,
    config: InspectableRouteConfig | undefined,
  ) {
    let computedFlags = baseFlags;
    if (config !== undefined) {
      computedFlags |= ROUTE_FLAG_CONFIG_RESOLVED;
      if (config.params !== undefined) {
        computedFlags |= ROUTE_FLAG_HAS_PARAMS_SCHEMA;
      }
      if (config.search !== undefined) {
        computedFlags |= ROUTE_FLAG_HAS_SEARCH_SCHEMA;
      }
    }
    this.route = route;
    this.flags = computedFlags;
    this.config = config as RouteConfig | undefined;
  }

  public [CUSTOM_INSPECT_SYMBOL](): Record<string, unknown> {
    return {
      [Symbol.toStringTag]: "RouteNodeMeta",
      path: this.route.path,
      flags: formatRouteFlags(this.flags),
      config: this.config ? inspectRoute(this.config) : null,
    };
  }
}

/**
 * Extracts `RouteConfig` from a route entry's `$$route.require()` reference if available.
 */
export function extractRouteConfig(route: MiddlewareRouteEntry): RouteConfig | undefined {
  if (!route.$$route) {
    return undefined;
  }
  try {
    const mod = route.$$route.require();
    if (!isRecord(mod)) {
      return undefined;
    }
    const routeExport = mod.route;
    if (isRecord(routeExport)) {
      if ("config" in routeExport && isRecord(routeExport.config)) {
        return routeExport.config as RouteConfig;
      }
      return routeExport as RouteConfig;
    }
  } catch {
    // Module may still be evaluating during circular SSR import; resolved lazily on request.
  }
  return undefined;
}

/**
 * Resolves and caches `RouteConfig` and schema Smi bitflags for a matched route metadata node.
 */
export function resolveRouteConfig(meta: RouteNodeMeta): RouteConfig | undefined {
  if ((meta.flags & ROUTE_FLAG_CONFIG_RESOLVED) !== 0) {
    return meta.config;
  }
  if (!meta.route.$$route) {
    meta.flags |= ROUTE_FLAG_CONFIG_RESOLVED;
    return undefined;
  }
  const resolved = extractRouteConfig(meta.route);
  if (resolved) {
    meta.config = resolved;
    let nextFlags = meta.flags | ROUTE_FLAG_CONFIG_RESOLVED;
    if (resolved.params !== undefined) {
      nextFlags |= ROUTE_FLAG_HAS_PARAMS_SCHEMA;
    }
    if (resolved.search !== undefined) {
      nextFlags |= ROUTE_FLAG_HAS_SEARCH_SCHEMA;
    }
    meta.flags = nextFlags;
  }
  return resolved;
}