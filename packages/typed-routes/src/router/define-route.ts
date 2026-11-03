/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { TypeValidator, InferOutput } from "~/types/type-validator";
import type {
  APIHandlerConfig,
  APIMiddleware,
  ConfiguredAPIHandler,
  DefinedRouteConfig,
  MergeMiddlewareContext,
  RouteConfig,
  RouteLocation,
  RouteValidationError,
  RouteValidationTuple,
  TypedAPIHandler,
} from "~/types/route-definition";
import { CUSTOM_INSPECT_SYMBOL, inspectRoute, type RouteDebugSummary } from "~/debug/inspect";
import { registerAPIHandler } from "./api-handler";

export class DefinedRoute<
  TParams = unknown,
  TSearch = unknown,
  TState = unknown,
  THash = unknown,
  TData = unknown,
  THeaders = undefined,
  TCookies = undefined,
> implements
    DefinedRouteConfig<
      TParams,
      TSearch,
      TState,
      THash,
      TData,
      RouteLocation<TState>,
      THeaders,
      TCookies
    >
{
  public readonly config: RouteConfig<
    TParams,
    TSearch,
    TState,
    THash,
    TData,
    RouteLocation<TState>,
    THeaders,
    TCookies
  >;

  public constructor(
    config: RouteConfig<
      TParams,
      TSearch,
      TState,
      THash,
      TData,
      RouteLocation<TState>,
      THeaders,
      TCookies
    >,
  ) {
    this.config = config;
  }

  public handler<TResult = unknown>(
    fn: TypedAPIHandler<TParams, TSearch, TResult, undefined, THeaders, TCookies, undefined>,
  ): TypedAPIHandler<TParams, TSearch, TResult, undefined, THeaders, TCookies, undefined>;
  public handler<
    B extends TypeValidator<unknown, unknown> | undefined = undefined,
    H extends TypeValidator<unknown, unknown> | undefined = undefined,
    C extends TypeValidator<unknown, unknown> | undefined = undefined,
    S extends TypeValidator<unknown, unknown> | undefined = undefined,
    const M extends readonly APIMiddleware[] | undefined = undefined,
    R extends Record<number, TypeValidator<unknown, unknown>> | undefined = undefined,
    TResult = unknown,
  >(
    config: APIHandlerConfig<B, H, C, S, M, R>,
    fn: TypedAPIHandler<
      TParams,
      S extends TypeValidator<unknown, unknown> ? InferOutput<S> : TSearch,
      TResult,
      InferOutput<B>,
      H extends TypeValidator<unknown, unknown>
        ? InferOutput<H>
        : [THeaders] extends [undefined]
          ? Record<string, string | undefined>
          : THeaders,
      C extends TypeValidator<unknown, unknown>
        ? InferOutput<C>
        : [TCookies] extends [undefined]
          ? Record<string, string | undefined>
          : TCookies,
      MergeMiddlewareContext<M>
    >,
  ): ConfiguredAPIHandler<
    TParams,
    S extends TypeValidator<unknown, unknown> ? InferOutput<S> : TSearch,
    TResult,
    InferOutput<B>,
    H extends TypeValidator<unknown, unknown>
      ? InferOutput<H>
      : [THeaders] extends [undefined]
        ? Record<string, string | undefined>
        : THeaders,
    C extends TypeValidator<unknown, unknown>
      ? InferOutput<C>
      : [TCookies] extends [undefined]
        ? Record<string, string | undefined>
        : TCookies,
    MergeMiddlewareContext<M>,
    R
  >;
  public handler(configOrFn: unknown, maybeFn?: unknown): unknown {
    if (typeof configOrFn === "function") {
      return configOrFn;
    }
    return registerAPIHandler(configOrFn as APIHandlerConfig, maybeFn);
  }

  public toString(): string {
    const summary = inspectRoute(this.config);
    return `DefinedRoute(params=${summary.paramsValidator}, search=${summary.searchValidator})`;
  }

  public [CUSTOM_INSPECT_SYMBOL](): RouteDebugSummary & { readonly [Symbol.toStringTag]: string } {
    return {
      [Symbol.toStringTag]: "DefinedRoute",
      ...inspectRoute(this.config),
    };
  }
}

export function defineRoute<
  P extends TypeValidator<unknown, unknown> | undefined = undefined,
  S extends TypeValidator<unknown, unknown> | undefined = undefined,
  St extends TypeValidator<unknown, unknown> | undefined = undefined,
  H extends TypeValidator<unknown, unknown> | undefined = undefined,
  D = unknown,
  Hd extends TypeValidator<unknown, unknown> | undefined = undefined,
  Ck extends TypeValidator<unknown, unknown> | undefined = undefined,
>(config: {
  params?: P;
  search?: S;
  state?: St;
  hash?: H;
  headers?: Hd;
  cookies?: Ck;
  use?: readonly APIMiddleware[];
  preload?: (args: {
    params: RouteValidationTuple<InferOutput<P>>;
    search: RouteValidationTuple<InferOutput<S>>;
    location: RouteLocation<InferOutput<St>>;
  }) => D;
  onError?: (args: {
    error: RouteValidationError;
    rawParams: Record<string, string | undefined>;
    rawSearch: Record<string, unknown>;
  }) => void;
  info?: Record<string, unknown>;
}): DefinedRouteConfig<
  InferOutput<P>,
  InferOutput<S>,
  InferOutput<St>,
  InferOutput<H>,
  D,
  RouteLocation<InferOutput<St>>,
  Hd extends TypeValidator<unknown, unknown> ? InferOutput<Hd> : undefined,
  Ck extends TypeValidator<unknown, unknown> ? InferOutput<Ck> : undefined
> {
  type TParams = InferOutput<P>;
  type TSearch = InferOutput<S>;
  type TState = InferOutput<St>;
  type THash = InferOutput<H>;
  type THeaders = Hd extends TypeValidator<unknown, unknown> ? InferOutput<Hd> : undefined;
  type TCookies = Ck extends TypeValidator<unknown, unknown> ? InferOutput<Ck> : undefined;

  const routeConfig = config as unknown as RouteConfig<
    TParams,
    TSearch,
    TState,
    THash,
    D,
    RouteLocation<TState>,
    THeaders,
    TCookies
  >;

  return new DefinedRoute<TParams, TSearch, TState, THash, D, THeaders, TCookies>(routeConfig);
}
