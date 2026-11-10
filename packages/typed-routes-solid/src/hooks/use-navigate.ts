/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useNavigate as nativeUseNavigate } from "@solidjs/router";
import {
  buildUrl,
  navigateCrossApp,
  type AppManifestMap,
  type CrossAppConfigs,
  type ExternalAppConfig,
} from "@skyjt/typed-routes";
import type { TypedNavigateFn } from "~/types/solid-route";

/**
 * Returns a navigation function constrained by local and cross-application route manifests.
 *
 * - 2-argument call `navigate(to, options?)`: executes client-side SPA navigation on `TManifest`.
 * - 3-argument call `navigate(app, to, options?)`: executes cross-application navigation on `TApps[TApp]`.
 */
export function useNavigate<
  TManifest extends readonly unknown[],
  TApps extends AppManifestMap = Record<string, never>,
>(apps?: CrossAppConfigs<TApps>): TypedNavigateFn<TManifest, TApps> {
  const nativeNavigate = nativeUseNavigate();

  function navigate(
    firstArg: string,
    secondArg?: unknown,
    thirdArg?: unknown,
  ): string | void {
    if (typeof secondArg === "string") {
      const appConfig = (apps as Record<string, ExternalAppConfig | undefined> | undefined)?.[
        firstArg
      ];
      if (!appConfig) {
        throw new Error(
          `Unknown external application "${firstArg}". Register its baseUrl in createRouter({ apps }).`,
        );
      }
      const crossOpts = thirdArg as
        | {
            params?: Record<string, unknown>;
            search?: Record<string, unknown>;
            hash?: string;
            replace?: boolean;
            target?: "_self" | "_blank" | "_parent" | "_top" | (string & {});
          }
        | undefined;
      return navigateCrossApp(appConfig, secondArg, crossOpts);
    }

    const localOpts = secondArg as
      | {
          params?: Record<string, unknown>;
          search?: Record<string, unknown>;
          hash?: string;
          replace?: boolean;
          scroll?: boolean;
          state?: unknown;
        }
      | undefined;

    const url = buildUrl(firstArg, {
      params: localOpts?.params,
      search: localOpts?.search,
      hash: localOpts?.hash,
    });
    nativeNavigate(url, {
      replace: localOpts?.replace,
      scroll: localOpts?.scroll,
      state: localOpts?.state,
    });
  }

  return navigate as TypedNavigateFn<TManifest, TApps>;
}
