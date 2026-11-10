/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { extractRequestPathname } from "~/middleware/error-handlers";
import { isRecord } from "~/middleware/route-meta";
import { joinBaseAndPath } from "~/router/cross-app";
import { buildUrl } from "~/router/path-builder";
import { getHttpStatusTitle, type ProblemDetails } from "~/types/problem-details";
import type {
  ClientHttpMethod,
  ClientResultTuple,
  RequestClientOptions,
  TypedRequestClient,
} from "~/types/request-client";

function isRawBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === "string" ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    (typeof ReadableStream !== "undefined" && value instanceof ReadableStream)
  );
}

/**
 * Normalizes a non-2xx HTTP response payload into an RFC 9457 `ProblemDetails` object.
 */
export function normalizeProblemDetails(
  status: number,
  parsedBody: unknown,
  requestUrl: string,
): ProblemDetails {
  const instance = extractRequestPathname(requestUrl);
  const defaultTitle = getHttpStatusTitle(status);

  if (isRecord(parsedBody)) {
    const type = typeof parsedBody.type === "string" ? parsedBody.type : "about:blank";
    const title = typeof parsedBody.title === "string" ? parsedBody.title : defaultTitle;
    const resolvedStatus = typeof parsedBody.status === "number" ? parsedBody.status : status;
    const detail =
      typeof parsedBody.detail === "string"
        ? parsedBody.detail
        : typeof parsedBody.error === "string"
          ? parsedBody.error
          : typeof parsedBody.message === "string"
            ? parsedBody.message
            : defaultTitle;

    return {
      ...parsedBody,
      type,
      title,
      status: resolvedStatus,
      detail,
      instance: typeof parsedBody.instance === "string" ? parsedBody.instance : instance,
    };
  }

  const detail =
    typeof parsedBody === "string" && parsedBody.length > 0 ? parsedBody : defaultTitle;

  return {
    type: "about:blank",
    title: defaultTitle,
    status,
    detail,
    instance,
  };
}

/**
 * Creates a method-first End-to-End Type Safety Request Client bound to a route manifest.
 * Every method call resolves to a `[data, error]` tuple where `error` conforms to RFC 9457 `ProblemDetails`.
 */
export function createClient<
  const TManifest extends readonly unknown[],
  TError = ProblemDetails,
>(options: RequestClientOptions = {}): TypedRequestClient<TManifest, TError> {
  const baseUrl = options.baseUrl ?? "";
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const baseInit = options.init;

  async function executeRequest<TData>(
    method: ClientHttpMethod,
    path: string,
    reqOptions?: {
      params?: Record<string, unknown>;
      search?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: unknown;
      headers?: Record<string, string>;
      init?: Omit<RequestInit, "method" | "body">;
    },
  ): Promise<ClientResultTuple<TData, TError>> {
    const builtRelative = buildUrl(path, {
      params: reqOptions?.params,
      search: reqOptions?.search ?? reqOptions?.query,
    });
    const targetUrl = joinBaseAndPath(baseUrl, builtRelative);

    try {
      const mergedHeaders = new Headers();
      if (options.headers !== undefined) {
        const resolvedBaseHeaders =
          typeof options.headers === "function"
            ? await options.headers()
            : options.headers;
        const baseHeaderEntries = new Headers(resolvedBaseHeaders);
        baseHeaderEntries.forEach((val, key) => {
          mergedHeaders.set(key, val);
        });
      }

      if (reqOptions?.init?.headers !== undefined) {
        const initHeaderEntries = new Headers(reqOptions.init.headers);
        initHeaderEntries.forEach((val, key) => {
          mergedHeaders.set(key, val);
        });
      }

      if (reqOptions?.headers !== undefined) {
        const keys = Object.keys(reqOptions.headers);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const v = reqOptions.headers[k];
          if (v !== undefined) {
            mergedHeaders.set(k, v);
          }
        }
      }

      let bodyInit: BodyInit | undefined;
      if (reqOptions?.body !== undefined && method !== "GET" && method !== "HEAD") {
        if (isRawBodyInit(reqOptions.body)) {
          bodyInit = reqOptions.body;
        } else {
          bodyInit = JSON.stringify(reqOptions.body);
          if (!mergedHeaders.has("content-type")) {
            mergedHeaders.set("content-type", "application/json; charset=utf-8");
          }
        }
      }

      const finalInit: RequestInit = {
        ...baseInit,
        ...reqOptions?.init,
        method,
        headers: mergedHeaders,
        ...(bodyInit !== undefined ? { body: bodyInit } : {}),
      };

      if (options.onRequest !== undefined) {
        await options.onRequest({ url: targetUrl, method, init: finalInit });
      }

      const response = await fetchImpl(targetUrl, finalInit);

      if (options.onResponse !== undefined) {
        await options.onResponse({ url: targetUrl, method, response });
      }

      const contentType = response.headers.get("content-type") ?? "";
      const isJson =
        contentType.includes("application/json") || contentType.includes("+json");

      if (response.ok) {
        if (response.status === 204 || method === "HEAD") {
          return [null as unknown as TData, undefined];
        }
        if (isJson) {
          const jsonPayload = (await response.json()) as TData;
          return [jsonPayload, undefined];
        }
        const textPayload = (await response.text()) as unknown as TData;
        return [textPayload, undefined];
      }

      let errorBody: unknown;
      if (isJson) {
        try {
          errorBody = await response.json();
        } catch {
          errorBody = undefined;
        }
      } else {
        try {
          errorBody = await response.text();
        } catch {
          errorBody = undefined;
        }
      }

      const problemDetails = normalizeProblemDetails(
        response.status,
        errorBody,
        targetUrl,
      ) as unknown as TError;
      return [undefined, problemDetails];
    } catch (err) {
      const networkProblem: ProblemDetails = {
        type: "about:blank",
        title: "Network Error",
        status: 0,
        detail: err instanceof Error ? err.message : String(err),
        instance: extractRequestPathname(targetUrl),
      };
      return [undefined, networkProblem as unknown as TError];
    }
  }

  return {
    get(path, ...args) {
      return executeRequest("GET", path, args[0] as Record<string, unknown> | undefined);
    },
    post(path, ...args) {
      return executeRequest("POST", path, args[0] as Record<string, unknown> | undefined);
    },
    put(path, ...args) {
      return executeRequest("PUT", path, args[0] as Record<string, unknown> | undefined);
    },
    patch(path, ...args) {
      return executeRequest("PATCH", path, args[0] as Record<string, unknown> | undefined);
    },
    delete(path, ...args) {
      return executeRequest("DELETE", path, args[0] as Record<string, unknown> | undefined);
    },
    head(path, ...args) {
      return executeRequest("HEAD", path, args[0] as Record<string, unknown> | undefined);
    },
    options(path, ...args) {
      return executeRequest("OPTIONS", path, args[0] as Record<string, unknown> | undefined);
    },
    query(path, ...args) {
      return executeRequest("QUERY", path, args[0] as Record<string, unknown> | undefined);
    },
    request(method, path, ...args) {
      return executeRequest(method, path, args[0] as Record<string, unknown> | undefined);
    },
  };
}
