/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {
  ExtractRoutePaths,
  RouteParamsFor,
  RouteSearchFor,
} from "./route-inference";

/**
 * Map of external application identifiers to their compile-time route manifests.
 */
export type AppManifestMap = Record<string, readonly unknown[]>;

/**
 * Options for imperative cross-application navigation.
 */
export interface CrossAppNavigationOptions {
  replace?: boolean;
  target?: "_self" | "_blank" | "_parent" | "_top" | (string & {});
}

/**
 * Runtime configuration for an external application mounted in a cross-app router or path builder.
 */
export interface ExternalAppConfig {
  /**
   * Base URL or path prefix of the target application (e.g., `"https://admin.example.com"` or `"/admin"`).
   */
  baseUrl: string;
  /**
   * Optional custom navigation callback invoked during imperative cross-app navigation.
   */
  onNavigate?: (url: string, options?: CrossAppNavigationOptions) => void;
}

/**
 * Runtime configuration map corresponding to each key in `TApps`.
 */
export type CrossAppConfigs<TApps extends AppManifestMap> = {
  readonly [K in keyof TApps]: ExternalAppConfig;
};

/**
 * Options passed to `paths.build` for constructing URLs with typed parameters, query strings, and hash fragments.
 */
export interface PathBuildOptions<TParams, TSearch> {
  params?: TParams;
  search?: TSearch;
  hash?: string;
}

/**
 * Navigation arguments for cross-application links and imperative navigation calls.
 */
export type CrossAppNavigationArgs<TParams, TSearch> =
  ([keyof NonNullable<TParams>] extends [never]
    ? { params?: never }
    : {} extends NonNullable<TParams>
      ? { params?: NonNullable<TParams> }
      : { params: NonNullable<TParams> }) & {
    search?: TSearch;
    hash?: string;
    replace?: boolean;
    target?: "_self" | "_blank" | "_parent" | "_top" | (string & {});
  };

/**
 * Unified path builder supporting both local route manifests (2 arguments)
 * and external cross-app manifests (3 arguments with leading `app` key for left-to-right inference).
 */
export interface TypedPaths<
  TManifest extends readonly unknown[],
  TApps extends AppManifestMap = Record<string, never>,
> {
  /**
   * Builds a local route URL from the primary application manifest.
   */
  build<Path extends ExtractRoutePaths<TManifest>>(
    to: Path,
    options?: PathBuildOptions<
      RouteParamsFor<TManifest, Path>,
      RouteSearchFor<TManifest, Path>
    >,
  ): string;

  /**
   * Builds a cross-application URL from the registered external application manifest `TApps[TApp]`.
   */
  build<
    TApp extends keyof TApps & string,
    Path extends ExtractRoutePaths<TApps[TApp]>,
  >(
    app: TApp,
    to: Path,
    options?: PathBuildOptions<
      RouteParamsFor<TApps[TApp], Path>,
      RouteSearchFor<TApps[TApp], Path>
    >,
  ): string;

  [key: string]: unknown;
}
