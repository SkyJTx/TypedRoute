/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createAPIMatcher, type APIEvent } from "filesystem-routing/api";
import type {
  APIMiddleware,
  MiddlewareRouteEntry,
  RouteConfig,
  RouteValidationTarget,
  TypedAPIEvent,
} from "~/types/route-definition";
import { RouteValidationError } from "~/types/route-definition";
import type { ValidationIssue } from "~/types/type-validator";
import { EMPTY_RECORD, parseFastQueryString } from "~/schema/coercion";
import {
  ROUTE_FLAG_IS_PAGE,
  ROUTE_FLAG_VALIDATION_ONLY,
  ROUTE_FLAG_HAS_PARAMS_SCHEMA,
  ROUTE_FLAG_HAS_SEARCH_SCHEMA,
  ROUTE_FLAG_HAS_HEADERS_SCHEMA,
  ROUTE_FLAG_HAS_COOKIES_SCHEMA,
  ROUTE_FLAG_HAS_MIDDLEWARE,
  HANDLER_FLAG_HAS_SEARCH_SCHEMA,
  HANDLER_FLAG_HAS_BODY_SCHEMA,
  HANDLER_FLAG_HAS_HEADERS_SCHEMA,
  HANDLER_FLAG_HAS_COOKIES_SCHEMA,
  HANDLER_FLAG_HAS_MIDDLEWARE,
  HANDLER_FLAG_HAS_RESPONSES_SCHEMA,
} from "~/debug/inspect";
import { getAPIHandlerMeta, type CompiledAPIHandlerMeta } from "~/router/api-handler";
import { HttpError } from "~/router/api-response";
import { parseFastUrl, type ParsedUrl } from "./url-scanner";
import { RouteNodeMeta, isRecord, resolveRouteConfig } from "./route-meta";
import {
  buildMatcherAndMetadata,
  type HttpMethod,
  type HttpMethodKey,
} from "./route-matcher";
import {
  parseRequestBody,
  parseRequestCookies,
  parseRequestHeaders,
} from "./request-parsers";

export {
  type ParsedUrl,
  parseFastUrl,
  RouteNodeMeta,
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
    rawBody?: unknown;
    rawHeaders?: Record<string, string | undefined>;
    rawCookies?: Record<string, string | undefined>;
    request: Request;
    isPage: boolean;
  }) => Response | Promise<Response | void> | void;
  /**
   * Callback invoked when an `HttpError` is thrown inside a middleware or API handler.
   * Returning a custom `Response` overrides the default JSON error serialization.
   */
  onApiError?: (args: {
    error: HttpError;
    request: Request;
    event: APIEvent;
  }) => Response | Promise<Response | void> | void;
}

const RequestContext = Symbol.for("solid.RequestContext");

const ACTIVE_ROUTE_SCHEMA_MASK =
  ROUTE_FLAG_HAS_PARAMS_SCHEMA |
  ROUTE_FLAG_HAS_SEARCH_SCHEMA |
  ROUTE_FLAG_HAS_HEADERS_SCHEMA |
  ROUTE_FLAG_HAS_COOKIES_SCHEMA |
  ROUTE_FLAG_HAS_MIDDLEWARE;

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

function serializeHttpError(error: HttpError): Response {
  const payload: Record<string, unknown> = {
    error: error.message,
    status: error.status,
  };
  if (error.code !== undefined) {
    payload.code = error.code;
  }
  if (error.details !== undefined) {
    payload.details = error.details;
  }
  return Response.json(payload, { status: error.status });
}

/**
 * Orchestrates error callbacks (`config.onError`, `options.onValidationError`) and builds
 * the appropriate fallback or 400 Bad Request response when schema validation fails.
 */
async function handleValidationFailure(
  target: RouteValidationTarget,
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
  extraContext?: {
    rawBody?: unknown;
    rawHeaders?: Record<string, string | undefined>;
    rawCookies?: Record<string, string | undefined>;
  },
): Promise<Response> {
  const error = new RouteValidationError(target, issues, {
    rawParams,
    rawSearch,
    rawBody: extraContext?.rawBody,
    rawHeaders: extraContext?.rawHeaders,
    rawCookies: extraContext?.rawCookies,
  });

  if (config?.onError) {
    config.onError({ error, rawParams, rawSearch });
  }

  if (options.onValidationError) {
    const customResponse = await options.onValidationError({
      error,
      rawParams,
      rawSearch,
      rawBody: extraContext?.rawBody,
      rawHeaders: extraContext?.rawHeaders,
      rawCookies: extraContext?.rawCookies,
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

async function runMiddlewareChain(
  middlewares: readonly APIMiddleware[],
  event: APIEvent,
): Promise<Response | undefined> {
  const len = middlewares.length;
  for (let i = 0; i < len; i++) {
    const mw = middlewares[i];
    const outcome = mw(
      event as unknown as TypedAPIEvent<
        Record<string, unknown>,
        Record<string, unknown>,
        unknown,
        Record<string, string | undefined>,
        Record<string, string | undefined>,
        Record<string, unknown>
      >,
    );
    const mwResult = outcome instanceof Promise ? await outcome : outcome;
    if (mwResult instanceof Response) {
      return mwResult;
    }
    if (isRecord(mwResult)) {
      if (event.context === undefined || event.context === EMPTY_RECORD) {
        event.context = { ...mwResult };
      } else if (isRecord(event.context)) {
        Object.assign(event.context, mwResult);
      }
    }
  }
  return undefined;
}

async function executeHandlerPipeline(
  handlerMeta: CompiledAPIHandlerMeta,
  event: APIEvent,
  rawParams: Record<string, string | undefined>,
  rawSearch: Record<string, unknown>,
  config: RouteConfig | undefined,
  options: MiddlewareOptions,
  eventOrRequest: MiddlewareInput,
  request: Request,
  getEvent: (req?: Request) => APIEvent,
  isPage: boolean,
  next: MiddlewareNext,
): Promise<Response | undefined> {
  const hFlags = handlerMeta.flags;

  if ((hFlags & HANDLER_FLAG_HAS_SEARCH_SCHEMA) !== 0 && handlerMeta.compiledSearchValidator) {
    const sOutcome = handlerMeta.compiledSearchValidator(rawSearch);
    const sResult = sOutcome instanceof Promise ? await sOutcome : sOutcome;
    if (!sResult.success) {
      return handleValidationFailure(
        "search",
        sResult.issues ?? [],
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
    event.search = sResult.data;
  }

  if ((hFlags & HANDLER_FLAG_HAS_HEADERS_SCHEMA) !== 0 && handlerMeta.compiledHeadersValidator) {
    const rawHeaders = parseRequestHeaders(request.headers);
    const hOutcome = handlerMeta.compiledHeadersValidator(rawHeaders);
    const hResult = hOutcome instanceof Promise ? await hOutcome : hOutcome;
    if (!hResult.success) {
      return handleValidationFailure(
        "headers",
        hResult.issues ?? [],
        rawParams,
        rawSearch,
        config,
        options,
        eventOrRequest,
        request,
        getEvent,
        isPage,
        next,
        { rawHeaders },
      );
    }
    event.headers = hResult.data;
  } else if (event.headers === undefined || event.headers === EMPTY_RECORD) {
    event.headers = parseRequestHeaders(request.headers);
  }

  if ((hFlags & HANDLER_FLAG_HAS_COOKIES_SCHEMA) !== 0 && handlerMeta.compiledCookiesValidator) {
    const rawCookies = parseRequestCookies(request.headers.get("cookie"));
    const cOutcome = handlerMeta.compiledCookiesValidator(rawCookies);
    const cResult = cOutcome instanceof Promise ? await cOutcome : cOutcome;
    if (!cResult.success) {
      return handleValidationFailure(
        "cookies",
        cResult.issues ?? [],
        rawParams,
        rawSearch,
        config,
        options,
        eventOrRequest,
        request,
        getEvent,
        isPage,
        next,
        { rawCookies },
      );
    }
    event.cookies = cResult.data;
  } else if (event.cookies === undefined || event.cookies === EMPTY_RECORD) {
    event.cookies = parseRequestCookies(request.headers.get("cookie"));
  }

  if ((hFlags & HANDLER_FLAG_HAS_BODY_SCHEMA) !== 0 && handlerMeta.compiledBodyValidator) {
    const parsedBodyOutcome = await parseRequestBody(request);
    if (!parsedBodyOutcome.success) {
      return handleValidationFailure(
        "body",
        parsedBodyOutcome.issues ?? [],
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
    const rawBody = parsedBodyOutcome.data;
    const bOutcome = handlerMeta.compiledBodyValidator(rawBody);
    const bResult = bOutcome instanceof Promise ? await bOutcome : bOutcome;
    if (!bResult.success) {
      return handleValidationFailure(
        "body",
        bResult.issues ?? [],
        rawParams,
        rawSearch,
        config,
        options,
        eventOrRequest,
        request,
        getEvent,
        isPage,
        next,
        { rawBody },
      );
    }
    event.body = bResult.data;
  }

  if ((hFlags & HANDLER_FLAG_HAS_MIDDLEWARE) !== 0 && handlerMeta.middleware) {
    const shortCircuit = await runMiddlewareChain(handlerMeta.middleware, event);
    if (shortCircuit !== undefined) {
      return shortCircuit;
    }
  }

  return undefined;
}

/**
 * Creates fetch middleware that validates request parameters, search queries, headers, cookies,
 * bodies, and response payloads against route and per-method schemas.
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

    // Validation-only page route without active schemas requires zero allocations
    if (isValidationOnlyPage && (flags & ACTIVE_ROUTE_SCHEMA_MASK) === 0) {
      return next();
    }

    const isPage =
      (flags & ROUTE_FLAG_IS_PAGE) !== 0 && (method === "GET" || method === "HEAD");
    const rawParams: Record<string, string | undefined> =
      matched.params ?? (EMPTY_RECORD as Record<string, string | undefined>);

    const searchStr = parsedUrl.searchStr;
    let rawSearch: Record<string, unknown> | undefined;

    let validatedParams: unknown = rawParams;

    if ((flags & ROUTE_FLAG_HAS_PARAMS_SCHEMA) !== 0 && meta.compiledParamsValidator) {
      const pOutcome = meta.compiledParamsValidator(rawParams);
      const paramsResult = pOutcome instanceof Promise ? await pOutcome : pOutcome;
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
    if ((flags & ROUTE_FLAG_HAS_SEARCH_SCHEMA) !== 0 && meta.compiledSearchValidator) {
      rawSearch = rawSearch ?? (searchStr ? parseFastQueryString(searchStr) : EMPTY_RECORD);
      const sOutcome = meta.compiledSearchValidator(rawSearch);
      const searchResult = sOutcome instanceof Promise ? await sOutcome : sOutcome;
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

    let validatedHeaders: unknown = EMPTY_RECORD;
    if ((flags & ROUTE_FLAG_HAS_HEADERS_SCHEMA) !== 0 && meta.compiledHeadersValidator) {
      const rawHeaders = parseRequestHeaders(request.headers);
      const hOutcome = meta.compiledHeadersValidator(rawHeaders);
      const headersResult = hOutcome instanceof Promise ? await hOutcome : hOutcome;
      if (!headersResult.success) {
        rawSearch = rawSearch ?? (searchStr ? parseFastQueryString(searchStr) : EMPTY_RECORD);
        return handleValidationFailure(
          "headers",
          headersResult.issues ?? [],
          rawParams,
          rawSearch,
          config,
          options,
          eventOrRequest,
          request,
          getEvent,
          isPage,
          next,
          { rawHeaders },
        );
      }
      validatedHeaders = headersResult.data;
    }

    let validatedCookies: unknown = EMPTY_RECORD;
    if ((flags & ROUTE_FLAG_HAS_COOKIES_SCHEMA) !== 0 && meta.compiledCookiesValidator) {
      const rawCookies = parseRequestCookies(request.headers.get("cookie"));
      const cOutcome = meta.compiledCookiesValidator(rawCookies);
      const cookiesResult = cOutcome instanceof Promise ? await cOutcome : cOutcome;
      if (!cookiesResult.success) {
        rawSearch = rawSearch ?? (searchStr ? parseFastQueryString(searchStr) : EMPTY_RECORD);
        return handleValidationFailure(
          "cookies",
          cookiesResult.issues ?? [],
          rawParams,
          rawSearch,
          config,
          options,
          eventOrRequest,
          request,
          getEvent,
          isPage,
          next,
          { rawCookies },
        );
      }
      validatedCookies = cookiesResult.data;
    }

    const event = resolveRequestEvent(eventOrRequest, request, getEvent);
    event.request = request;
    event.params = validatedParams as Record<string, string>;
    event.search = validatedSearch;
    event.headers = validatedHeaders;
    event.cookies = validatedCookies;
    if (event.context === undefined) {
      event.context = EMPTY_RECORD;
    }

    try {
      if ((flags & ROUTE_FLAG_HAS_MIDDLEWARE) !== 0 && meta.middleware) {
        const routeMwResponse = await runMiddlewareChain(meta.middleware, event);
        if (routeMwResponse !== undefined) {
          return routeMwResponse;
        }
      }

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

      const handlerMeta = getAPIHandlerMeta(handlerFn);
      if (handlerMeta !== undefined) {
        const pipelineResponse = await executeHandlerPipeline(
          handlerMeta,
          event,
          rawParams,
          rawSearch ?? EMPTY_RECORD,
          config,
          options,
          eventOrRequest,
          request,
          getEvent,
          isPage,
          next,
        );
        if (pipelineResponse !== undefined) {
          return pipelineResponse;
        }
      }

      const result = await handlerFn(event);

      if (result !== undefined) {
        const response = toResponse(result);
        if (
          handlerMeta !== undefined &&
          (handlerMeta.flags & HANDLER_FLAG_HAS_RESPONSES_SCHEMA) !== 0 &&
          handlerMeta.compiledResponseValidators !== undefined
        ) {
          const responseValidator = handlerMeta.compiledResponseValidators.get(response.status);
          if (responseValidator !== undefined) {
            let payloadToValidate: unknown = result;
            if (result instanceof Response) {
              const ct = response.headers.get("content-type") ?? "";
              if (ct.includes("application/json") || ct.includes("+json")) {
                try {
                  payloadToValidate = await response.clone().json();
                } catch {
                  payloadToValidate = undefined;
                }
              } else {
                payloadToValidate = await response.clone().text();
              }
            }
            const rOutcome = responseValidator(payloadToValidate);
            const rResult = rOutcome instanceof Promise ? await rOutcome : rOutcome;
            if (!rResult.success) {
              return handleValidationFailure(
                "response",
                rResult.issues ?? [],
                rawParams,
                rawSearch ?? EMPTY_RECORD,
                config,
                options,
                eventOrRequest,
                request,
                getEvent,
                isPage,
                next,
                { rawBody: payloadToValidate },
              );
            }
          }
        }
        return response;
      }
    } catch (err) {
      if (err instanceof HttpError) {
        if (options.onApiError) {
          const customErrorResponse = await options.onApiError({
            error: err,
            request,
            event,
          });
          if (customErrorResponse instanceof Response) {
            return customErrorResponse;
          }
        }
        return serializeHttpError(err);
      }
      throw err;
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
