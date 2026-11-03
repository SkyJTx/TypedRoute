/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Standard Web Response augmented with compile-time phantom types for payload and HTTP status code.
 */
export interface TypedResponse<
  TData = unknown,
  TStatus extends number = number,
> extends Response {
  readonly status: TStatus;
  readonly _data?: TData;
}

/**
 * Options for constructing an `HttpError`.
 */
export interface HttpErrorOptions<TDetails = unknown> {
  code?: string;
  details?: TDetails;
  cause?: unknown;
}

/**
 * Structured HTTP error thrown inside API route handlers or middleware pipelines.
 * Automatically caught and serialized into a JSON error response by `createMiddleware`.
 */
export class HttpError<TDetails = unknown> extends Error {
  public readonly status: number;
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

/**
 * Creates a JSON `Response` carrying compile-time payload and status code types.
 */
export function json<TData, TStatus extends number = 200>(
  data: TData,
  init?: TStatus | (ResponseInit & { status?: TStatus }),
): TypedResponse<TData, TStatus> {
  if (typeof init === "number") {
    return Response.json(data, { status: init }) as TypedResponse<TData, TStatus>;
  }
  return Response.json(data, init) as TypedResponse<TData, TStatus>;
}

/**
 * Creates a plain-text `Response` carrying compile-time text and status code types.
 */
export function text<TText extends string = string, TStatus extends number = 200>(
  data: TText,
  init?: TStatus | (ResponseInit & { status?: TStatus }),
): TypedResponse<TText, TStatus> {
  if (typeof init === "number") {
    return new Response(data, {
      status: init,
      headers: { "content-type": "text/plain; charset=utf-8" },
    }) as TypedResponse<TText, TStatus>;
  }
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "text/plain; charset=utf-8");
  }
  return new Response(data, {
    ...init,
    headers,
  }) as TypedResponse<TText, TStatus>;
}

/**
 * Creates an empty `204 No Content` `Response`.
 */
export function noContent(init?: ResponseInit): TypedResponse<null, 204> {
  return new Response(null, {
    ...init,
    status: 204,
  }) as TypedResponse<null, 204>;
}

/**
 * Creates an HTTP redirect `Response` with a strongly-typed redirect status code.
 */
export function redirect<TStatus extends 301 | 302 | 303 | 307 | 308 = 302>(
  url: string,
  status?: TStatus,
): TypedResponse<null, TStatus> {
  const code = status ?? (302 as TStatus);
  return new Response(null, {
    status: code,
    headers: { location: url },
  }) as TypedResponse<null, TStatus>;
}
