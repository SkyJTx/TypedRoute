/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { APIEvent } from "filesystem-routing/api";
import type { HttpError } from "~/router/api-response";
import type { RouteValidationError } from "./route-definition";

/**
 * External documentation reference for an OpenAPI operation or document.
 */
export interface OpenAPIExternalDocs {
  description?: string;
  url: string;
}

/**
 * Per-route or per-method OpenAPI 3.1 operation metadata.
 */
export interface OpenAPIOperationMeta {
  summary?: string;
  description?: string;
  tags?: readonly string[];
  operationId?: string;
  deprecated?: boolean;
  hidden?: boolean;
  security?: ReadonlyArray<Record<string, readonly string[]>>;
  externalDocs?: OpenAPIExternalDocs;
}

/**
 * JSON Schema Draft 2020-12 / OpenAPI 3.1 Schema Object representation.
 */
export interface JsonSchemaObject {
  $ref?: string;
  type?: string | readonly string[];
  format?: string;
  title?: string;
  description?: string;
  default?: unknown;
  const?: unknown;
  enum?: readonly unknown[];
  properties?: Record<string, JsonSchemaObject>;
  required?: readonly string[];
  additionalProperties?: boolean | JsonSchemaObject;
  items?: JsonSchemaObject;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minItems?: number;
  maxItems?: number;
  anyOf?: readonly JsonSchemaObject[];
  oneOf?: readonly JsonSchemaObject[];
  allOf?: readonly JsonSchemaObject[];
  [key: string]: unknown;
}

export interface OpenAPIParameterObject {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema: JsonSchemaObject;
}

export interface OpenAPIMediaTypeObject {
  schema?: JsonSchemaObject;
}

export interface OpenAPIRequestBodyObject {
  required?: boolean;
  description?: string;
  content: Record<string, OpenAPIMediaTypeObject>;
}

export interface OpenAPIResponseObject {
  description: string;
  content?: Record<string, OpenAPIMediaTypeObject>;
}

export interface OpenAPIOperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: readonly string[];
  deprecated?: boolean;
  security?: ReadonlyArray<Record<string, readonly string[]>>;
  externalDocs?: OpenAPIExternalDocs;
  parameters?: OpenAPIParameterObject[];
  requestBody?: OpenAPIRequestBodyObject;
  responses: Record<string, OpenAPIResponseObject>;
}

export type OpenAPIPathItemObject = Partial<
  Record<
    "get" | "post" | "put" | "patch" | "delete" | "head" | "options" | "query",
    OpenAPIOperationObject
  >
>;

export interface OpenAPIInfoObject {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    identifier?: string;
    url?: string;
  };
}

export interface OpenAPIServerObject {
  url: string;
  description?: string;
}

export interface OpenAPITagObject {
  name: string;
  description?: string;
  externalDocs?: OpenAPIExternalDocs;
}

/**
 * Complete OpenAPI 3.1.0 specification document.
 */
export interface OpenAPIDocument {
  openapi: "3.1.0";
  info: OpenAPIInfoObject;
  servers?: readonly OpenAPIServerObject[];
  tags?: readonly OpenAPITagObject[];
  paths: Record<string, OpenAPIPathItemObject>;
  components?: {
    schemas?: Record<string, JsonSchemaObject>;
    securitySchemes?: Record<string, Record<string, unknown>>;
  };
  externalDocs?: OpenAPIExternalDocs;
}

/**
 * Validation error handler signature shared by `createMiddleware` and OpenAPI error probing.
 */
export type ValidationErrorHandler = (args: {
  error: RouteValidationError;
  rawParams: Record<string, string | undefined>;
  rawSearch: Record<string, unknown>;
  rawBody?: unknown;
  rawHeaders?: Record<string, string | undefined>;
  rawCookies?: Record<string, string | undefined>;
  request: Request;
  isPage: boolean;
}) => Response | Promise<Response | void> | void;

/**
 * API error handler signature shared by `createMiddleware` and OpenAPI error probing.
 */
export type ApiErrorHandler = (args: {
  error: HttpError;
  request: Request;
  event: APIEvent;
}) => Response | Promise<Response | void> | void;

/**
 * Built-in interactive OpenAPI documentation UI vendors.
 */
export type OpenAPIUIVendorPreset = "scalar" | "swagger" | "redoc" | "stoplight";

/**
 * Context passed to custom OpenAPI UI vendor renderers.
 */
export interface OpenAPIUIRendererContext {
  specUrl: string;
  spec: OpenAPIDocument;
  title: string;
}

/**
 * Custom OpenAPI UI renderer function or adapter object supporting any third-party documentation vendor.
 */
export type CustomOpenAPIUIRenderer =
  | ((
      context: OpenAPIUIRendererContext,
    ) => string | Response | Promise<string | Response>)
  | {
      render(
        context: OpenAPIUIRendererContext,
      ): string | Response | Promise<string | Response>;
    };

export type OpenAPIUIOption =
  | OpenAPIUIVendorPreset
  | false
  | CustomOpenAPIUIRenderer;

/**
 * Configuration for `generateOpenAPISpec`.
 */
export interface OpenAPIGeneratorConfig {
  info?: Partial<OpenAPIInfoObject>;
  servers?: readonly OpenAPIServerObject[];
  tags?: readonly OpenAPITagObject[];
  securitySchemes?: Record<string, Record<string, unknown>>;
  externalDocs?: OpenAPIExternalDocs;
  /**
   * Optional validation error handler inspected to reflect custom validation error status codes,
   * media types, and schemas in the generated OpenAPI specification.
   */
  onValidationError?: ValidationErrorHandler;
  /**
   * Optional API error handler inspected to reflect custom error status codes, media types,
   * and schemas in the generated OpenAPI specification.
   */
  onApiError?: ApiErrorHandler;
}

/**
 * Configuration for `createOpenAPIHandler` and `MiddlewareOptions.openapi`.
 */
export interface OpenAPIOptions extends OpenAPIGeneratorConfig {
  /**
   * URL path serving the JSON specification. Defaults to `"/openapi.json"`.
   */
  specPath?: string;
  /**
   * URL path serving the interactive documentation UI. Defaults to `"/docs"`.
   */
  docsPath?: string;
  /**
   * Interactive documentation UI preset (`"scalar"` default, `"swagger"`, `"redoc"`, `"stoplight"`),
   * `false` to disable UI rendering, or a custom vendor renderer function/adapter.
   */
  ui?: OpenAPIUIOption;
}

/**
 * Probed error response contract extracted from `onValidationError` or `onApiError`.
 */
export interface ProbedErrorContract {
  readonly status: number;
  readonly contentType: string;
  readonly componentName: string;
  readonly schema: JsonSchemaObject;
  readonly description: string;
}

/**
 * Combined validation and API error contracts resolved for OpenAPI generation.
 */
export interface ResolvedOpenAPIErrorContracts {
  readonly validationError: ProbedErrorContract;
  readonly apiError: ProbedErrorContract;
}
