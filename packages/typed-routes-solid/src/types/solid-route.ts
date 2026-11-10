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
  AppManifestMap,
  ConfiguredAPIHandler,
  CrossAppConfigs,
  CrossAppNavigationArgs,
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
  ): ConfiguredAPIHandler<
    TParams,
    TSearch,
    TResult,
    undefined,
    THeaders,
    TCookies,
    undefined,
    undefined
  >;
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
      B extends TypeValidator<unknown, unknown> ? InferOutput<B> : undefined,
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
    B extends TypeValidator<unknown, unknown> ? InferOutput<B> : undefined,
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

/**
 * Props for a local route `<Link to={...} />`.
 */
export type LinkProps<
  TManifest extends readonly unknown[],
  Path extends ExtractRoutePaths<TManifest>,
> = NavigationArgs<RouteParamsFor<TManifest, Path>, RouteSearchFor<TManifest, Path>, unknown> &
  Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    app?: undefined;
    to: Path;
  };

/**
 * Props for a cross-application `<Link app={...} to={...} />`.
 */
export type CrossAppLinkProps<
  TApps extends AppManifestMap,
  TApp extends keyof TApps & string,
  Path extends ExtractRoutePaths<TApps[TApp]>,
> = CrossAppNavigationArgs<
  RouteParamsFor<TApps[TApp], Path>,
  RouteSearchFor<TApps[TApp], Path>
> &
  Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    app: TApp;
    to: Path;
    apps?: CrossAppConfigs<TApps>;
  };

/**
 * Overloaded `<Link>` component supporting both local routes and cross-application routes.
 */
export interface TypedLinkComponent<
  TManifest extends readonly unknown[],
  TApps extends AppManifestMap = Record<string, never>,
> {
  <Path extends ExtractRoutePaths<TManifest> = ExtractRoutePaths<TManifest>>(
    props: LinkProps<TManifest, Path>,
  ): JSX.Element;
  <
    TApp extends keyof TApps & string,
    Path extends ExtractRoutePaths<TApps[TApp]> = ExtractRoutePaths<TApps[TApp]>,
  >(
    props: CrossAppLinkProps<TApps, TApp, Path>,
  ): JSX.Element;
}

/**
 * Overloaded `navigate` function returned by `useNavigate()`, supporting both local SPA navigation
 * (2 arguments: `to`, `options?`) and cross-application navigation (3 arguments: `app`, `to`, `options?`).
 */
export interface TypedNavigateFn<
  TManifest extends readonly unknown[],
  TApps extends AppManifestMap = Record<string, never>,
> {
  <Path extends ExtractRoutePaths<TManifest>>(
    to: Path,
    options?: NavigationArgs<
      RouteParamsFor<TManifest, Path>,
      RouteSearchFor<TManifest, Path>,
      unknown
    >,
  ): void;
  <
    TApp extends keyof TApps & string,
    Path extends ExtractRoutePaths<TApps[TApp]>,
  >(
    app: TApp,
    to: Path,
    options?: CrossAppNavigationArgs<
      RouteParamsFor<TApps[TApp], Path>,
      RouteSearchFor<TApps[TApp], Path>
    >,
  ): string;
}
