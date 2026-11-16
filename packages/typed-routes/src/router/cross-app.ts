/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {
  AppManifestMap,
  CrossAppConfigs,
  CrossAppNavigationOptions,
  ExternalAppConfig,
  TypedPaths,
} from "~/types/cross-app";
import { buildUrl } from "./path-builder";
import { assertSafeUrlProtocol, normalizeRelativeUrlSlashes } from "./url-safety";

/**
 * Joins an external application's `baseUrl` (origin or subpath prefix) with a built path
 * while avoiding duplicate slashes and preserving query strings and hash fragments.
 */
export function joinBaseAndPath(baseUrl: string, builtPath: string): string {
  if (!baseUrl || baseUrl === "/") {
    return normalizeRelativeUrlSlashes(builtPath);
  }
  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  if (builtPath === "/") {
    return baseUrl.endsWith("/") ? cleanBase + "/" : cleanBase;
  }
  if (builtPath.startsWith("/?") || builtPath.startsWith("/#")) {
    return cleanBase + builtPath;
  }
  const normalizedPath = builtPath.startsWith("/") ? builtPath : "/" + builtPath;
  return cleanBase + normalizedPath;
}

/**
 * Builds a complete URL for an external application route by combining `baseUrl` with `buildUrl`.
 */
export function buildCrossAppUrl(
  baseUrl: string,
  pattern: string,
  options?: {
    params?: Record<string, unknown>;
    search?: Record<string, unknown>;
    hash?: string;
  },
): string {
  const relativePath = buildUrl(pattern, options);
  return joinBaseAndPath(baseUrl, relativePath);
}

/**
 * Executes imperative navigation to an external application route.
 * Invokes `appConfig.onNavigate` when provided, or falls back to browser `window.location` / `window.open`.
 */
export function navigateCrossApp(
  appConfig: ExternalAppConfig,
  pattern: string,
  options?: {
    params?: Record<string, unknown>;
    search?: Record<string, unknown>;
    hash?: string;
    replace?: boolean;
    target?: CrossAppNavigationOptions["target"];
  },
): string {
  assertSafeUrlProtocol(appConfig.baseUrl, "cross-app navigation");
  assertSafeUrlProtocol(pattern, "cross-app navigation");
  const url = buildCrossAppUrl(appConfig.baseUrl, pattern, {
    params: options?.params,
    search: options?.search,
    hash: options?.hash,
  });
  assertSafeUrlProtocol(url, "cross-app navigation");

  const navOptions: CrossAppNavigationOptions = {
    replace: options?.replace,
    target: options?.target,
  };

  if (appConfig.onNavigate) {
    appConfig.onNavigate(url, navOptions);
    return url;
  }

  if (typeof window !== "undefined") {
    if (options?.target && options.target !== "_self" && typeof window.open === "function") {
      window.open(url, options.target, "noopener,noreferrer");
    } else if (options?.replace && window.location && typeof window.location.replace === "function") {
      window.location.replace(url);
    } else if (window.location && typeof window.location.assign === "function") {
      window.location.assign(url);
    }
  }

  return url;
}

/**
 * Creates a unified `TypedPaths` builder supporting both local manifest routes (2 arguments)
 * and cross-application routes (3 arguments with leading `app` identifier).
 */
export function createPaths<
  const TManifest extends readonly unknown[],
  TApps extends AppManifestMap = Record<string, never>,
>(apps?: CrossAppConfigs<TApps>): TypedPaths<TManifest, TApps> {
  function build(
    firstArg: string,
    secondArg?: unknown,
    thirdArg?: unknown,
  ): string {
    if (typeof secondArg === "string") {
      const appConfig = (apps as Record<string, ExternalAppConfig | undefined> | undefined)?.[
        firstArg
      ];
      if (!appConfig) {
        throw new Error(
          `Unknown external application "${firstArg}". Register its baseUrl in the apps configuration.`,
        );
      }
      return buildCrossAppUrl(
        appConfig.baseUrl,
        secondArg,
        thirdArg as
          | {
              params?: Record<string, unknown>;
              search?: Record<string, unknown>;
              hash?: string;
            }
          | undefined,
      );
    }

    return buildUrl(
      firstArg,
      secondArg as
        | {
            params?: Record<string, unknown>;
            search?: Record<string, unknown>;
            hash?: string;
          }
        | undefined,
    );
  }

  return {
    build: build as TypedPaths<TManifest, TApps>["build"],
  };
}
