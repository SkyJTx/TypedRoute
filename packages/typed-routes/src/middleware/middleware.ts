/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  createAPIMatcher,
  stripPathBase,
  type FileRouteHandlers,
  type APIHandler,
  type APIHandlerRef,
  type APIEvent,
} from "filesystem-routing/api";
import type {
  RouteConfig,
  MiddlewareHandlerRef,
  MiddlewareRouteEntry,
} from "../types/route-definition";
import { RouteValidationError } from "../types/route-definition";
import { validateData } from "../schema/validator-adapter";
import { parseFastQueryString } from "../schema/coercion";

export type HttpMethod =
  | "HEAD"
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "QUERY"
  | "OPTIONS";

const httpHandlerKeys = [
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

export type MiddlewareInput = Request | { request: Request; [key: string]: unknown };

export type MiddlewareNext = (request?: Request) => Response | Promise<Response>;

/**
 * Runtime guard narrowing an unknown value to a non-null key-value record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Extracts the underlying `Request` instance from either a raw `Request` or a framework `RequestEvent`.
 */
function extractRequest(input: MiddlewareInput): Request {
  if (input instanceof Request) {
    return input;
  }
  return input.request;
}

/**
 * Normalizes a filesystem-routing path template into the radix3 pattern format.
 */
function toRadixPath(rawPath: string): string {
  return rawPath
    .replace(/\([^)/]+\)/g, "")
    .replace(/\/+/g, "/")
    .replace(/\*([^/]*)/g, (_, m: string) => `**:${m}`)
    .split("/")
    .map((s) => (s.startsWith(":") || s.startsWith("*") ? s : encodeURIComponent(s)))
    .join("/");
}

/**
 * Internal metadata associated with each radix-indexed `APIHandlerRef`.
 *
 * Tracking `isPage` and `isValidationOnlyPage` explicitly per handler reference
 * decouples `createMiddleware` from `filesystem-routing/api`'s internal
 * `route.page === true && route.$component !== undefined` heuristic and avoids
 * mutating `$component` or executing synthetic handler functions.
 */
interface MatchedRouteMetadata {
  /** Original route entry from `virtual:file-routes`. */
  readonly route: MiddlewareRouteEntry;
  /**
   * True when this handler slot represents a UI page navigation (`route.page === true`
   * on a `GET` or `HEAD` request) rather than a standalone API endpoint.
   */
  readonly isPage: boolean;
  /**
   * True when this handler slot is a synthetic validation-only slot created for a
   * schema-validated UI page (`page: true` with `$$route` and no explicit `$GET` handler).
   */
  readonly isValidationOnlyPage: boolean;
  /** Cached `RouteConfig` extracted from `route.$$route`. */
  config?: RouteConfig;
}

/**
 * Extracts `RouteConfig` from a route entry's `$$route.require()` reference if available.
 */
function extractRouteConfig(route: MiddlewareRouteEntry): RouteConfig | undefined {
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
 * Resolves and caches `RouteConfig` for a matched route metadata entry.
 */
function resolveRouteConfig(meta: MatchedRouteMetadata): RouteConfig | undefined {
  if (meta.config) {
    return meta.config;
  }
  const resolved = extractRouteConfig(meta.route);
  if (resolved) {
    meta.config = resolved;
  }
  return resolved;
}

/**
 * Extracts callable HTTP method handlers (`GET`, `POST`, etc.) from a loaded route module object.
 */
function extractHandlersFromModule(mod: object): Record<string, APIHandler> {
  const handlers: Record<string, APIHandler> = {};
  for (const [exportName, exportValue] of Object.entries(mod)) {
    if (typeof exportValue === "function") {
      handlers[exportName] = (event: APIEvent) =>
        (exportValue as (ev: APIEvent) => unknown)(event);
    }
  }
  return handlers;
}

/**
 * Adapts a `MiddlewareHandlerRef` into a `filesystem-routing/api` `APIHandlerRef`.
 */
function toApiHandlerRef(ref: MiddlewareHandlerRef): APIHandlerRef {
  if ("require" in ref) {
    return {
      require: () => extractHandlersFromModule(ref.require()),
    };
  }
  return {
    import: async () => extractHandlersFromModule(await ref.import()),
  };
}

/**
 * Builds normalized `FileRouteHandlers` for `createAPIMatcher` and populates the
 * `handlerMetadata` lookup table mapping each `APIHandlerRef` to its `MatchedRouteMetadata`.
 */
function buildMatcherAndMetadata(routes: readonly MiddlewareRouteEntry[]): {
  matcherRoutes: readonly FileRouteHandlers[];
  handlerMetadata: WeakMap<APIHandlerRef, MatchedRouteMetadata>;
} {
  const handlerMetadata = new WeakMap<APIHandlerRef, MatchedRouteMetadata>();
  const seenRadixPaths = new Set<string>();

  for (const route of routes) {
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

  const matcherRoutes: FileRouteHandlers[] = routes.map((route) => {
    const eagerConfig = extractRouteConfig(route);
    const entry: FileRouteHandlers = {
      path: route.path,
      page: route.page,
      $component: route.$component,
    };

    for (const key of httpHandlerKeys) {
      const rawRef = route[key];
      if (rawRef) {
        const apiRef = toApiHandlerRef(rawRef);
        entry[key] = apiRef;
        handlerMetadata.set(apiRef, {
          route,
          isPage: route.page === true && (key === "$GET" || key === "$HEAD"),
          isValidationOnlyPage: false,
          config: eagerConfig,
        });
      }
    }

    const hasStandardHttp = Boolean(
      route.$HEAD || route.$GET || route.$POST || route.$PUT || route.$PATCH || route.$DELETE,
    );
    const hasAdditionalHttp = Boolean(route.$QUERY || route.$OPTIONS);

    // `createAPIMatcher` only indexes routes in radix3 when at least one of the 6 standard
    // HTTP keys is defined. For `$QUERY`/`$OPTIONS`-only routes, attach an unregistered
    // `$HEAD` placeholder so radix3 indexes the path while `handlerMetadata` ignores `HEAD`.
    if (!hasStandardHttp && hasAdditionalHttp) {
      entry.$HEAD = { require: () => ({}) };
    }

    // For schema-validated UI page routes (`page: true` with `$$route` and no HTTP handlers),
    // register a validation-only `$GET` slot so `GET`/`HEAD` page requests run schema validation.
    if (!hasStandardHttp && !hasAdditionalHttp && route.page === true && route.$$route) {
      const radixPath = toRadixPath(route.path);
      if (radixPath && !seenRadixPaths.has(radixPath) && !/:[^/]*\?/g.test(radixPath)) {
        seenRadixPaths.add(radixPath);
        const pageValidationRef: APIHandlerRef = { require: () => ({}) };
        entry.$GET = pageValidationRef;
        handlerMetadata.set(pageValidationRef, {
          route,
          isPage: true,
          isValidationOnlyPage: true,
          config: eagerConfig,
        });
      }
    }

    return entry;
  });

  return { matcherRoutes, handlerMetadata };
}

/**
 * Options for request middleware.
 */
export interface MiddlewareOptions {
  /**
   * Base path stripped from URLs prior to matching.
   */
  base?: string;
  /**
   * Custom supplier for the request event.
   */
  getEvent?: () => APIEvent;
  /**
   * Callback invoked on validation failure. Returning a Response terminates the chain.
   * For UI page routes (`isPage: true`), returning `void`/`undefined` allows the request
   * to proceed to SSR where the route's `errorComponent` handles the error.
   */
  onValidationError?: (args: {
    error: RouteValidationError;
    rawParams: Record<string, string | undefined>;
    rawSearch: Record<string, unknown>;
    request: Request;
    isPage: boolean;
  }) => Response | Promise<Response | void> | void;
}

const RequestContext = Symbol.for("solid.RequestContext");

function getScopedEvent(): APIEvent {
  const store = (globalThis as Record<symbol, { getStore?(): APIEvent } | undefined>)[RequestContext]?.getStore?.();
  if (!store) {
    return { request: new Request("http://localhost/") };
  }
  return store;
}

function resolveRequestEvent(
  eventOrRequest: MiddlewareInput,
  request: Request,
  getEvent: () => APIEvent,
): APIEvent {
  if (!(eventOrRequest instanceof Request)) {
    return eventOrRequest;
  }
  try {
    return getEvent();
  } catch {
    return { request };
  }
}

function toResponse(result: unknown): Response {
  if (result instanceof Response) {
    return result;
  }
  if (typeof result === "string") {
    return new Response(result);
  }
  return Response.json(result);
}

/**
 * Fast ASCII URL scanner that extracts pathname and query string without C++ host allocations.
 */
export function parseFastUrl(urlStr: string, base: string = "/"): { pathname: string; searchStr: string } {
  const protoEnd = urlStr.indexOf("://");
  const hostStart = protoEnd === -1 ? 0 : protoEnd + 3;
  const pathStart = urlStr.indexOf("/", hostStart);

  if (pathStart === -1) {
    const qIdx = urlStr.indexOf("?", hostStart);
    if (qIdx === -1) {
      return { pathname: stripPathBase("/", base), searchStr: "" };
    }
    const hIdx = urlStr.indexOf("#", qIdx + 1);
    const searchStr = hIdx === -1 ? urlStr.slice(qIdx + 1) : urlStr.slice(qIdx + 1, hIdx);
    return { pathname: stripPathBase("/", base), searchStr };
  }

  const qIdx = urlStr.indexOf("?", pathStart);
  if (qIdx === -1) {
    const hIdx = urlStr.indexOf("#", pathStart);
    const rawPath = hIdx === -1 ? urlStr.slice(pathStart) : urlStr.slice(pathStart, hIdx);
    return { pathname: stripPathBase(rawPath, base), searchStr: "" };
  }

  const rawPath = urlStr.slice(pathStart, qIdx);
  const hIdx = urlStr.indexOf("#", qIdx + 1);
  const searchStr = hIdx === -1 ? urlStr.slice(qIdx + 1) : urlStr.slice(qIdx + 1, hIdx);

  return { pathname: stripPathBase(rawPath, base), searchStr };
}

/**
 * Creates fetch middleware that validates request parameters and search queries against route schemas.
 */
export function createMiddleware(
  routes: readonly MiddlewareRouteEntry[],
  options: MiddlewareOptions = {},
): (eventOrRequest: MiddlewareInput, next: MiddlewareNext) => Promise<Response> {
  const { matcherRoutes, handlerMetadata } = buildMatcherAndMetadata(routes);
  const match = createAPIMatcher(matcherRoutes);
  const getEvent = options.getEvent ?? getScopedEvent;

  return async (
    eventOrRequest: MiddlewareInput,
    next: MiddlewareNext,
  ): Promise<Response> => {
    const request = extractRequest(eventOrRequest);
    const { pathname, searchStr } = parseFastUrl(request.url, options.base ?? "/");
    const matched = match(pathname, request.method);

    if (!matched) {
      return next();
    }

    const meta = handlerMetadata.get(matched.handler);
    if (!meta) {
      return next();
    }

    const isPage = meta.isPage && (request.method === "GET" || request.method === "HEAD");
    const config = resolveRouteConfig(meta);
    const rawParams: Record<string, string | undefined> = matched.params ?? {};
    const rawSearch: Record<string, unknown> = searchStr ? parseFastQueryString(searchStr) : {};

    let validatedParams: unknown = rawParams;
    let validatedSearch: unknown = rawSearch;

    if (config?.params) {
      const paramsResult = validateData(config.params, rawParams);
      if (!paramsResult.success) {
        const error = new RouteValidationError("params", paramsResult.issues ?? [], {
          rawParams,
          rawSearch,
        });
        if (config.onError) {
          config.onError({ error, rawParams, rawSearch });
        }
        if (options.onValidationError) {
          const customResponse = await options.onValidationError({
            error,
            rawParams,
            rawSearch,
            request,
            isPage,
          });
          if (customResponse instanceof Response) {
            return customResponse;
          }
        }
        if (isPage) {
          const event = resolveRequestEvent(eventOrRequest, request, getEvent);
          event.validationError = error;
          return next();
        }
        return Response.json(
          {
            error: "Validation Failed",
            target: "params",
            issues: paramsResult.issues ?? [],
          },
          { status: 400 },
        );
      }
      validatedParams = paramsResult.data;
    }

    if (config?.search) {
      const searchResult = validateData(config.search, rawSearch);
      if (!searchResult.success) {
        const error = new RouteValidationError("search", searchResult.issues ?? [], {
          rawParams,
          rawSearch,
        });
        if (config.onError) {
          config.onError({ error, rawParams, rawSearch });
        }
        if (options.onValidationError) {
          const customResponse = await options.onValidationError({
            error,
            rawParams,
            rawSearch,
            request,
            isPage,
          });
          if (customResponse instanceof Response) {
            return customResponse;
          }
        }
        if (isPage) {
          const event = resolveRequestEvent(eventOrRequest, request, getEvent);
          event.validationError = error;
          return next();
        }
        return Response.json(
          {
            error: "Validation Failed",
            target: "search",
            issues: searchResult.issues ?? [],
          },
          { status: 400 },
        );
      }
      validatedSearch = searchResult.data;
    }

    const event = resolveRequestEvent(eventOrRequest, request, getEvent);
    event.request = request;
    event.params = validatedParams as Record<string, string>;
    event.search = validatedSearch;

    // Schema-validated UI page routes without explicit HTTP handlers proceed directly to SSR.
    if (meta.isValidationOnlyPage) {
      return next();
    }

    const mod = "require" in matched.handler ? matched.handler.require() : await matched.handler.import();
    const handlerFn = request.method === "HEAD" ? mod.HEAD || mod.GET : mod[request.method];

    if (typeof handlerFn !== "function") {
      return next();
    }

    const result = await handlerFn(event);

    if (result !== undefined) {
      return toResponse(result);
    }

    if (request.method !== "GET") {
      throw new Error(`API handler for ${request.method} "${request.url}" did not return a response.`);
    }

    if (!isPage) {
      return new Response(null, { status: 404 });
    }

    return next();
  };
}