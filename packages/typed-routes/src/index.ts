/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export type {
  StandardSchemaV1,
  StandardSchemaResult,
  ZodLikeSchema,
  FunctionValidator,
  TypeValidator,
  InferOutput,
  InferInput,
  ValidationIssue,
  ValidationResult,
} from "./types/type-validator";
export { SchemaValidationError } from "./types/type-validator";

export type {
  RouteLocation,
  RouteConfig,
  DefinedRouteConfig,
  FileRouteEntry,
  FileRouteLazyRef,
  FileRouteEagerRef,
  MiddlewareRouteConfigModule,
  MiddlewareRouteConfigRef,
  MiddlewareHandlerRef,
  MiddlewareRouteEntry,
  TypedAPIEvent,
  TypedAPIHandler,
} from "./types/route-definition";
export { RouteValidationError } from "./types/route-definition";

export type {
  NormalizePath,
  PathSegments,
  ExtractPathParams,
  Simplify,
  ExtractRoutePaths,
  RouteParamsFor,
  RouteSearchFor,
  NavigationArgs,
  FindRouteEntry,
} from "./types/route-inference";

export {
  coercePrimitive,
  coerceRecord,
  normalizeSearchParams,
  parseFastQueryString,
} from "./schema/coercion";

export {
  validateData,
  isStandardSchema,
  isZodSchema,
} from "./schema/validator-adapter";

export { defineRoute } from "./router/define-route";
export {
  buildUrl,
  compilePathBuilder,
  serializeFastQuery,
  type CompiledPathBuilder,
} from "./router/path-builder";

export {
  createMiddleware,
  parseFastUrl,
  type HttpMethod,
  type HttpMethodKey,
  type MiddlewareOptions,
  type MiddlewareInput,
  type MiddlewareNext,
} from "./middleware/middleware";