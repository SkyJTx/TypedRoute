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
  createPaths,
  type AppManifestMap,
  type CrossAppConfigs,
  type TypedPaths,
} from "@skyjt/typed-routes";
import { createBoundLink } from "~/components/link";
import { useNavigate } from "~/hooks/use-navigate";
import type { TypedLinkComponent, TypedNavigateFn } from "~/types/solid-route";

export interface RouterConfig<
  R extends readonly RouteDefinition[] = RouteDefinition[],
  TApps extends AppManifestMap = Record<string, never>,
> extends SolidRouterConfig<R> {
  /**
   * Optional map of external applications for cross-app typed navigation.
   */
  apps?: CrossAppConfigs<TApps>;
}

export interface RouterPaths<
  TManifest extends readonly unknown[],
  TApps extends AppManifestMap = Record<string, never>,
> extends TypedPaths<TManifest, TApps> {}

/**
 * Creates a SolidJS router instance bound to the primary route manifest and optional external application manifests.
 */
export function createRouter<
  const TManifest extends readonly unknown[],
  TApps extends AppManifestMap = Record<string, never>,
>(config: RouterConfig<RouteDefinition[], TApps>) {
  const routerInstance = createSolidRouter(config);
  const corePaths = createPaths<TManifest, TApps>(config.apps);

  const paths: RouterPaths<TManifest, TApps> = {
    ...(routerInstance.paths as Record<string, unknown> | undefined),
    build: corePaths.build,
  };

  const boundLink: TypedLinkComponent<TManifest, TApps> = createBoundLink<
    TManifest,
    TApps
  >(config.apps);

  const boundUseNavigate = (): TypedNavigateFn<TManifest, TApps> =>
    useNavigate<TManifest, TApps>(config.apps);

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
