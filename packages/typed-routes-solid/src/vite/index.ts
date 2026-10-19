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