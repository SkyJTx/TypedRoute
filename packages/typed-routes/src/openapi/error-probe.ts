/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  defaultOnApiError,
  defaultOnValidationError,
} from "~/middleware/error-handlers";
import {
  HttpError,
  getTypedResponseMeta,
} from "~/router/api-response";
import type {
  ApiErrorHandler,
  JsonSchemaObject,
  ProbedErrorContract,
  ResolvedOpenAPIErrorContracts,
  ValidationErrorHandler,
} from "~/types/openapi";
import { RouteValidationError } from "~/types/route-definition";
import { inferJsonSchemaFromValue, schemaToJsonSchema } from "./json-schema";

/**
 * Standard RFC 9457 Problem Details JSON Schema for OpenAPI 3.1 `components.schemas.ProblemDetails`.
 */
export const DEFAULT_PROBLEM_DETAILS_SCHEMA: JsonSchemaObject = Object.freeze({
  type: "object",
  title: "ProblemDetails",
  description: "RFC 9457 Problem Details for HTTP APIs",
  properties: {
    type: { type: "string", format: "uri-reference", default: "about:blank" },
    title: { type: "string" },
    status: { type: "integer" },
    detail: { type: "string" },
    instance: { type: "string", format: "uri-reference" },
    code: { type: "string" },
    details: {},
  },
  required: ["type", "title", "status"],
});

/**
 * Standard RFC 9457 Validation Problem Details JSON Schema for OpenAPI 3.1 `components.schemas.ValidationProblemDetails`.
 */
export const DEFAULT_VALIDATION_PROBLEM_DETAILS_SCHEMA: JsonSchemaObject = Object.freeze({
  type: "object",
  title: "ValidationProblemDetails",
  description: "RFC 9457 Problem Details for request or response validation failures",
  properties: {
    type: {
      type: "string",
      format: "uri-reference",
      default: "https://datatracker.ietf.org/doc/html/rfc9457",
    },
    title: { type: "string" },
    status: { type: "integer" },
    detail: { type: "string" },
    instance: { type: "string", format: "uri-reference" },
    target: {
      type: "string",
      enum: ["params", "search", "state", "hash", "body", "headers", "cookies", "response"],
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          message: { type: "string" },
          path: { type: "string" },
        },
        required: ["message"],
      },
    },
  },
  required: ["type", "title", "status", "target", "issues"],
});

function normalizeMediaType(rawContentType: string | null | undefined): string {
  if (!rawContentType) {
    return "application/json";
  }
  const semiIdx = rawContentType.indexOf(";");
  return (semiIdx === -1 ? rawContentType : rawContentType.slice(0, semiIdx)).trim();
}

async function extractResponseContract(
  response: Response,
  componentName: string,
  defaultDescription: string,
): Promise<ProbedErrorContract> {
  const meta = getTypedResponseMeta(response);
  if (meta !== undefined) {
    const contentType = meta.contentType || normalizeMediaType(response.headers.get("content-type"));
    const schema =
      meta.schema !== undefined
        ? schemaToJsonSchema(meta.schema)
        : inferJsonSchemaFromValue(meta.body);
    return {
      status: meta.status,
      contentType,
      componentName,
      schema,
      description: defaultDescription,
    };
  }

  const contentType = normalizeMediaType(response.headers.get("content-type"));
  let schema: JsonSchemaObject = {};
  if (contentType.includes("json")) {
    try {
      const clonedBody: unknown = await response.clone().json();
      schema = inferJsonSchemaFromValue(clonedBody);
    } catch {
      schema = {};
    }
  } else if (contentType.startsWith("text/")) {
    schema = { type: "string" };
  }

  return {
    status: response.status || 400,
    contentType,
    componentName,
    schema,
    description: defaultDescription,
  };
}

/**
 * Probes `onValidationError` and `onApiError` (using RFC 9457 defaults when omitted)
 * so any customization to either error handler is automatically reflected in the OpenAPI 3.1 spec.
 */
export async function resolveOpenAPIErrorContracts(options?: {
  onValidationError?: ValidationErrorHandler;
  onApiError?: ApiErrorHandler;
}): Promise<ResolvedOpenAPIErrorContracts> {
  const defaultValidationContract: ProbedErrorContract = {
    status: 400,
    contentType: "application/problem+json",
    componentName: "ValidationProblemDetails",
    schema: DEFAULT_VALIDATION_PROBLEM_DETAILS_SCHEMA,
    description: "Validation Failed (RFC 9457 Problem Details)",
  };

  const defaultApiContract: ProbedErrorContract = {
    status: 500,
    contentType: "application/problem+json",
    componentName: "ProblemDetails",
    schema: DEFAULT_PROBLEM_DETAILS_SCHEMA,
    description: "API Error (RFC 9457 Problem Details)",
  };

  let validationError = defaultValidationContract;
  if (
    options?.onValidationError !== undefined &&
    options.onValidationError !== defaultOnValidationError
  ) {
    try {
      const probeRequest = new Request("http://localhost/openapi-probe");
      const probeErr = new RouteValidationError(
        "body",
        [{ message: "Invalid field", path: "field" }],
        { rawParams: {}, rawSearch: {} },
      );
      const outcome = await options.onValidationError({
        error: probeErr,
        rawParams: {},
        rawSearch: {},
        rawBody: {},
        request: probeRequest,
        isPage: false,
      });
      if (outcome instanceof Response) {
        validationError = await extractResponseContract(
          outcome,
          "ValidationErrorResponse",
          "Validation Failed",
        );
      }
    } catch {
      validationError = defaultValidationContract;
    }
  }

  let apiError = defaultApiContract;
  if (options?.onApiError !== undefined && options.onApiError !== defaultOnApiError) {
    try {
      const probeRequest = new Request("http://localhost/openapi-probe");
      const probeHttpErr = new HttpError(500, "Error message", {
        code: "ERROR_CODE",
        details: {},
      });
      const outcome = await options.onApiError({
        error: probeHttpErr,
        request: probeRequest,
        event: { request: probeRequest },
      });
      if (outcome instanceof Response) {
        apiError = await extractResponseContract(
          outcome,
          "ApiErrorResponse",
          "API Error Response",
        );
      }
    } catch {
      apiError = defaultApiContract;
    }
  }

  return {
    validationError,
    apiError,
  };
}
