/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { lazy, createComponent, type Component } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { RouteDefinition, RouteSectionProps, Location } from "@solidjs/router";
import {
  EMPTY_RECORD,
  evaluateRouteTarget,
  normalizeSearchParams,
  type FileRouteEntry,
  type FileRouteLazyRef,
  type FileRouteEagerRef,
} from "@skyjt/typed-routes";
import type { SolidRouteConfig } from "~/types/solid-route";
import { RouteValidationProvider } from "~/context/route-context";

const EMPTY_SOLID_CONFIG: SolidRouteConfig<unknown, unknown, unknown, unknown, unknown> =
  Object.freeze({});

/**
 * Intercepts manifest route definitions to bind schema validation and preloading for @solidjs/router.
 */
export function interceptFileRoutes<const TManifest extends readonly unknown[]>(
  entries: TManifest,
): RouteDefinition[] {
  const componentCache = new Map<string, Component<RouteSectionProps>>();

  function resolveLazyRouteComponent(
    ref: FileRouteLazyRef | FileRouteEagerRef,
  ): Component<RouteSectionProps> {
    if ("require" in ref) {
      return ref.require().default as Component<RouteSectionProps>;
    }
    const moduleUrl = ref.src ? ref.src.replace(/\\/g, "/") : ref.src;
    if (ref.src) {
      ref.src = moduleUrl;
    }
    let cached = componentCache.get(moduleUrl);
    if (!cached) {
      cached = lazy(
        ref.import as () => Promise<{ default: Component<RouteSectionProps> }>,
        undefined,
        moduleUrl,
      );
      componentCache.set(moduleUrl, cached);
    }
    return cached;
  }

  function interceptRouteEntry(entry: FileRouteEntry): RouteDefinition {
    let cachedConfig: SolidRouteConfig<unknown, unknown, unknown, unknown, unknown> | undefined;

    function getRouteConfig(): SolidRouteConfig<unknown, unknown, unknown, unknown, unknown> {
      if (cachedConfig) {
        return cachedConfig;
      }
      try {
        const routeExport = entry.$$route?.require()?.route as
          | { config?: SolidRouteConfig<unknown, unknown, unknown, unknown, unknown> }
          | SolidRouteConfig<unknown, unknown, unknown, unknown, unknown>
          | undefined;
        if (routeExport && typeof routeExport === "object") {
          cachedConfig =
            "config" in routeExport && routeExport.config
              ? routeExport.config
              : (routeExport as SolidRouteConfig<unknown, unknown, unknown, unknown, unknown>);
          return cachedConfig;
        }
      } catch {
        // Module may still be evaluating during circular SSR import; resolve lazily on render/preload
      }
      return EMPTY_SOLID_CONFIG;
    }

    const eagerConfig = getRouteConfig();

    let component: Component<RouteSectionProps> | undefined;
    if (entry.$component) {
      const RawComp = resolveLazyRouteComponent(entry.$component);
      component = function BoundRouteValidationComponent(props: RouteSectionProps): JSX.Element {
        return createComponent(RouteValidationProvider, {
          get config() {
            return getRouteConfig();
          },
          get children() {
            return createComponent(RawComp, props);
          },
        });
      };
      if ("preload" in RawComp && typeof (RawComp as { preload?: unknown }).preload === "function") {
        const rawPreload = (RawComp as { preload: () => unknown }).preload;
        (component as unknown as { preload: () => unknown }).preload =
          function preloadLazyRouteComponent() {
            return rawPreload();
          };
      }
    }

    let preload: ((args: Record<string, unknown>) => unknown) | undefined;
    if (eagerConfig.preload || entry.$$route) {
      preload = function preloadValidatedRoute(args: Record<string, unknown>): unknown {
        const currentConfig = getRouteConfig();
        if (!currentConfig.preload || typeof currentConfig.preload !== "function") {
          return undefined;
        }
        const rawParams =
          (args.params as Record<string, string | undefined>) ??
          (EMPTY_RECORD as Record<string, string | undefined>);
        const locationObj = args.location as
          | { query?: Record<string, string | string[] | undefined> }
          | undefined;
        const rawSearch = locationObj?.query
          ? normalizeSearchParams(locationObj.query)
          : (EMPTY_RECORD as Record<string, unknown>);

        const context = { rawParams, rawSearch };
        const paramsTuple = evaluateRouteTarget(
          "params",
          currentConfig.params,
          rawParams,
          context,
          currentConfig.onError,
        );
        const searchTuple = evaluateRouteTarget(
          "search",
          currentConfig.search,
          rawSearch,
          context,
          currentConfig.onError,
        );

        return currentConfig.preload({
          params: paramsTuple,
          search: searchTuple,
          location: args.location as Location,
        });
      };
    }

    return {
      ...eagerConfig,
      path: entry.path,
      component,
      preload: preload as RouteDefinition["preload"],
      info: eagerConfig.info ? { ...eagerConfig.info, filesystem: true } : { filesystem: true },
      children: entry.children
        ? (entry.children as FileRouteEntry[]).map(interceptRouteEntry)
        : undefined,
    } as RouteDefinition;
  }

  return (entries as unknown as FileRouteEntry[]).map(interceptRouteEntry);
}
