/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Core framework-agnostic exports for a seamless, unified developer experience
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
  NormalizePath,
  PathSegments,
  ExtractPathParams,
  Simplify,
  ExtractRoutePaths,
  RouteParamsFor,
  RouteSearchFor,
  NavigationArgs,
  FindRouteEntry,
  HttpMethod,
  HttpMethodKey,
  MiddlewareOptions,
  MiddlewareInput,
  MiddlewareNext,
  CompiledValidator,
  CompiledPathBuilder,
  PathBuilderDebugInfo,
  RouteDebugSummary,
  ParsedUrl,
} from "@skyjt/typed-routes";

export {
  EMPTY_RECORD,
  CUSTOM_INSPECT_SYMBOL,
  ROUTE_FLAG_NONE,
  ROUTE_FLAG_IS_PAGE,
  ROUTE_FLAG_VALIDATION_ONLY,
  ROUTE_FLAG_CONFIG_RESOLVED,
  ROUTE_FLAG_HAS_PARAMS_SCHEMA,
  ROUTE_FLAG_HAS_SEARCH_SCHEMA,
  SchemaValidationError,
  RouteValidationError,
  ValidationOutcome,
  PathSegment,
  RouteNodeMeta,
  coercePrimitive,
  coerceRecord,
  normalizeSearchParams,
  parseFastQueryString,
  compileValidator,
  validateData,
  evaluateRouteTarget,
  isStandardSchema,
  isZodSchema,
  buildUrl,
  compilePathBuilder,
  inspectPathBuilder,
  serializeFastQuery,
  createMiddleware,
  parseFastUrl,
  describeValidator,
  formatRouteFlags,
  inspectRoute,
} from "@skyjt/typed-routes";

// Re-exported SolidJS router types so userland never needs direct @solidjs/router imports
export type {
  RouteSectionProps,
  Location,
  RouteDefinition,
} from "@solidjs/router";

// SolidJS-specific reactive components, context, and router bindings
export type {
  RouteAccessorTuple,
  SolidRouteConfig,
  RouteValidationContextValue,
  DefinedRouteObject,
  LinkProps,
} from "./types/solid-route";

export {
  RouteValidationProvider,
  createRouteAccessorTuple,
  useRouteValidationContext,
} from "./context/route-context";
export { interceptFileRoutes } from "./interceptor/interceptor";
export { SolidDefinedRoute, defineRoute } from "./router/define-route";
export { createRouter, type RouterConfig, type RouterPaths } from "./router/create-router";
export { Link } from "./components/link";
export { useNavigate } from "./hooks/use-navigate";