/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { lazy, createComponent, type Component } from "solid-js";
import type { JSX } from "@solidjs/web";
import type { RouteDefinition, RouteSectionProps, Location } from "@solidjs/router";
import {
  RouteValidationError,
  validateData,
  normalizeSearchParams,
  type RouteConfig,
  type FileRouteEntry,
  type FileRouteLazyRef,
  type FileRouteEagerRef,
} from "@skyjt/typed-routes";
import { RouteValidationProvider } from "../context/route-context";

/**
 * Intercepts manifest route definitions to bind schema validation and preloading for @solidjs/router.
 */
export function interceptFileRoutes<const TManifest extends readonly unknown[]>(
  entries: TManifest,
): RouteDefinition[] {
  const componentCache = new Map<string, Component<RouteSectionProps>>();

  const resolveComponent = (ref: FileRouteLazyRef | FileRouteEagerRef): Component<RouteSectionProps> => {
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
  };

  const transformEntry = (entry: FileRouteEntry): RouteDefinition => {
    const routeExport = entry.$$route?.require()?.route as
      | { config?: RouteConfig<unknown, unknown, unknown, unknown, unknown, Location> }
      | RouteConfig<unknown, unknown, unknown, unknown, unknown, Location>
      | undefined;
    const config: RouteConfig<unknown, unknown, unknown, unknown, unknown, Location> =
      (routeExport && "config" in routeExport && routeExport.config
        ? routeExport.config
        : (routeExport as RouteConfig<unknown, unknown, unknown, unknown, unknown, Location>)) ?? {};

    let component: Component<RouteSectionProps> | undefined = undefined;
    if (entry.$component) {
      const RawComp = resolveComponent(entry.$component);
      component = (props: RouteSectionProps): JSX.Element => {
        return createComponent(RouteValidationProvider, {
          config,
          get children() {
            return createComponent(RawComp, props);
          },
        });
      };
      if ("preload" in RawComp && typeof (RawComp as { preload?: unknown }).preload === "function") {
        const rawPreload = (RawComp as { preload: () => unknown }).preload;
        (component as unknown as { preload: () => unknown }).preload = () => rawPreload();
      }
    }

    let preload = config.preload;
    if (preload && typeof preload === "function") {
      const origPreload = preload;
      preload = (args: Record<string, unknown>): unknown => {
        const rawParams = (args.params as Record<string, string | undefined>) ?? {};
        const locationObj = (args.location as { query?: Record<string, string | string[] | undefined> }) ?? {};
        const rawSearch = normalizeSearchParams(locationObj.query ?? {});

        const paramsRes = validateData(config.params, rawParams);
        if (!paramsRes.success && config.onError) {
          config.onError({
            error: new RouteValidationError("params", paramsRes.issues ?? []),
            rawParams,
            rawSearch,
          });
        }

        const searchRes = validateData(config.search, rawSearch);
        if (!searchRes.success && config.onError) {
          config.onError({
            error: new RouteValidationError("search", searchRes.issues ?? []),
            rawParams,
            rawSearch,
          });
        }

        return origPreload({
          params: paramsRes.data,
          search: searchRes.data,
          location: args.location as Location,
        });
      };
    }

    return {
      ...config,
      path: entry.path,
      component,
      preload: preload as RouteDefinition["preload"],
      info: { ...config.info, filesystem: true },
      children: entry.children ? (entry.children as FileRouteEntry[]).map(transformEntry) : undefined,
    } as RouteDefinition;
  };

  return (entries as unknown as FileRouteEntry[]).map(transformEntry);
}