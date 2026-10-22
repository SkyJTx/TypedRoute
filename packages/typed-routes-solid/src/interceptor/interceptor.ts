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
  RouteValidationError,
  validateData,
  normalizeSearchParams,
  type FileRouteEntry,
  type FileRouteLazyRef,
  type FileRouteEagerRef,
} from "@skyjt/typed-routes";
import type { RouteValidationErrorProps, SolidRouteConfig } from "../types/solid-route";
import { RouteValidationProvider } from "../context/route-context";

export interface InterceptRoutesOptions {
  defaultErrorComponent?: Component<RouteValidationErrorProps>;
}

const EMPTY_SOLID_CONFIG: SolidRouteConfig<unknown, unknown, unknown, unknown, unknown> =
  Object.freeze({});

/**
 * Intercepts manifest route definitions to bind schema validation and preloading for @solidjs/router.
 */
export function interceptFileRoutes<const TManifest extends readonly unknown[]>(
  entries: TManifest,
  options?: InterceptRoutesOptions,
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
          defaultErrorComponent: options?.defaultErrorComponent,
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

        const paramsRes = validateData(currentConfig.params, rawParams);
        if (!paramsRes.success && currentConfig.onError) {
          currentConfig.onError({
            error: new RouteValidationError("params", paramsRes.issues ?? [], {
              rawParams,
              rawSearch,
            }),
            rawParams,
            rawSearch,
          });
        }

        const searchRes = validateData(currentConfig.search, rawSearch);
        if (!searchRes.success && currentConfig.onError) {
          currentConfig.onError({
            error: new RouteValidationError("search", searchRes.issues ?? [], {
              rawParams,
              rawSearch,
            }),
            rawParams,
            rawSearch,
          });
        }

        return currentConfig.preload({
          params: paramsRes.data,
          search: searchRes.data,
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