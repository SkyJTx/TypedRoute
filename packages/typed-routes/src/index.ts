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

export type {
  RouteValidationTarget,
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
  APIMiddlewareResult,
  APIMiddleware,
  MergeMiddlewareContext,
  APIHandlerConfig,
  ConfiguredAPIHandler,
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
  InferHandlerInput,
  InferHandlerOutput,
  InferHandlerData,
  RouteMethodHandlerFor,
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
  compileAsyncValidator,
  validateData,
  validateDataAsync,
  evaluateRouteTarget,
  isStandardSchema,
  isZodSchema,
  type CompiledValidator,
  type CompiledAsyncValidator,
} from "./schema/validator-adapter";

export { DefinedRoute, defineRoute } from "./router/define-route";
export {
  CompiledAPIHandlerMeta,
  defineMiddleware,
  registerAPIHandler,
  getAPIHandlerMeta,
} from "./router/api-handler";
export {
  HttpError,
  json,
  text,
  noContent,
  redirect,
  type TypedResponse,
  type HttpErrorOptions,
} from "./router/api-response";
export {
  SEGMENT_STATIC,
  SEGMENT_PARAM,
  PathSegment,
  MAX_BUILDER_CACHE_SIZE,
  buildUrl,
  clearBuilderCache,
  compilePathBuilder,
  getBuilderCacheSize,
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
  parseRequestBody,
  parseRequestCookies,
  parseRequestHeaders,
} from "./middleware/request-parsers";

export {
  CUSTOM_INSPECT_SYMBOL,
  ROUTE_FLAG_NONE,
  ROUTE_FLAG_IS_PAGE,
  ROUTE_FLAG_VALIDATION_ONLY,
  ROUTE_FLAG_CONFIG_RESOLVED,
  ROUTE_FLAG_HAS_PARAMS_SCHEMA,
  ROUTE_FLAG_HAS_SEARCH_SCHEMA,
  ROUTE_FLAG_HAS_HEADERS_SCHEMA,
  ROUTE_FLAG_HAS_COOKIES_SCHEMA,
  ROUTE_FLAG_HAS_MIDDLEWARE,
  HANDLER_FLAG_NONE,
  HANDLER_FLAG_HAS_SEARCH_SCHEMA,
  HANDLER_FLAG_HAS_BODY_SCHEMA,
  HANDLER_FLAG_HAS_HEADERS_SCHEMA,
  HANDLER_FLAG_HAS_COOKIES_SCHEMA,
  HANDLER_FLAG_HAS_MIDDLEWARE,
  HANDLER_FLAG_HAS_RESPONSES_SCHEMA,
  describeValidator,
  formatRouteFlags,
  formatHandlerFlags,
  inspectRoute,
  type RouteDebugSummary,
} from "./debug/inspect";
