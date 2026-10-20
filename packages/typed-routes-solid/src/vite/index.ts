/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { Plugin, PluginOption } from "vite";
import {
  routes as coreRoutes,
  defaultHttpMethods,
  type RoutesPluginOptions,
} from "@skyjt/typed-routes/vite";

export { defaultHttpMethods, type RoutesPluginOptions };

/**
 * Vite plugin configuring file routes and SolidJS SSR defaults.
 */
export function routes(options?: RoutesPluginOptions): PluginOption[] {
  const basePlugins = coreRoutes(options);

  const ssrConfigPlugin: Plugin = {
    name: "skyjt:typed-routes-solid:ssr-config",
    config() {
      return {
        resolve: {
          dedupe: ["solid-js", "@solidjs/web"],
        },
        ssr: {
          noExternal: true,
        },
      };
    },
  };

  return [...basePlugins, ssrConfigPlugin];
}