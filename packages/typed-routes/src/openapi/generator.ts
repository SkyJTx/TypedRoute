/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { httpHandlerKeys, toRadixPath, type HttpMethodKey } from "~/middleware/route-matcher";
import { extractRouteConfig, isRecord } from "~/middleware/route-meta";
import { getAPIHandlerMeta } from "~/router/api-handler";
import { getHttpStatusTitle } from "~/types/problem-details";
import type {
  JsonSchemaObject,
  OpenAPIDocument,
  OpenAPIGeneratorConfig,
  OpenAPIOperationMeta,
  OpenAPIOperationObject,
  OpenAPIParameterObject,
  OpenAPIPathItemObject,
  OpenAPIResponseObject,
} from "~/types/openapi";
import type { MiddlewareHandlerRef, MiddlewareRouteEntry } from "~/types/route-definition";
import { resolveOpenAPIErrorContracts } from "./error-probe";
import { schemaToJsonSchema } from "./json-schema";

/**
 * Converts a route manifest pattern (e.g., `"/api/users/:id"` or `"/(group)/items/[id]"`)
 * into an OpenAPI 3.1 path template (`"/api/users/{id}"`) and extracts path parameter names.
 */
export function toOpenAPIPath(pattern: string): {
  openApiPath: string;
  pathParamNames: string[];
} {
  const radix = toRadixPath(pattern);
  const trimmed =
    radix.length > 1 && radix.endsWith("/") ? radix.slice(0, -1) : radix || "/";
  const segments = trimmed.split("/");
  const pathParamNames: string[] = [];
  const normalizedSegments: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) {
      normalizedSegments.push("");
      continue;
    }
    if (seg.startsWith(":")) {
      const name = seg.endsWith("?") ? seg.slice(1, -1) : seg.slice(1);
      pathParamNames.push(name);
      normalizedSegments.push(`{${name}}`);
    } else if (seg.startsWith("*")) {
      const name = seg.slice(1) || "wildcard";
      pathParamNames.push(name);
      normalizedSegments.push(`{${name}}`);
    } else {
      normalizedSegments.push(seg);
    }
  }

  const openApiPath = normalizedSegments.join("/") || "/";
  return { openApiPath, pathParamNames };
}

function buildObjectParameters(
  location: "query" | "header" | "cookie",
  schemaValidator: unknown,
): OpenAPIParameterObject[] {
  if (schemaValidator === undefined) {
    return [];
  }
  const jsonSchema = schemaToJsonSchema(schemaValidator);
  const props = jsonSchema.properties;
  if (!props) {
    return [];
  }
  const requiredSet = new Set(jsonSchema.required ?? []);
  const keys = Object.keys(props);
  const params: OpenAPIParameterObject[] = [];

  for (let i = 0; i < keys.length; i++) {
    const name = keys[i];
    const propSchema = props[name];
    params.push({
      name,
      in: location,
      required: requiredSet.has(name),
      ...(propSchema.description ? { description: propSchema.description } : {}),
      schema: propSchema,
    });
  }
  return params;
}

function mergeOperationMeta(
  routeMeta: OpenAPIOperationMeta | undefined,
  handlerMeta: OpenAPIOperationMeta | undefined,
): OpenAPIOperationMeta {
  return {
    summary: handlerMeta?.summary ?? routeMeta?.summary,
    description: handlerMeta?.description ?? routeMeta?.description,
    tags: handlerMeta?.tags ?? routeMeta?.tags,
    operationId: handlerMeta?.operationId ?? routeMeta?.operationId,
    deprecated: handlerMeta?.deprecated ?? routeMeta?.deprecated,
    hidden: handlerMeta?.hidden ?? routeMeta?.hidden,
    security: handlerMeta?.security ?? routeMeta?.security,
    externalDocs: handlerMeta?.externalDocs ?? routeMeta?.externalDocs,
  };
}

async function resolveModuleExport(
  ref: MiddlewareHandlerRef,
  method: string,
): Promise<unknown> {
  const mod = "require" in ref ? ref.require() : await ref.import();
  if (!isRecord(mod)) {
    return undefined;
  }
  return mod[method];
}

/**
 * Introspects a route manifest and generates a complete OpenAPI 3.1.0 specification document.
 * Automatically reflects `TypedResponse` schemas and any custom `onValidationError` / `onApiError` handlers.
 */
export async function generateOpenAPISpec(
  routes: readonly MiddlewareRouteEntry[],
  config?: OpenAPIGeneratorConfig,
): Promise<OpenAPIDocument> {
  const errorContracts = await resolveOpenAPIErrorContracts({
    onValidationError: config?.onValidationError,
    onApiError: config?.onApiError,
  });

  const paths: Record<string, OpenAPIPathItemObject> = {};
  const schemas: Record<string, JsonSchemaObject> = {
    [errorContracts.validationError.componentName]: errorContracts.validationError.schema,
    [errorContracts.apiError.componentName]: errorContracts.apiError.schema,
  };

  for (let i = 0; i < routes.length; i++) {
    const entry = routes[i];
    const routeConfig = extractRouteConfig(entry);
    const { openApiPath, pathParamNames } = toOpenAPIPath(entry.path);
    const routeParamsSchema =
      routeConfig?.params !== undefined ? schemaToJsonSchema(routeConfig.params) : undefined;
    const routeParamProperties = routeParamsSchema?.properties ?? {};

    for (let m = 0; m < httpHandlerKeys.length; m++) {
      const propKey = httpHandlerKeys[m];
      const method = propKey.slice(1);
      const handlerRef = entry[propKey as HttpMethodKey];
      if (!handlerRef) {
        continue;
      }

      const handlerFn = await resolveModuleExport(handlerRef, method);
      if (typeof handlerFn !== "function") {
        continue;
      }

      const compiledMeta = getAPIHandlerMeta(handlerFn);
      const handlerConfig = compiledMeta?.config;
      const mergedMeta = mergeOperationMeta(routeConfig?.openapi, handlerConfig?.openapi);
      if (mergedMeta.hidden === true) {
        continue;
      }

      const parameters: OpenAPIParameterObject[] = [];
      for (let p = 0; p < pathParamNames.length; p++) {
        const paramName = pathParamNames[p];
        const paramSchema = routeParamProperties[paramName] ?? { type: "string" };
        parameters.push({
          name: paramName,
          in: "path",
          required: true,
          ...(paramSchema.description ? { description: paramSchema.description } : {}),
          schema: paramSchema,
        });
      }

      const activeSearchSchema = handlerConfig?.search ?? routeConfig?.search;
      const activeHeadersSchema = handlerConfig?.headers ?? routeConfig?.headers;
      const activeCookiesSchema = handlerConfig?.cookies ?? routeConfig?.cookies;
      const activeBodySchema = handlerConfig?.body;

      parameters.push(...buildObjectParameters("query", activeSearchSchema));
      parameters.push(...buildObjectParameters("header", activeHeadersSchema));
      parameters.push(...buildObjectParameters("cookie", activeCookiesSchema));

      const hasValidationSchemas =
        routeConfig?.params !== undefined ||
        activeSearchSchema !== undefined ||
        activeHeadersSchema !== undefined ||
        activeCookiesSchema !== undefined ||
        activeBodySchema !== undefined;

      const responses: Record<string, OpenAPIResponseObject> = {};
      if (handlerConfig?.responses !== undefined) {
        const statusKeys = Object.keys(handlerConfig.responses);
        for (let s = 0; s < statusKeys.length; s++) {
          const statusKey = statusKeys[s];
          const statusNum = Number(statusKey);
          const respValidator = handlerConfig.responses[statusNum];
          if (respValidator !== undefined) {
            responses[statusKey] = {
              description: getHttpStatusTitle(statusNum),
              content: {
                "application/json": {
                  schema: schemaToJsonSchema(respValidator),
                },
              },
            };
          }
        }
      }

      if (Object.keys(responses).length === 0) {
        responses["200"] = {
          description: "OK",
          content: {
            "application/json": {
              schema: {},
            },
          },
        };
      }

      const valStatusKey = String(errorContracts.validationError.status);
      if (hasValidationSchemas && responses[valStatusKey] === undefined) {
        responses[valStatusKey] = {
          description: errorContracts.validationError.description,
          content: {
            [errorContracts.validationError.contentType]: {
              schema: {
                $ref: `#/components/schemas/${errorContracts.validationError.componentName}`,
              },
            },
          },
        };
      }

      if (responses.default === undefined) {
        responses.default = {
          description: errorContracts.apiError.description,
          content: {
            [errorContracts.apiError.contentType]: {
              schema: {
                $ref: `#/components/schemas/${errorContracts.apiError.componentName}`,
              },
            },
          },
        };
      }

      const operation: OpenAPIOperationObject = {
        ...(mergedMeta.operationId ? { operationId: mergedMeta.operationId } : {}),
        ...(mergedMeta.summary ? { summary: mergedMeta.summary } : {}),
        ...(mergedMeta.description ? { description: mergedMeta.description } : {}),
        ...(mergedMeta.tags ? { tags: mergedMeta.tags } : {}),
        ...(mergedMeta.deprecated !== undefined ? { deprecated: mergedMeta.deprecated } : {}),
        ...(mergedMeta.security ? { security: mergedMeta.security } : {}),
        ...(mergedMeta.externalDocs ? { externalDocs: mergedMeta.externalDocs } : {}),
        ...(parameters.length > 0 ? { parameters } : {}),
        ...(activeBodySchema !== undefined
          ? {
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: schemaToJsonSchema(activeBodySchema),
                  },
                },
              },
            }
          : {}),
        responses,
      };

      const methodKey = method.toLowerCase() as keyof OpenAPIPathItemObject;
      if (!paths[openApiPath]) {
        paths[openApiPath] = {};
      }
      paths[openApiPath][methodKey] = operation;
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: config?.info?.title ?? "TypedRoute API",
      version: config?.info?.version ?? "1.0.0",
      ...(config?.info?.description ? { description: config?.info.description } : {}),
      ...(config?.info?.termsOfService ? { termsOfService: config?.info.termsOfService } : {}),
      ...(config?.info?.contact ? { contact: config?.info.contact } : {}),
      ...(config?.info?.license ? { license: config?.info.license } : {}),
    },
    ...(config?.servers ? { servers: config.servers } : {}),
    ...(config?.tags ? { tags: config.tags } : {}),
    paths,
    components: {
      schemas,
      ...(config?.securitySchemes ? { securitySchemes: config.securitySchemes } : {}),
    },
    ...(config?.externalDocs ? { externalDocs: config.externalDocs } : {}),
  };
}
