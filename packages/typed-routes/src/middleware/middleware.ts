/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createAPIMatcher, type APIEvent } from "filesystem-routing/api";
import type { MiddlewareRouteEntry, RouteConfig } from "~/types/route-definition";
import { RouteValidationError } from "~/types/route-definition";
import type { ValidationIssue } from "~/types/type-validator";
import { EMPTY_RECORD, parseFastQueryString } from "~/schema/coercion";
import {
  ROUTE_FLAG_IS_PAGE,
  ROUTE_FLAG_VALIDATION_ONLY,
  ROUTE_FLAG_HAS_PARAMS_SCHEMA,
  ROUTE_FLAG_HAS_SEARCH_SCHEMA,
} from "~/debug/inspect";
import { parseFastUrl, type ParsedUrl } from "./url-scanner";
import { RouteNodeMeta, resolveRouteConfig } from "./route-meta";
import {
  buildMatcherAndMetadata,
  httpHandlerKeys,
  toApiHandlerRef,
  toRadixPath,
  type HttpMethod,
  type HttpMethodKey,
} from "./route-matcher";

export {
  type ParsedUrl,
  parseFastUrl,
  RouteNodeMeta,
  resolveRouteConfig,
  buildMatcherAndMetadata,
  httpHandlerKeys,
  toApiHandlerRef,
  toRadixPath,
  type HttpMethod,
  type HttpMethodKey,
};

export type MiddlewareInput = Request | { request: Request; [key: string]: unknown };

export type MiddlewareNext = (request?: Request) => Response | Promise<Response>;

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
   * to proceed to SSR where the UI route component handles the validation error tuple.
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

function getScopedEvent(request?: Request): APIEvent {
  const store = (
    globalThis as Record<symbol, { getStore?(): APIEvent } | undefined>
  )[RequestContext]?.getStore?.();
  if (!store) {
    return { request: request ?? new Request("http://localhost/") };
  }
  return store;
}

function extractRequest(input: MiddlewareInput): Request {
  if (input instanceof Request) {
    return input;
  }
  return input.request;
}

function resolveRequestEvent(
  eventOrRequest: MiddlewareInput,
  request: Request,
  getEvent: (req?: Request) => APIEvent,
): APIEvent {
  if (!(eventOrRequest instanceof Request)) {
    return eventOrRequest;
  }
  try {
    return getEvent(request);
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
 * Orchestrates error callbacks (`config.onError`, `options.onValidationError`) and builds
 * the appropriate fallback or 400 Bad Request response when schema validation fails.
 */
async function handleValidationFailure(
  target: "params" | "search",
  issues: ReadonlyArray<ValidationIssue>,
  rawParams: Record<string, string | undefined>,
  rawSearch: Record<string, unknown>,
  config: RouteConfig | undefined,
  options: MiddlewareOptions,
  eventOrRequest: MiddlewareInput,
  request: Request,
  getEvent: (req?: Request) => APIEvent,
  isPage: boolean,
  next: MiddlewareNext,
): Promise<Response> {
  const error = new RouteValidationError(target, issues, {
    rawParams,
    rawSearch,
  });

  if (config?.onError) {
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
      target,
      issues,
    },
    { status: 400 },
  );
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
  const basePath = options.base ?? "/";

  return async function typedRoutesMiddleware(
    eventOrRequest: MiddlewareInput,
    next: MiddlewareNext,
  ): Promise<Response> {
    const request = extractRequest(eventOrRequest);
    const method = request.method;
    const parsedUrl = parseFastUrl(request.url, basePath);
    const matched = match(parsedUrl.pathname, method);

    if (!matched) {
      return next();
    }

    const meta = handlerMetadata.get(matched.handler);
    if (!meta) {
      return next();
    }

    const config = resolveRouteConfig(meta);
    const flags = meta.flags;
    const isValidationOnlyPage = (flags & ROUTE_FLAG_VALIDATION_ONLY) !== 0;

    const hasParamsSchema = (flags & ROUTE_FLAG_HAS_PARAMS_SCHEMA) !== 0;
    const hasSearchSchema = (flags & ROUTE_FLAG_HAS_SEARCH_SCHEMA) !== 0;

    // Validation-only page route without active schemas requires zero allocations
    if (isValidationOnlyPage && !hasParamsSchema && !hasSearchSchema) {
      return next();
    }

    const isPage =
      (flags & ROUTE_FLAG_IS_PAGE) !== 0 && (method === "GET" || method === "HEAD");
    const rawParams: Record<string, string | undefined> =
      matched.params ?? (EMPTY_RECORD as Record<string, string | undefined>);

    const searchStr = parsedUrl.searchStr;
    let rawSearch: Record<string, unknown> | undefined;

    let validatedParams: unknown = rawParams;

    if (hasParamsSchema && meta.compiledParamsValidator) {
      const paramsResult = meta.compiledParamsValidator(rawParams);
      if (!paramsResult.success) {
        rawSearch = rawSearch ?? (searchStr ? parseFastQueryString(searchStr) : EMPTY_RECORD);
        return handleValidationFailure(
          "params",
          paramsResult.issues ?? [],
          rawParams,
          rawSearch,
          config,
          options,
          eventOrRequest,
          request,
          getEvent,
          isPage,
          next,
        );
      }
      validatedParams = paramsResult.data;
    }

    let validatedSearch: unknown;
    if (hasSearchSchema && meta.compiledSearchValidator) {
      rawSearch = rawSearch ?? (searchStr ? parseFastQueryString(searchStr) : EMPTY_RECORD);
      const searchResult = meta.compiledSearchValidator(rawSearch);
      if (!searchResult.success) {
        return handleValidationFailure(
          "search",
          searchResult.issues ?? [],
          rawParams,
          rawSearch,
          config,
          options,
          eventOrRequest,
          request,
          getEvent,
          isPage,
          next,
        );
      }
      validatedSearch = searchResult.data;
    } else if (!isValidationOnlyPage) {
      rawSearch = rawSearch ?? (searchStr ? parseFastQueryString(searchStr) : EMPTY_RECORD);
      validatedSearch = rawSearch;
    } else {
      validatedSearch = searchStr
        ? (rawSearch = rawSearch ?? parseFastQueryString(searchStr))
        : EMPTY_RECORD;
    }

    const event = resolveRequestEvent(eventOrRequest, request, getEvent);
    event.request = request;
    event.params = validatedParams as Record<string, string>;
    event.search = validatedSearch;

    if (isValidationOnlyPage) {
      return next();
    }

    const mod =
      "require" in matched.handler
        ? matched.handler.require()
        : await matched.handler.import();
    const handlerFn = method === "HEAD" ? mod.HEAD || mod.GET : mod[method];

    if (typeof handlerFn !== "function") {
      return next();
    }

    const result = await handlerFn(event);

    if (result !== undefined) {
      return toResponse(result);
    }

    if (method !== "GET") {
      throw new Error(
        `API handler for ${method} "${request.url}" did not return a response.`,
      );
    }

    if (!isPage) {
      return new Response(null, { status: 404 });
    }

    return next();
  };
}