/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  getHttpStatusTitle,
  type ProblemDetails,
  type ProblemOptions,
} from "~/types/problem-details";
import type { TypeValidator } from "~/types/type-validator";

/**
 * Symbol storing unserialized payload and schema metadata on `TypedResponse` instances.
 * Enables O(1) response validation in `createMiddleware` without stream cloning and
 * allows OpenAPI error probing to inspect `TypedResponse` contracts at runtime.
 */
export const TYPED_RESPONSE_META: unique symbol = Symbol.for("typed-routes.responseMeta");
export const TYPED_RESPONSE_BODY: unique symbol = Symbol.for("typed-routes.responseBody");
const HAS_NO_BODY: unique symbol = Symbol.for("typed-routes.noBody");

/**
 * Runtime metadata attached to `TypedResponse` instances created by response helpers.
 */
export interface TypedResponseRuntimeMeta {
  readonly status: number;
  readonly contentType: string;
  readonly body: unknown;
  readonly schema?: TypeValidator<unknown, unknown>;
}

/**
 * Standard Web Response augmented with compile-time phantom types for payload and HTTP status code.
 */
export interface TypedResponse<
  TData = unknown,
  TStatus extends number = number,
> extends Response {
  readonly status: TStatus;
  readonly _data?: TData;
  readonly [TYPED_RESPONSE_META]?: TypedResponseRuntimeMeta;
}

/**
 * Attaches non-enumerable `TypedResponseRuntimeMeta` to a `Response` instance.
 */
export function attachTypedResponseMeta<TResponse extends Response>(
  response: TResponse,
  meta: TypedResponseRuntimeMeta,
): TResponse {
  (response as unknown as Record<symbol, unknown>)[TYPED_RESPONSE_META] = meta;
  return response;
}

/**
 * Retrieves the unserialized body from a `TypedResponse` in O(1) without allocating metadata objects.
 */
export function getTypedResponseBody(response: unknown): {
  hasBody: boolean;
  body: unknown;
} {
  if (typeof response !== "object" || response === null) {
    return { hasBody: false, body: undefined };
  }
  const rec = response as Record<symbol, unknown>;
  if (TYPED_RESPONSE_BODY in rec) {
    const raw = rec[TYPED_RESPONSE_BODY];
    return raw === HAS_NO_BODY
      ? { hasBody: true, body: undefined }
      : { hasBody: true, body: raw };
  }
  const meta = rec[TYPED_RESPONSE_META] as TypedResponseRuntimeMeta | undefined;
  if (meta !== undefined) {
    return { hasBody: true, body: meta.body };
  }
  return { hasBody: false, body: undefined };
}

/**
 * Retrieves `TypedResponseRuntimeMeta` from a response if it was created by a typed response helper.
 */
export function getTypedResponseMeta(response: unknown): TypedResponseRuntimeMeta | undefined {
  if (typeof response !== "object" || response === null) {
    return undefined;
  }
  const rec = response as Record<symbol, unknown>;
  const explicitMeta = rec[TYPED_RESPONSE_META] as TypedResponseRuntimeMeta | undefined;
  if (explicitMeta !== undefined) {
    return explicitMeta;
  }
  if (TYPED_RESPONSE_BODY in rec && response instanceof Response) {
    const raw = rec[TYPED_RESPONSE_BODY];
    const rawCt = response.headers.get("content-type") ?? "";
    const semi = rawCt.indexOf(";");
    const contentType = (semi === -1 ? rawCt : rawCt.slice(0, semi)).trim();
    return {
      status: response.status,
      contentType,
      body: raw === HAS_NO_BODY ? undefined : raw,
      schema: undefined,
    };
  }
  return undefined;
}

/**
 * Options for constructing an `HttpError`.
 */
export interface HttpErrorOptions<TDetails = unknown> {
  type?: string;
  title?: string;
  code?: string;
  details?: TDetails;
  cause?: unknown;
}

/**
 * Structured HTTP error thrown inside API route handlers or middleware pipelines.
 * Automatically caught and serialized into an RFC 9457 Problem Details JSON response by `createMiddleware`.
 */
export class HttpError<TDetails = unknown> extends Error {
  public readonly status: number;
  public readonly type: string | undefined;
  public readonly title: string | undefined;
  public readonly code: string | undefined;
  public readonly details: TDetails | undefined;

  public constructor(
    status: number,
    message: string,
    options?: HttpErrorOptions<TDetails>,
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "HttpError";
    this.status = status;
    this.type = options?.type;
    this.title = options?.title;
    this.code = options?.code;
    this.details = options?.details;
  }

  public static badRequest<TDetails = unknown>(
    message = "Bad Request",
    options?: HttpErrorOptions<TDetails>,
  ): HttpError<TDetails> {
    return new HttpError<TDetails>(400, message, options);
  }

  public static unauthorized<TDetails = unknown>(
    message = "Unauthorized",
    options?: HttpErrorOptions<TDetails>,
  ): HttpError<TDetails> {
    return new HttpError<TDetails>(401, message, options);
  }

  public static forbidden<TDetails = unknown>(
    message = "Forbidden",
    options?: HttpErrorOptions<TDetails>,
  ): HttpError<TDetails> {
    return new HttpError<TDetails>(403, message, options);
  }

  public static notFound<TDetails = unknown>(
    message = "Not Found",
    options?: HttpErrorOptions<TDetails>,
  ): HttpError<TDetails> {
    return new HttpError<TDetails>(404, message, options);
  }

  public static conflict<TDetails = unknown>(
    message = "Conflict",
    options?: HttpErrorOptions<TDetails>,
  ): HttpError<TDetails> {
    return new HttpError<TDetails>(409, message, options);
  }

  public static unprocessable<TDetails = unknown>(
    message = "Unprocessable Entity",
    options?: HttpErrorOptions<TDetails>,
  ): HttpError<TDetails> {
    return new HttpError<TDetails>(422, message, options);
  }

  public static internal<TDetails = unknown>(
    message = "Internal Server Error",
    options?: HttpErrorOptions<TDetails>,
  ): HttpError<TDetails> {
    return new HttpError<TDetails>(500, message, options);
  }
}

export const STATIC_JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8",
});

export const STATIC_PROBLEM_HEADERS = Object.freeze({
  "content-type": "application/problem+json; charset=utf-8",
});

export const STATIC_JSON_200_INIT: Readonly<ResponseInit> = Object.freeze({
  status: 200,
  headers: STATIC_JSON_HEADERS,
});

/**
 * Extended ResponseInit for `json()` allowing an optional validator schema attachment.
 */
export interface JsonResponseInit<TStatus extends number = 200> extends ResponseInit {
  status?: TStatus;
  schema?: TypeValidator<unknown, unknown>;
}

/**
 * Creates a JSON `Response` carrying compile-time payload and status code types,
 * plus runtime metadata for O(1) validation and OpenAPI introspection.
 */
export function json<TData, TStatus extends number = 200>(
  data: TData,
  init?: TStatus | JsonResponseInit<TStatus>,
): TypedResponse<TData, TStatus> {
  const serialized = JSON.stringify(data);
  if (typeof init === "number") {
    const response = new Response(serialized, {
      status: init,
      headers: STATIC_JSON_HEADERS,
    }) as TypedResponse<TData, TStatus>;
    (response as unknown as Record<symbol, unknown>)[TYPED_RESPONSE_BODY] =
      data === undefined ? HAS_NO_BODY : data;
    return response;
  }
  if (init === undefined) {
    const response = new Response(serialized, STATIC_JSON_200_INIT) as TypedResponse<TData, TStatus>;
    (response as unknown as Record<symbol, unknown>)[TYPED_RESPONSE_BODY] =
      data === undefined ? HAS_NO_BODY : data;
    return response;
  }
  const status = (init.status ?? 200) as TStatus;
  const headers = init.headers ? new Headers(init.headers) : STATIC_JSON_HEADERS;
  if (headers instanceof Headers && !headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  const response = new Response(serialized, {
    ...init,
    status,
    headers,
  }) as TypedResponse<TData, TStatus>;
  if (init.schema === undefined) {
    (response as unknown as Record<symbol, unknown>)[TYPED_RESPONSE_BODY] =
      data === undefined ? HAS_NO_BODY : data;
    return response;
  }
  return attachTypedResponseMeta(response, {
    status,
    contentType: "application/json",
    body: data,
    schema: init.schema,
  });
}

const RESERVED_PROBLEM_OPTION_KEYS = new Set([
  "type",
  "title",
  "instance",
  "code",
  "target",
  "issues",
  "details",
  "headers",
  "schema",
]);

/**
 * Creates an RFC 9457 Problem Details `Response` (`application/problem+json; charset=utf-8`)
 * carrying compile-time and runtime metadata.
 */
export function problem<
  TStatus extends number = number,
  TProblem extends ProblemDetails = ProblemDetails,
>(
  status: TStatus,
  detail?: string,
  options?: ProblemOptions,
): TypedResponse<TProblem, TStatus> {
  const payload: Record<string, unknown> = {
    type: options?.type ?? "about:blank",
    title: options?.title ?? getHttpStatusTitle(status),
    status,
  };
  if (detail !== undefined) {
    payload.detail = detail;
  }
  if (options !== undefined) {
    if (options.instance !== undefined) {
      payload.instance = options.instance;
    }
    if (options.code !== undefined) {
      payload.code = options.code;
    }
    if (options.target !== undefined) {
      payload.target = options.target;
    }
    if (options.issues !== undefined) {
      payload.issues = options.issues;
    }
    if (options.details !== undefined) {
      payload.details = options.details;
    }
    const keys = Object.keys(options);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!RESERVED_PROBLEM_OPTION_KEYS.has(key) && options[key] !== undefined) {
        payload[key] = options[key];
      }
    }
  }

  const serialized = JSON.stringify(payload);
  let headers: HeadersInit = STATIC_PROBLEM_HEADERS;
  if (options?.headers !== undefined) {
    const customHeaders = new Headers(options.headers);
    if (!customHeaders.has("content-type")) {
      customHeaders.set("content-type", "application/problem+json; charset=utf-8");
    }
    headers = customHeaders;
  }

  const response = new Response(serialized, {
    status,
    headers,
  }) as TypedResponse<TProblem, TStatus>;

  return attachTypedResponseMeta(response, {
    status,
    contentType: "application/problem+json",
    body: payload,
    schema: options?.schema,
  });
}

/**
 * Creates a plain-text `Response` carrying compile-time text and status code types.
 */
export function text<TText extends string = string, TStatus extends number = 200>(
  data: TText,
  init?: TStatus | (ResponseInit & { status?: TStatus }),
): TypedResponse<TText, TStatus> {
  if (typeof init === "number") {
    const response = new Response(data, {
      status: init,
      headers: { "content-type": "text/plain; charset=utf-8" },
    }) as TypedResponse<TText, TStatus>;
    (response as unknown as Record<symbol, unknown>)[TYPED_RESPONSE_BODY] = data;
    return response;
  }
  const status = (init?.status ?? 200) as TStatus;
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "text/plain; charset=utf-8");
  }
  const response = new Response(data, {
    ...init,
    status,
    headers,
  }) as TypedResponse<TText, TStatus>;
  (response as unknown as Record<symbol, unknown>)[TYPED_RESPONSE_BODY] = data;
  return response;
}

/**
 * Creates an empty `204 No Content` `Response`.
 */
export function noContent(init?: ResponseInit): TypedResponse<null, 204> {
  const response = new Response(null, {
    ...init,
    status: 204,
  }) as TypedResponse<null, 204>;
  (response as unknown as Record<symbol, unknown>)[TYPED_RESPONSE_BODY] = null;
  return response;
}

/**
 * Creates an HTTP redirect `Response` with a strongly-typed redirect status code.
 */
export function redirect<TStatus extends 301 | 302 | 303 | 307 | 308 = 302>(
  url: string,
  status?: TStatus,
): TypedResponse<null, TStatus> {
  const code = status ?? (302 as TStatus);
  const response = new Response(null, {
    status: code,
    headers: { location: url },
  }) as TypedResponse<null, TStatus>;
  (response as unknown as Record<symbol, unknown>)[TYPED_RESPONSE_BODY] = null;
  return response;
}
