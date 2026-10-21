/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { Accessor, Component } from "solid-js";
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
 * Props passed to a route validation error component when params or search fail schema validation.
 */
export interface RouteValidationErrorProps {
  error: RouteValidationError;
  rawParams: Record<string, string | undefined>;
  rawSearch: Record<string, unknown>;
}

/**
 * SolidJS route configuration extending core RouteConfig with an optional errorComponent fallback.
 */
export interface SolidRouteConfig<
  TParams = unknown,
  TSearch = unknown,
  TState = unknown,
  THash = unknown,
  TData = unknown,
> extends RouteConfig<TParams, TSearch, TState, THash, TData, Location<TState>> {
  errorComponent?: Component<RouteValidationErrorProps>;
  passThroughError?: boolean;
}

/**
 * Route validation context accessors for SolidJS.
 */
export interface RouteValidationContextValue<
  TParams = unknown,
  TSearch = unknown,
  TState = unknown,
  THash = unknown,
> {
  params: Accessor<TParams>;
  search: Accessor<TSearch>;
  state: Accessor<TState | undefined>;
  hash: Accessor<THash | undefined>;
  error: Accessor<RouteValidationError | undefined>;
  rawParams: Accessor<Record<string, string | undefined>>;
  rawSearch: Accessor<Record<string, unknown>>;
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
  useParams(): Accessor<TParams>;
  useSearch(): Accessor<TSearch>;
  useError(): Accessor<RouteValidationError | undefined>;
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