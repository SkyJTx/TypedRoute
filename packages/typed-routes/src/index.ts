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
  RouteValidationTuple,
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
  EMPTY_RECORD,
  coercePrimitive,
  coerceRecord,
  normalizeSearchParams,
  parseFastQueryString,
} from "./schema/coercion";

export {
  ValidationOutcome,
  compileValidator,
  validateData,
  evaluateRouteTarget,
  isStandardSchema,
  isZodSchema,
  type CompiledValidator,
} from "./schema/validator-adapter";

export { DefinedRoute, defineRoute } from "./router/define-route";
export {
  SEGMENT_STATIC,
  SEGMENT_PARAM,
  PathSegment,
  buildUrl,
  compilePathBuilder,
  inspectPathBuilder,
  serializeFastQuery,
  type CompiledPathBuilder,
  type PathBuilderDebugInfo,
} from "./router/path-builder";

export {
  type ParsedUrl,
  RouteNodeMeta,
  createMiddleware,
  parseFastUrl,
  type HttpMethod,
  type HttpMethodKey,
  type MiddlewareOptions,
  type MiddlewareInput,
  type MiddlewareNext,
} from "./middleware/middleware";

export {
  CUSTOM_INSPECT_SYMBOL,
  ROUTE_FLAG_NONE,
  ROUTE_FLAG_IS_PAGE,
  ROUTE_FLAG_VALIDATION_ONLY,
  ROUTE_FLAG_CONFIG_RESOLVED,
  ROUTE_FLAG_HAS_PARAMS_SCHEMA,
  ROUTE_FLAG_HAS_SEARCH_SCHEMA,
  describeValidator,
  formatRouteFlags,
  inspectRoute,
  type RouteDebugSummary,
} from "./debug/inspect";