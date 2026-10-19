import {
  createAPIMatcher,
  stripPathBase,
  type FileRouteHandlers,
  type APIEvent,
} from "filesystem-routing/api";
import type { RouteConfig } from "../types/route-definition";
import { RouteValidationError } from "../types/route-definition";
import { validateData } from "../schema/validator-adapter";
import { normalizeSearchParams } from "../schema/coercion";

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

const placeholderHandler = { require: () => ({}) };

/**
 * Normalizes routes so methods like QUERY and OPTIONS are indexed by radix matcher when other HTTP methods are absent.
 */
function normalizeRoutesForMatcher(routes: readonly FileRouteHandlers[]): readonly FileRouteHandlers[] {
  return routes.map((route) => {
    const hasStandardHttp = Boolean(
      route.$HEAD || route.$GET || route.$POST || route.$PUT || route.$PATCH || route.$DELETE,
    );
    const hasAdditionalHttp = Boolean(route.$QUERY || (route as Record<string, unknown>).$OPTIONS);
    if (!hasStandardHttp && hasAdditionalHttp) {
      return {
        ...route,
        $HEAD: placeholderHandler,
      };
    }
    return route;
  });
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
   */
  onValidationError?: (args: {
    error: RouteValidationError;
    rawParams: Record<string, string | undefined>;
    rawSearch: Record<string, unknown>;
    request: Request;
  }) => Response | Promise<Response> | void;
}

const RequestContext = Symbol.for("solid.RequestContext");

function getScopedEvent(): APIEvent {
  const store = (globalThis as Record<symbol, { getStore?(): APIEvent } | undefined>)[RequestContext]?.getStore?.();
  if (!store) {
    return { request: new Request("http://localhost/") } as APIEvent;
  }
  return store;
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
 * Creates fetch middleware that validates request parameters and search queries against route schemas.
 */
export function createMiddleware(
  routes: readonly FileRouteHandlers[],
  options: MiddlewareOptions = {},
): (request: Request, next: (request?: Request) => Response | Promise<Response>) => Promise<Response> {
  const normalizedRoutes = normalizeRoutesForMatcher(routes);
  const match = createAPIMatcher(normalizedRoutes);
  const getEvent = options.getEvent ?? getScopedEvent;

  const handlerToConfig = new WeakMap<object, RouteConfig>();
  for (const route of routes) {
    const routeExport = (route as { $$route?: { require?: () => { route?: unknown } } }).$$route?.require?.()?.route;
    const config: RouteConfig | undefined =
      routeExport && typeof routeExport === "object"
        ? "config" in routeExport
          ? (routeExport.config as RouteConfig)
          : (routeExport as RouteConfig)
        : undefined;

    if (config) {
      for (const key of httpHandlerKeys) {
        const handlerRef = (route as Record<string, unknown>)[key];
        if (handlerRef && typeof handlerRef === "object") {
          handlerToConfig.set(handlerRef, config);
        }
      }
    }
  }

  return async (
    request: Request,
    next: (request?: Request) => Response | Promise<Response>,
  ): Promise<Response> => {
    const url = new URL(request.url);
    const pathname = stripPathBase(url.pathname, options.base ?? "/");
    const matched = match(pathname, request.method);

    if (!matched) {
      return next(request);
    }

    const config = handlerToConfig.get(matched.handler);
    const rawParams: Record<string, string | undefined> = matched.params ?? {};
    const rawSearch: Record<string, unknown> = normalizeSearchParams(url.searchParams);

    let validatedParams: unknown = rawParams;
    let validatedSearch: unknown = rawSearch;

    if (config?.params) {
      const paramsResult = validateData(config.params, rawParams);
      if (!paramsResult.success) {
        const error = new RouteValidationError("params", paramsResult.issues ?? []);
        if (config.onError) {
          config.onError({ error, rawParams, rawSearch });
        }
        if (options.onValidationError) {
          const customResponse = await options.onValidationError({ error, rawParams, rawSearch, request });
          if (customResponse instanceof Response) {
            return customResponse;
          }
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
        const error = new RouteValidationError("search", searchResult.issues ?? []);
        if (config.onError) {
          config.onError({ error, rawParams, rawSearch });
        }
        if (options.onValidationError) {
          const customResponse = await options.onValidationError({ error, rawParams, rawSearch, request });
          if (customResponse instanceof Response) {
            return customResponse;
          }
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

    const mod = "require" in matched.handler ? matched.handler.require() : await matched.handler.import();
    const handlerFn = request.method === "HEAD" ? mod.HEAD || mod.GET : mod[request.method];

    if (typeof handlerFn !== "function") {
      return next(request);
    }

    let event: APIEvent;
    try {
      event = getEvent();
    } catch {
      event = { request } as APIEvent;
    }

    event.request = request;
    event.params = validatedParams as Record<string, string>;
    (event as unknown as Record<string, unknown>).search = validatedSearch;

    const result = await handlerFn(event);

    if (result !== undefined) {
      return toResponse(result);
    }

    if (request.method !== "GET") {
      throw new Error(`API handler for ${request.method} "${request.url}" did not return a response.`);
    }

    if (!matched.isPage) {
      return new Response(null, { status: 404 });
    }

    return next(request);
  };
}