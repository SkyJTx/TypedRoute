/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { Location } from "@solidjs/router";
import type {
  APIHandlerConfig,
  APIMiddleware,
  ConfiguredAPIHandler,
  InferOutput,
  MergeMiddlewareContext,
  RouteConfig,
  RouteValidationError,
  TypeValidator,
  TypedAPIHandler,
  ExtractRoutePaths,
  RouteParamsFor,
  RouteSearchFor,
  NavigationArgs,
} from "@skyjt/typed-routes";

export type RouteAccessorTuple<T> = readonly [
  data: Accessor<T | undefined>,
  error: Accessor<RouteValidationError | undefined>,
];

export interface SolidRouteConfig<
  TParams = unknown,
  TSearch = unknown,
  TState = unknown,
  THash = unknown,
  TData = unknown,
  THeaders = undefined,
  TCookies = undefined,
> extends RouteConfig<
    TParams,
    TSearch,
    TState,
    THash,
    TData,
    Location<TState>,
    THeaders,
    TCookies
  > {}

export interface RouteValidationContextValue<
  TParams = unknown,
  TSearch = unknown,
> {
  params: RouteAccessorTuple<TParams>;
  search: RouteAccessorTuple<TSearch>;
}

export interface DefinedRouteObject<
  TParams = unknown,
  TSearch = unknown,
  TState = unknown,
  THash = unknown,
  TData = unknown,
  THeaders = undefined,
  TCookies = undefined,
> {
  readonly config: SolidRouteConfig<TParams, TSearch, TState, THash, TData, THeaders, TCookies>;
  useParams(): RouteAccessorTuple<TParams>;
  useSearch(): RouteAccessorTuple<TSearch>;
  useLocation(): Location<TState>;
  handler<TResult = unknown>(
    fn: TypedAPIHandler<TParams, TSearch, TResult, undefined, THeaders, TCookies, undefined>,
  ): TypedAPIHandler<TParams, TSearch, TResult, undefined, THeaders, TCookies, undefined>;
  handler<
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
}

export type LinkProps<
  TManifest extends readonly unknown[],
  Path extends ExtractRoutePaths<TManifest>,
> = NavigationArgs<RouteParamsFor<TManifest, Path>, RouteSearchFor<TManifest, Path>, unknown> &
  Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    to: Path;
  };
