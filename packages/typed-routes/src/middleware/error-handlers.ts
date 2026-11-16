/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { APIEvent } from "filesystem-routing/api";
import {
  HttpError,
  problem,
  type TypedResponse,
} from "~/router/api-response";
import {
  getHttpStatusTitle,
  type ProblemDetails,
  type ValidationProblemDetails,
} from "~/types/problem-details";
import type { RouteValidationError } from "~/types/route-definition";

export interface ValidationErrorHandlerArgs {
  error: RouteValidationError;
  rawParams: Record<string, string | undefined>;
  rawSearch: Record<string, unknown>;
  rawBody?: unknown;
  rawHeaders?: Record<string, string | undefined>;
  rawCookies?: Record<string, string | undefined>;
  request: Request;
  isPage: boolean;
}

export interface ApiErrorHandlerArgs {
  error: HttpError;
  request: Request;
  event: APIEvent;
}

/**
 * Extracts the pathname portion of a request URL without throwing on relative URLs.
 */
export function extractRequestPathname(url: string): string {
  const qIdx = url.indexOf("?");
  const raw = qIdx === -1 ? url : url.slice(0, qIdx);
  const schemeIdx = raw.indexOf("://");
  if (schemeIdx === -1) {
    const withSlash = raw.startsWith("/") ? raw : "/" + raw;
    return withSlash.replace(/^\/{2,}/, "/");
  }
  const slashIdx = raw.indexOf("/", schemeIdx + 3);
  return slashIdx === -1 ? "/" : raw.slice(slashIdx).replace(/^\/{2,}/, "/");
}

/**
 * Default validation error handler for `createMiddleware`.
 *
 * - For UI page routes (`isPage: true`), returns `undefined` so SSR can render with `event.validationError`.
 * - For API routes (`isPage: false`), returns an RFC 9457 Problem Details `TypedResponse` (`400` for request
 *   validation targets, `500` for `"response"` schema validation failures).
 */
export function defaultOnValidationError(
  args: ValidationErrorHandlerArgs,
): TypedResponse<ValidationProblemDetails, 400 | 500> | undefined {
  if (args.isPage) {
    return undefined;
  }
  const status: 400 | 500 = args.error.target === "response" ? 500 : 400;
  const title = status === 500 ? "Response Validation Failed" : "Bad Request";
  const instance = extractRequestPathname(args.request.url);

  return problem<400 | 500, ValidationProblemDetails>(status, args.error.message, {
    type: "https://datatracker.ietf.org/doc/html/rfc9457",
    title,
    instance,
    target: args.error.target,
    issues: args.error.issues,
  });
}

/**
 * Default API error handler for `createMiddleware` when an `HttpError` is thrown.
 * Serializes the error into an RFC 9457 Problem Details `TypedResponse` (`application/problem+json`).
 */
export function defaultOnApiError(
  args: ApiErrorHandlerArgs,
): TypedResponse<ProblemDetails, number> {
  const instance = extractRequestPathname(args.request.url);
  return problem(args.error.status, args.error.message, {
    type: args.error.type ?? "about:blank",
    title: args.error.title ?? getHttpStatusTitle(args.error.status),
    instance,
    code: args.error.code,
    details: args.error.details,
  });
}
