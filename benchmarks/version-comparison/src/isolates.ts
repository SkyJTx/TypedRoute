/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  compilePathBuilder,
  type CompiledPathBuilder,
  type MiddlewareRouteEntry,
  type MiddlewareInput,
  type MiddlewareNext,
  type MiddlewareOptions,
  type ParsedUrl,
  EMPTY_RECORD,
  compileValidator,
} from "@skyjt/typed-routes";
import {
  createAPIMatcher,
  stripPathBase,
  type APIEvent,
  type FileRouteHandlers,
  type APIHandlerRef,
} from "filesystem-routing/api";

// ============================================================================
// ISOLATE 1: Static URL Construction with Zero-Option Fast-Pathing
// ============================================================================
interface EnhancedCompiledPathBuilder extends CompiledPathBuilder {
  staticPath?: string;
}

const fastBuilderCache = new Map<string, EnhancedCompiledPathBuilder>();

export function buildUrlStaticFast(
  pattern: string,
  options?: {
    params?: Record<string, unknown>;
    search?: Record<string, unknown>;
    hash?: string;
  },
): string {
  let builder = fastBuilderCache.get(pattern);
  if (!builder) {
    const compiled = compilePathBuilder(pattern) as EnhancedCompiledPathBuilder;
    try {
      const probe1 = compiled();
      const probe2 = compiled({ anyParam: "val" });
      if (probe1 === probe2) {
        compiled.staticPath = probe1;
      }
    } catch {
      // Route has required dynamic params
    }
    builder = compiled;
    fastBuilderCache.set(pattern, builder);
  }

  // Fast-path: When no options are provided and the route is static, return precomputed string
  if (!options) {
    if (builder.staticPath !== undefined) {
      return builder.staticPath;
    }
    return builder();
  }

  return builder(options.params, options.search, options.hash);
}

// ============================================================================
// ISOLATE 2: URL Parsing with Path-First ASCII Protocol Short-Circuit
// ============================================================================
export function parseFastUrlPathFirst(urlStr: string, base: string = "/"): ParsedUrl {
  let pathStart = 0;

  // Short-circuit: relative or pathname-only URLs starting with '/'
  if (urlStr.charCodeAt(0) === 47) {
    pathStart = 0;
  } else {
    const protoEnd = urlStr.indexOf("://");
    const hostStart = protoEnd === -1 ? 0 : protoEnd + 3;
    pathStart = urlStr.indexOf("/", hostStart);

    if (pathStart === -1) {
      const qIdx = urlStr.indexOf("?", hostStart);
      if (qIdx === -1) {
        return { pathname: base === "/" ? "/" : stripPathBase("/", base), searchStr: "" };
      }
      const hIdx = urlStr.indexOf("#", qIdx + 1);
      const searchStr = hIdx === -1 ? urlStr.slice(qIdx + 1) : urlStr.slice(qIdx + 1, hIdx);
      return { pathname: base === "/" ? "/" : stripPathBase("/", base), searchStr };
    }
  }

  const qIdx = urlStr.indexOf("?", pathStart);
  if (qIdx === -1) {
    const hIdx = urlStr.indexOf("#", pathStart);
    const rawPath = hIdx === -1 ? urlStr.slice(pathStart) : urlStr.slice(pathStart, hIdx);
    return { pathname: base === "/" ? rawPath : stripPathBase(rawPath, base), searchStr: "" };
  }

  const rawPath = urlStr.slice(pathStart, qIdx);
  const hIdx = urlStr.indexOf("#", qIdx + 1);
  const searchStr = hIdx === -1 ? urlStr.slice(qIdx + 1) : urlStr.slice(qIdx + 1, hIdx);

  return { pathname: base === "/" ? rawPath : stripPathBase(rawPath, base), searchStr };
}

// ============================================================================
// ISOLATE 3: Prototype-Free Query Parser & Fast Decode
// ============================================================================
function decodeQueryComponentFast(str: string): string {
  const hasPercent = str.indexOf("%") !== -1;
  const hasPlus = str.indexOf("+") !== -1;
  if (!hasPercent && !hasPlus) {
    return str;
  }
  const unplussed = hasPlus ? str.split("+").join(" ") : str;
  return hasPercent ? decodeURIComponent(unplussed) : unplussed;
}

function appendParamNullProto(result: Record<string, unknown>, key: string, value: string): void {
  const existing = result[key];
  if (existing !== undefined) {
    if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  } else {
    result[key] = value;
  }
}

export function parseFastQueryNullProto(searchStr: string): Record<string, unknown> {
  if (!searchStr) {
    return Object.create(null);
  }
  const startOffset = searchStr.charCodeAt(0) === 63 ? 1 : 0;
  const len = searchStr.length;
  if (startOffset >= len) {
    return Object.create(null);
  }

  const result: Record<string, unknown> = Object.create(null);
  let start = startOffset;

  while (start < len) {
    let ampIdx = searchStr.indexOf("&", start);
    if (ampIdx === -1) {
      ampIdx = len;
    }

    const eqIdx = searchStr.indexOf("=", start);
    if (eqIdx === -1 || eqIdx > ampIdx) {
      if (ampIdx > start) {
        const rawKey = searchStr.slice(start, ampIdx);
        const key = decodeQueryComponentFast(rawKey);
        appendParamNullProto(result, key, "");
      }
    } else {
      if (eqIdx > start) {
        const rawKey = searchStr.slice(start, eqIdx);
        const rawVal = searchStr.slice(eqIdx + 1, ampIdx);
        const key = decodeQueryComponentFast(rawKey);
        const val = decodeQueryComponentFast(rawVal);
        appendParamNullProto(result, key, val);
      }
    }

    start = ampIdx + 1;
  }

  return result;
}

export function normalizeSearchParamsNullProto(
  input: string | URLSearchParams | Record<string, string | string[] | undefined>,
): Record<string, unknown> {
  if (typeof input === "string") {
    return parseFastQueryNullProto(input);
  }

  if (input instanceof URLSearchParams) {
    const result: Record<string, unknown> = Object.create(null);
    for (const [key, value] of input.entries()) {
      appendParamNullProto(result, key, value);
    }
    return result;
  }

  const result: Record<string, unknown> = Object.create(null);
  for (const key in input) {
    const value = input[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// ============================================================================
// ISOLATE 4: Streamlined Middleware Pipeline
// ============================================================================
const RequestContext = Symbol.for("solid.RequestContext");

function getScopedEventStreamlined(request: Request): APIEvent {
  const store = (
    globalThis as Record<symbol, { getStore?(): APIEvent } | undefined>
  )[RequestContext]?.getStore?.();
  if (!store) {
    // Zero-allocation fallback: reuses the incoming request rather than allocating new Request()
    return { request };
  }
  return store;
}

function toResponseFast(result: unknown): Response {
  if (result instanceof Response) {
    return result;
  }
  if (typeof result === "string") {
    return new Response(result);
  }
  return Response.json(result);
}

export function createStreamlinedMiddleware(
  routes: readonly MiddlewareRouteEntry[],
  options: MiddlewareOptions = {},
): (eventOrRequest: MiddlewareInput, next: MiddlewareNext) => Promise<Response> {
  // Build radix matcher routes
  const matcherRoutes: FileRouteHandlers[] = [];
  const routeConfigs = new WeakMap<
    APIHandlerRef,
    {
      paramsFn?: (raw: unknown) => unknown;
      searchFn?: (raw: unknown) => unknown;
    }
  >();

  for (const r of routes) {
    const entry: FileRouteHandlers = {
      path: r.path,
      page: r.page,
      $component: r.$component,
    };
    if (r.$GET) {
      entry.$GET = r.$GET as unknown as APIHandlerRef;
    }
    if (r.$POST) {
      entry.$POST = r.$POST as unknown as APIHandlerRef;
    }
    matcherRoutes.push(entry);

    if (r.$$route && entry.$GET) {
      try {
        const mod = r.$$route.require();
        const routeObj = (mod as Record<string, unknown>).route;
        const cfg = (
          typeof routeObj === "object" && routeObj !== null && "config" in routeObj
            ? (routeObj as { config: { params?: unknown; search?: unknown } }).config
            : routeObj
        ) as { params?: unknown; search?: unknown } | undefined;

        if (cfg) {
          routeConfigs.set(entry.$GET, {
            paramsFn: cfg.params ? (compileValidator(cfg.params as never) as never) : undefined,
            searchFn: cfg.search ? (compileValidator(cfg.search as never) as never) : undefined,
          });
        }
      } catch {
        // lazy
      }
    }
  }

  const match = createAPIMatcher(matcherRoutes);
  const basePath = options.base ?? "/";

  return async function streamlinedTypedRoutesMiddleware(
    eventOrRequest: MiddlewareInput,
    next: MiddlewareNext,
  ): Promise<Response> {
    const request = eventOrRequest instanceof Request ? eventOrRequest : eventOrRequest.request;
    const method = request.method;
    const parsedUrl = parseFastUrlPathFirst(request.url, basePath);
    const matched = match(parsedUrl.pathname, method);

    if (!matched) {
      return next();
    }

    const rawParams = (matched.params ?? EMPTY_RECORD) as Record<string, string | undefined>;
    const searchStr = parsedUrl.searchStr;

    // Zero-closure query extraction
    let rawSearch: Record<string, unknown> | undefined;

    let validatedParams: unknown = rawParams;
    const precompiled = routeConfigs.get(matched.handler);

    if (precompiled?.paramsFn) {
      const res = precompiled.paramsFn(rawParams) as { success: boolean; data?: unknown };
      if (res && typeof res === "object" && "success" in res && !res.success) {
        return Response.json({ error: "Validation Failed", target: "params" }, { status: 400 });
      }
      if (res && typeof res === "object" && "data" in res) {
        validatedParams = res.data;
      }
    }

    let validatedSearch: unknown;
    if (precompiled?.searchFn) {
      rawSearch = rawSearch ?? (searchStr ? parseFastQueryNullProto(searchStr) : EMPTY_RECORD);
      const res = precompiled.searchFn(rawSearch) as { success: boolean; data?: unknown };
      if (res && typeof res === "object" && "success" in res && !res.success) {
        return Response.json({ error: "Validation Failed", target: "search" }, { status: 400 });
      }
      if (res && typeof res === "object" && "data" in res) {
        validatedSearch = res.data;
      }
    } else {
      validatedSearch = searchStr
        ? (rawSearch = rawSearch ?? parseFastQueryNullProto(searchStr))
        : EMPTY_RECORD;
    }

    // Zero-allocation fallback
    const event =
      eventOrRequest instanceof Request
        ? getScopedEventStreamlined(request)
        : eventOrRequest;
    event.request = request;
    event.params = validatedParams as Record<string, string>;
    event.search = validatedSearch;

    const mod =
      "require" in matched.handler
        ? (matched.handler as { require: () => Record<string, unknown> }).require()
        : await (matched.handler as { import: () => Promise<Record<string, unknown>> }).import();

    const handlerFn = (
      method === "HEAD"
        ? mod.HEAD || mod.GET
        : mod[method]
    ) as ((ev: unknown) => unknown) | undefined;

    if (typeof handlerFn !== "function") {
      return next();
    }

    const result = await handlerFn(event);

    if (result !== undefined) {
      return toResponseFast(result);
    }

    if (method !== "GET") {
      throw new Error(
        `API handler for ${method} "${request.url}" did not return a response.`,
      );
    }

    return new Response(null, { status: 404 });
  };
}

export const isolates = {
  buildUrlStaticFast,
  parseFastUrlPathFirst,
  parseFastQueryNullProto,
  normalizeSearchParamsNullProto,
  createStreamlinedMiddleware,
};