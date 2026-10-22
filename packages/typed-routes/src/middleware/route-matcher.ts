/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {
  FileRouteHandlers,
  APIHandler,
  APIHandlerRef,
} from "filesystem-routing/api";
import type {
  MiddlewareHandlerRef,
  MiddlewareRouteEntry,
} from "../types/route-definition";
import {
  ROUTE_FLAG_NONE,
  ROUTE_FLAG_IS_PAGE,
  ROUTE_FLAG_VALIDATION_ONLY,
} from "../debug/inspect";
import { RouteNodeMeta, extractRouteConfig } from "./route-meta";

export type HttpMethod =
  | "HEAD"
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "QUERY"
  | "OPTIONS";

export const httpHandlerKeys = [
  "$HEAD",
  "$GET",
  "$POST",
  "$PUT",
  "$PATCH",
  "$DELETE",
  "$QUERY",
  "$OPTIONS",
] as const;

export type HttpMethodKey = (typeof httpHandlerKeys)[number];

const EMPTY_HANDLER_MAP: Record<string, APIHandler> = Object.freeze({});

function returnEmptyHandlers(): Record<string, APIHandler> {
  return EMPTY_HANDLER_MAP;
}

const UNREGISTERED_HEAD_PLACEHOLDER: APIHandlerRef = Object.freeze({
  require: returnEmptyHandlers,
});

/**
 * Normalizes a filesystem-routing path template into the radix3 pattern format.
 */
export function toRadixPath(rawPath: string): string {
  return rawPath
    .replace(/\([^)/]+\)/g, "")
    .replace(/\/+/g, "/")
    .replace(/\*([^/]*)/g, (_, m: string) => `**:${m}`)
    .split("/")
    .map((s) => (s.startsWith(":") || s.startsWith("*") ? s : encodeURIComponent(s)))
    .join("/");
}

/**
 * Extracts callable HTTP method handlers (`GET`, `POST`, etc.) from a loaded route module object
 * without allocating `Object.entries` tuples or wrapper closures.
 */
function extractHandlersFromModule(mod: object): Record<string, APIHandler> {
  const handlers: Record<string, APIHandler> = {};
  const record = mod as Record<string, unknown>;
  for (const exportName in record) {
    const exportValue = record[exportName];
    if (typeof exportValue === "function") {
      handlers[exportName] = exportValue as APIHandler;
    }
  }
  return handlers;
}

/**
 * Adapts a `MiddlewareHandlerRef` into a memoized `filesystem-routing/api` `APIHandlerRef`.
 * Caches the extracted handler table after first resolution so hot-path requests incur zero allocations.
 */
export function toApiHandlerRef(ref: MiddlewareHandlerRef): APIHandlerRef {
  let cachedHandlers: Record<string, APIHandler> | null = null;
  if ("require" in ref) {
    return {
      require: function requireCachedHandlers(): Record<string, APIHandler> {
        if (cachedHandlers !== null) {
          return cachedHandlers;
        }
        cachedHandlers = extractHandlersFromModule(ref.require());
        return cachedHandlers;
      },
    };
  }
  return {
    import: async function importCachedHandlers(): Promise<Record<string, APIHandler>> {
      if (cachedHandlers !== null) {
        return cachedHandlers;
      }
      cachedHandlers = extractHandlersFromModule(await ref.import());
      return cachedHandlers;
    },
  };
}

/**
 * Builds normalized `FileRouteHandlers` for `createAPIMatcher` and populates the
 * `handlerMetadata` lookup table mapping each `APIHandlerRef` to its monomorphic `RouteNodeMeta`.
 */
export function buildMatcherAndMetadata(routes: readonly MiddlewareRouteEntry[]): {
  matcherRoutes: readonly FileRouteHandlers[];
  handlerMetadata: WeakMap<APIHandlerRef, RouteNodeMeta>;
} {
  const handlerMetadata = new WeakMap<APIHandlerRef, RouteNodeMeta>();
  const seenRadixPaths = new Set<string>();
  const routeLen = routes.length;

  for (let i = 0; i < routeLen; i++) {
    const route = routes[i];
    const hasAnyHttp = Boolean(
      route.$HEAD ||
        route.$GET ||
        route.$POST ||
        route.$PUT ||
        route.$PATCH ||
        route.$DELETE ||
        route.$QUERY ||
        route.$OPTIONS,
    );
    if (hasAnyHttp) {
      seenRadixPaths.add(toRadixPath(route.path));
    }
  }

  const matcherRoutes: FileRouteHandlers[] = [];
  const keyLen = httpHandlerKeys.length;

  for (let i = 0; i < routeLen; i++) {
    const route = routes[i];
    const eagerConfig = extractRouteConfig(route);
    const entry: FileRouteHandlers = {
      path: route.path,
      page: route.page,
      $component: route.$component,
    };

    for (let k = 0; k < keyLen; k++) {
      const key = httpHandlerKeys[k];
      const rawRef = route[key];
      if (rawRef) {
        const apiRef = toApiHandlerRef(rawRef);
        entry[key] = apiRef;
        const baseFlags =
          route.page === true && (key === "$GET" || key === "$HEAD")
            ? ROUTE_FLAG_IS_PAGE
            : ROUTE_FLAG_NONE;
        handlerMetadata.set(apiRef, new RouteNodeMeta(route, baseFlags, eagerConfig));
      }
    }

    const hasStandardHttp = Boolean(
      route.$HEAD || route.$GET || route.$POST || route.$PUT || route.$PATCH || route.$DELETE,
    );
    const hasAdditionalHttp = Boolean(route.$QUERY || route.$OPTIONS);

    if (!hasStandardHttp && hasAdditionalHttp) {
      entry.$HEAD = UNREGISTERED_HEAD_PLACEHOLDER;
    }

    if (!hasStandardHttp && !hasAdditionalHttp && route.page === true && route.$$route) {
      const radixPath = toRadixPath(route.path);
      if (radixPath && !seenRadixPaths.has(radixPath) && !/:[^/]*\?/g.test(radixPath)) {
        seenRadixPaths.add(radixPath);
        const pageValidationRef: APIHandlerRef = { require: returnEmptyHandlers };
        entry.$GET = pageValidationRef;
        handlerMetadata.set(
          pageValidationRef,
          new RouteNodeMeta(
            route,
            ROUTE_FLAG_IS_PAGE | ROUTE_FLAG_VALIDATION_ONLY,
            eagerConfig,
          ),
        );
      }
    }

    matcherRoutes.push(entry);
  }

  return { matcherRoutes, handlerMetadata };
}