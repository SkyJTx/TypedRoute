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

export {
  RouteValidationError,
  type RouteLocation,
  type RouteConfig,
  type DefinedRouteConfig,
  type FileRouteEntry,
  type FileRouteLazyRef,
  type FileRouteEagerRef,
} from "./types/route-definition";

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

export { coercePrimitive, coerceRecord, normalizeSearchParams } from "./schema/coercion";
export { validateData, isStandardSchema, isZodSchema } from "./schema/validator-adapter";

export { defineRoute } from "./router/define-route";
export { buildUrl } from "./router/path-builder";

export {
  createMiddleware,
  type HttpMethod,
  type HttpMethodKey,
  type MiddlewareOptions,
} from "./middleware/middleware";