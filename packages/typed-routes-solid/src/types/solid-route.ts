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
  ExtractRoutePaths,
  RouteParamsFor,
  RouteSearchFor,
  NavigationArgs,
} from "@skyjt/typed-routes";

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
}

/**
 * SolidJS route hooks and configuration bound to route schemas.
 */
export interface DefinedRouteObject<
  TParams = unknown,
  TSearch = unknown,
  TState = unknown,
  THash = unknown,
  TData = unknown,
> {
  readonly config: RouteConfig<TParams, TSearch, TState, THash, TData, Location<TState>>;
  useParams(): Accessor<TParams>;
  useSearch(): Accessor<TSearch>;
  useLocation(): Location<TState>;
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