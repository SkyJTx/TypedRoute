/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { Location } from "@solidjs/router";
import type {
  RouteConfig,
  RouteValidationError,
  TypedAPIHandler,
  ExtractRoutePaths,
  RouteParamsFor,
  RouteSearchFor,
  NavigationArgs,
} from "@skyjt/typed-routes";

/**
 * Reactive SolidJS tuple of accessors returned by `route.useParams()` and `route.useSearch()`.
 *
 * Follows Solid's `createSignal` convention: unpacked once at component setup
 * (`const [params, paramsError] = route.useParams()`), where `params()` and `paramsError()`
 * are fine-grained reactive accessors. Pair with `<Show when={params()}>` to promote `params`
 * to `Accessor<NonNullable<T>>`.
 */
export type RouteAccessorTuple<T> = readonly [
  data: Accessor<T | undefined>,
  error: Accessor<RouteValidationError | undefined>,
];

/**
 * SolidJS route configuration extending core RouteConfig with SolidJS Location type.
 */
export interface SolidRouteConfig<
  TParams = unknown,
  TSearch = unknown,
  TState = unknown,
  THash = unknown,
  TData = unknown,
> extends RouteConfig<TParams, TSearch, TState, THash, TData, Location<TState>> {}

/**
 * Route validation context accessors for SolidJS.
 */
export interface RouteValidationContextValue<
  TParams = unknown,
  TSearch = unknown,
  TState = unknown,
  THash = unknown,
> {
  params: RouteAccessorTuple<TParams>;
  search: RouteAccessorTuple<TSearch>;
  state: Accessor<TState | undefined>;
  hash: Accessor<THash | undefined>;
}

/**
 * SolidJS route hooks, API handler helper, and configuration bound to route schemas.
 */
export interface DefinedRouteObject<
  TParams = unknown,
  TSearch = unknown,
  TState = unknown,
  THash = unknown,
  TData = unknown,
> {
  readonly config: SolidRouteConfig<TParams, TSearch, TState, THash, TData>;
  useParams(): RouteAccessorTuple<TParams>;
  useSearch(): RouteAccessorTuple<TSearch>;
  useLocation(): Location<TState>;
  handler<TResult = unknown>(
    fn: TypedAPIHandler<TParams, TSearch, TResult>,
  ): TypedAPIHandler<TParams, TSearch, TResult>;
}

/**
 * SolidJS Link component props.
 */
export type LinkProps<
  TManifest extends readonly unknown[],
  Path extends ExtractRoutePaths<TManifest>,
> = NavigationArgs<RouteParamsFor<TManifest, Path>, RouteSearchFor<TManifest, Path>, unknown> &
  Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    to: Path;
  };
