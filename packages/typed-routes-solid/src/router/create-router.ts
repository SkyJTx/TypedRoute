/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  createRouter as createSolidRouter,
  type RouteDefinition,
  type RouterConfig as SolidRouterConfig,
} from "@solidjs/router";
import {
  buildUrl,
  type ExtractRoutePaths,
  type RouteParamsFor,
  type RouteSearchFor,
} from "@skyjt/typed-routes";
import { Link } from "~/components/link";
import { useNavigate } from "~/hooks/use-navigate";

export interface RouterConfig<R extends readonly RouteDefinition[] = RouteDefinition[]>
  extends SolidRouterConfig<R> {}

export interface RouterPaths<TManifest extends readonly unknown[]> {
  build<Path extends ExtractRoutePaths<TManifest>>(
    to: Path,
    options?: {
      params?: RouteParamsFor<TManifest, Path>;
      search?: RouteSearchFor<TManifest, Path>;
      hash?: string;
    },
  ): string;
  [key: string]: unknown;
}

/**
 * Creates a SolidJS router instance bound to the route manifest.
 */
export function createRouter<const TManifest extends readonly unknown[]>(
  config: RouterConfig,
) {
  const routerInstance = createSolidRouter(config);

  const paths: RouterPaths<TManifest> = {
    ...(routerInstance.paths as Record<string, unknown> | undefined),
    build<Path extends ExtractRoutePaths<TManifest>>(
      to: Path,
      options?: {
        params?: RouteParamsFor<TManifest, Path>;
        search?: RouteSearchFor<TManifest, Path>;
        hash?: string;
      },
    ): string {
      return buildUrl(to as string, options as Record<string, unknown> | undefined);
    },
  };

  const boundLink = Link as unknown as <
    Path extends ExtractRoutePaths<TManifest> = ExtractRoutePaths<TManifest>,
  >(
    props: Parameters<typeof Link<TManifest, Path>>[0],
  ) => ReturnType<typeof Link<TManifest, Path>>;

  const boundUseNavigate = () => useNavigate<TManifest>();

  return {
    Router: routerInstance,
    paths,
    Link: boundLink,
    useNavigate: boundUseNavigate,
    routes: routerInstance.routes,
    config: routerInstance.config,
    match: (url: string) => routerInstance.match(url),
  };
}