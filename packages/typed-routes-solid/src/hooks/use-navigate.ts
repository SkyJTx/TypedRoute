/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useNavigate as nativeUseNavigate } from "@solidjs/router";
import {
  buildUrl,
  type ExtractRoutePaths,
  type RouteParamsFor,
  type RouteSearchFor,
  type NavigationArgs,
} from "@skyjt/typed-routes";

/**
 * Returns a navigation function constrained by route manifest paths and schemas.
 */
export function useNavigate<TManifest extends readonly unknown[]>() {
  const nativeNavigate = nativeUseNavigate();

  return <Path extends ExtractRoutePaths<TManifest>>(
    to: Path,
    options?: NavigationArgs<RouteParamsFor<TManifest, Path>, RouteSearchFor<TManifest, Path>, unknown>,
  ) => {
    const url = buildUrl(to as string, {
      params: options?.params as Record<string, unknown> | undefined,
      search: options?.search as Record<string, unknown> | undefined,
      hash: options?.hash,
    });
    nativeNavigate(url, {
      replace: options?.replace,
      scroll: options?.scroll,
      state: options?.state,
    });
  };
}