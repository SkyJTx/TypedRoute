/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { APIHandlerConfig, APIMiddleware } from "~/types/route-definition";
import type { TypeValidator } from "~/types/type-validator";
import {
  compileAsyncValidator,
  type CompiledAsyncValidator,
} from "~/schema/validator-adapter";
import {
  CUSTOM_INSPECT_SYMBOL,
  HANDLER_FLAG_NONE,
  HANDLER_FLAG_HAS_SEARCH_SCHEMA,
  HANDLER_FLAG_HAS_BODY_SCHEMA,
  HANDLER_FLAG_HAS_HEADERS_SCHEMA,
  HANDLER_FLAG_HAS_COOKIES_SCHEMA,
  HANDLER_FLAG_HAS_MIDDLEWARE,
  HANDLER_FLAG_HAS_RESPONSES_SCHEMA,
  describeValidator,
  formatHandlerFlags,
} from "~/debug/inspect";

/**
 * Monomorphic compiled metadata node associated with a configured API handler function.
 */
export class CompiledAPIHandlerMeta {
  public readonly flags: number;
  public readonly config: APIHandlerConfig;
  public readonly compiledSearchValidator: CompiledAsyncValidator | undefined;
  public readonly compiledBodyValidator: CompiledAsyncValidator | undefined;
  public readonly compiledHeadersValidator: CompiledAsyncValidator | undefined;
  public readonly compiledCookiesValidator: CompiledAsyncValidator | undefined;
  public readonly compiledResponseValidators: Map<number, CompiledAsyncValidator> | undefined;
  public readonly middleware: readonly APIMiddleware[] | undefined;

  public constructor(config: APIHandlerConfig) {
    let flags = HANDLER_FLAG_NONE;
    let searchVal: CompiledAsyncValidator | undefined;
    let bodyVal: CompiledAsyncValidator | undefined;
    let headersVal: CompiledAsyncValidator | undefined;
    let cookiesVal: CompiledAsyncValidator | undefined;
    let responseVals: Map<number, CompiledAsyncValidator> | undefined;
    let mw: readonly APIMiddleware[] | undefined;

    if (config.search !== undefined) {
      flags |= HANDLER_FLAG_HAS_SEARCH_SCHEMA;
      searchVal = compileAsyncValidator(config.search as TypeValidator<unknown>);
    }
    if (config.body !== undefined) {
      flags |= HANDLER_FLAG_HAS_BODY_SCHEMA;
      bodyVal = compileAsyncValidator(config.body as TypeValidator<unknown>);
    }
    if (config.headers !== undefined) {
      flags |= HANDLER_FLAG_HAS_HEADERS_SCHEMA;
      headersVal = compileAsyncValidator(config.headers as TypeValidator<unknown>);
    }
    if (config.cookies !== undefined) {
      flags |= HANDLER_FLAG_HAS_COOKIES_SCHEMA;
      cookiesVal = compileAsyncValidator(config.cookies as TypeValidator<unknown>);
    }
    if (config.use !== undefined && config.use.length > 0) {
      flags |= HANDLER_FLAG_HAS_MIDDLEWARE;
      mw = config.use;
    }
    if (config.responses !== undefined) {
      const entries = Object.entries(config.responses);
      if (entries.length > 0) {
        flags |= HANDLER_FLAG_HAS_RESPONSES_SCHEMA;
        responseVals = new Map<number, CompiledAsyncValidator>();
        for (let i = 0; i < entries.length; i++) {
          const [statusKey, schema] = entries[i];
          const statusCode = Number(statusKey);
          if (!Number.isNaN(statusCode) && schema !== undefined) {
            responseVals.set(
              statusCode,
              compileAsyncValidator(schema as TypeValidator<unknown>),
            );
          }
        }
      }
    }

    this.flags = flags;
    this.config = config;
    this.compiledSearchValidator = searchVal;
    this.compiledBodyValidator = bodyVal;
    this.compiledHeadersValidator = headersVal;
    this.compiledCookiesValidator = cookiesVal;
    this.compiledResponseValidators = responseVals;
    this.middleware = mw;
  }

  public [CUSTOM_INSPECT_SYMBOL](): Record<string, unknown> {
    return {
      [Symbol.toStringTag]: "CompiledAPIHandlerMeta",
      flags: formatHandlerFlags(this.flags),
      searchValidator: describeValidator(this.config.search),
      bodyValidator: describeValidator(this.config.body),
      headersValidator: describeValidator(this.config.headers),
      cookiesValidator: describeValidator(this.config.cookies),
      middlewareCount: this.middleware ? this.middleware.length : 0,
      responseStatuses: this.compiledResponseValidators
        ? Array.from(this.compiledResponseValidators.keys())
        : [],
    };
  }
}

const apiHandlerMetaMap = new WeakMap<object, CompiledAPIHandlerMeta>();

/**
 * Defines a strongly-typed API middleware function that can short-circuit with a `Response`
 * or return a context object to be merged into `event.context`.
 */
export function defineMiddleware<
  TContextOut extends Record<string, unknown> = Record<string, unknown>,
>(fn: APIMiddleware<TContextOut>): APIMiddleware<TContextOut> {
  return fn;
}

/**
 * Associates per-method `APIHandlerConfig` metadata with an API handler function in `apiHandlerMetaMap`
 * and returns the original function without wrapper closure allocation.
 */
export function registerAPIHandler<THandler>(
  config: APIHandlerConfig,
  fn: THandler,
): THandler {
  if (typeof fn === "function") {
    const meta = new CompiledAPIHandlerMeta(config);
    if (meta.flags !== HANDLER_FLAG_NONE) {
      apiHandlerMetaMap.set(fn as object, meta);
    }
  }
  return fn;
}

/**
 * Retrieves compiled per-method metadata for an API handler function in O(1) time.
 */
export function getAPIHandlerMeta(fn: unknown): CompiledAPIHandlerMeta | undefined {
  if (typeof fn !== "function") {
    return undefined;
  }
  return apiHandlerMetaMap.get(fn as object);
}
