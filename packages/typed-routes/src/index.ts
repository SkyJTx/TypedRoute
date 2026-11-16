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
  StripTrailingSlash,
  PathSegments,
  ExtractPathParams,
  Simplify,
  ExtractRoutePaths,
  RouteParamsFor,
  RouteSearchFor,
  NavigationArgs,
  FindRouteEntry,
  PathsForMethod,
  InferHandlerInput,
  InferHandlerOutput,
  InferHandlerData,
  RouteMethodHandlerFor,
} from "./types/route-inference";

export type {
  ProblemDetails,
  ValidationProblemDetails,
  ProblemOptions,
} from "./types/problem-details";
export { getHttpStatusTitle } from "./types/problem-details";

export type {
  AppManifestMap,
  CrossAppNavigationOptions,
  ExternalAppConfig,
  CrossAppConfigs,
  PathBuildOptions,
  CrossAppNavigationArgs,
  TypedPaths,
} from "./types/cross-app";

export type {
  OpenAPIExternalDocs,
  OpenAPIOperationMeta,
  JsonSchemaObject,
  OpenAPIParameterObject,
  OpenAPIMediaTypeObject,
  OpenAPIRequestBodyObject,
  OpenAPIResponseObject,
  OpenAPIOperationObject,
  OpenAPIPathItemObject,
  OpenAPIInfoObject,
  OpenAPIServerObject,
  OpenAPITagObject,
  OpenAPIDocument,
  ValidationErrorHandler,
  ApiErrorHandler,
  OpenAPIUIVendorPreset,
  OpenAPIUIRendererContext,
  CustomOpenAPIUIRenderer,
  OpenAPIUIOption,
  OpenAPIGeneratorConfig,
  OpenAPIOptions,
  ProbedErrorContract,
  ResolvedOpenAPIErrorContracts,
} from "./types/openapi";

export type {
  ClientHttpMethod,
  ClientResultTuple,
  RequestClientOptions,
  ClientRequestOptions,
  ClientMethodArgs,
  ClientMethodData,
  TypedRequestClient,
} from "./types/request-client";

export {
  EMPTY_RECORD,
  isForbiddenKey,
  safeDecodeComponent,
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
  TYPED_RESPONSE_META,
  TYPED_RESPONSE_BODY,
  attachTypedResponseMeta,
  getTypedResponseBody,
  getTypedResponseMeta,
  HttpError,
  json,
  problem,
  text,
  noContent,
  redirect,
  STATIC_JSON_HEADERS,
  STATIC_PROBLEM_HEADERS,
  STATIC_JSON_200_INIT,
  type TypedResponse,
  type TypedResponseRuntimeMeta,
  type HttpErrorOptions,
  type JsonResponseInit,
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
  joinBaseAndPath,
  buildCrossAppUrl,
  navigateCrossApp,
  createPaths,
} from "./router/cross-app";

export {
  type ValidationErrorHandlerArgs,
  type ApiErrorHandlerArgs,
  extractRequestPathname,
  defaultOnValidationError,
  defaultOnApiError,
} from "./middleware/error-handlers";
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
  type RuntimeAdapter,
  type RuntimeAdapterPreset,
  createRuntimeAdapter,
  resolveRuntimeAdapter,
  presetStandard,
  standardAdapter,
  presetBun,
  bunAdapter,
  presetNode,
  nodeAdapter,
} from "./adapters";
export {
  DEFAULT_MAX_BODY_SIZE,
  parseRequestBody,
  parseRequestCookies,
  parseRequestHeaders,
} from "./middleware/request-parsers";

export {
  schemaToJsonSchema,
  inferJsonSchemaFromValue,
  DEFAULT_PROBLEM_DETAILS_SCHEMA,
  DEFAULT_VALIDATION_PROBLEM_DETAILS_SCHEMA,
  resolveOpenAPIErrorContracts,
  toOpenAPIPath,
  generateOpenAPISpec,
  renderOpenAPIUI,
  createOpenAPIHandler,
  type OpenAPIHandlerController,
} from "./openapi";

export {
  createClient,
  normalizeProblemDetails,
} from "./client/request-client";

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
