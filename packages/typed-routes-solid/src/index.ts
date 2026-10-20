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
} from "@skyjt/typed-routes";

export {
  SchemaValidationError,
  RouteValidationError,
  coercePrimitive,
  coerceRecord,
  normalizeSearchParams,
  validateData,
  isStandardSchema,
  isZodSchema,
  buildUrl,
  createMiddleware,
} from "@skyjt/typed-routes";

// SolidJS-specific reactive components, context, and router bindings
export type {
  RouteValidationContextValue,
  DefinedRouteObject,
  LinkProps,
} from "./types/solid-route";

export { RouteValidationProvider, useRouteValidationContext } from "./context/route-context";
export { interceptFileRoutes } from "./interceptor/interceptor";
export { defineRoute } from "./router/define-route";
export { createRouter, type RouterConfig, type RouterPaths } from "./router/create-router";
export { Link } from "./components/link";
export { useNavigate } from "./hooks/use-navigate";