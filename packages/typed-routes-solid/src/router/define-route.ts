/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useParams, useSearchParams, useLocation, type Location } from "@solidjs/router";
import {
  CUSTOM_INSPECT_SYMBOL,
  EMPTY_RECORD,
  RouteValidationError,
  evaluateRouteTarget,
  inspectRoute,
  normalizeSearchParams,
  registerAPIHandler,
  type APIHandlerConfig,
  type APIMiddleware,
  type ConfiguredAPIHandler,
  type MergeMiddlewareContext,
  type RouteDebugSummary,
  type RouteValidationTuple,
  type TypeValidator,
  type InferOutput,
  type TypedAPIHandler,
} from "@skyjt/typed-routes";
import type {
  DefinedRouteObject,
  RouteAccessorTuple,
  SolidRouteConfig,
} from "~/types/solid-route";
import {
  createRouteAccessorTuple,
  useRouteValidationContext,
} from "~/context/route-context";

export class SolidDefinedRoute<
  TParams = unknown,
  TSearch = unknown,
  TState = unknown,
  THash = unknown,
  TData = unknown,
  THeaders = undefined,
  TCookies = undefined,
> implements
    DefinedRouteObject<TParams, TSearch, TState, THash, TData, THeaders, TCookies>
{
  public readonly config: SolidRouteConfig<
    TParams,
    TSearch,
    TState,
    THash,
    TData,
    THeaders,
    TCookies
  >;

  public constructor(
    config: SolidRouteConfig<TParams, TSearch, TState, THash, TData, THeaders, TCookies>,
  ) {
    this.config = config;
  }

  public useParams(): RouteAccessorTuple<TParams> {
    const ctx = useRouteValidationContext<TParams, TSearch>();
    if (ctx) {
      return ctx.params;
    }
    const paramsSchema = this?.config?.params;
    const onError = this?.config?.onError;
    const raw = useParams();
    return createRouteAccessorTuple<TParams>(function computeValidatedParams() {
      const rawParamsSnapshot: Record<string, string | undefined> = { ...raw };
      return evaluateRouteTarget<TParams>(
        "params",
        paramsSchema,
        rawParamsSnapshot,
        { rawParams: rawParamsSnapshot, rawSearch: EMPTY_RECORD },
        onError,
      );
    });
  }

  public useSearch(): RouteAccessorTuple<TSearch> {
    const ctx = useRouteValidationContext<TParams, TSearch>();
    if (ctx) {
      return ctx.search;
    }
    const searchSchema = this?.config?.search;
    const onError = this?.config?.onError;
    const [search] = useSearchParams();
    return createRouteAccessorTuple<TSearch>(function computeValidatedSearch() {
      const normalizedSearch = normalizeSearchParams(search);
      return evaluateRouteTarget<TSearch>(
        "search",
        searchSchema,
        normalizedSearch,
        { rawParams: EMPTY_RECORD as Record<string, string | undefined>, rawSearch: normalizedSearch },
        onError,
      );
    });
  }

  public useLocation(): Location<TState> {
    return useLocation<TState>();
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
    return `SolidDefinedRoute(params=${summary.paramsValidator}, search=${summary.searchValidator})`;
  }

  public [CUSTOM_INSPECT_SYMBOL](): RouteDebugSummary & {
    readonly [Symbol.toStringTag]: string;
  } {
    return {
      [Symbol.toStringTag]: "SolidDefinedRoute",
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
    location: Location<InferOutput<St>>;
  }) => D;
  onError?: (args: {
    error: RouteValidationError;
    rawParams: Record<string, string | undefined>;
    rawSearch: Record<string, unknown>;
  }) => void;
  info?: Record<string, unknown>;
}): DefinedRouteObject<
  InferOutput<P>,
  InferOutput<S>,
  InferOutput<St>,
  InferOutput<H>,
  D,
  Hd extends TypeValidator<unknown, unknown> ? InferOutput<Hd> : undefined,
  Ck extends TypeValidator<unknown, unknown> ? InferOutput<Ck> : undefined
> {
  type TParams = InferOutput<P>;
  type TSearch = InferOutput<S>;
  type TState = InferOutput<St>;
  type THash = InferOutput<H>;
  type THeaders = Hd extends TypeValidator<unknown, unknown> ? InferOutput<Hd> : undefined;
  type TCookies = Ck extends TypeValidator<unknown, unknown> ? InferOutput<Ck> : undefined;

  const routeConfig = config as unknown as SolidRouteConfig<
    TParams,
    TSearch,
    TState,
    THash,
    D,
    THeaders,
    TCookies
  >;

  return new SolidDefinedRoute<TParams, TSearch, TState, THash, D, THeaders, TCookies>(routeConfig);
}
