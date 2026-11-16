/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Dynamic, type JSX } from "@solidjs/web";
import { createComponent } from "solid-js";
import {
  buildCrossAppUrl,
  buildUrl,
  type AppManifestMap,
  type CrossAppConfigs,
  type ExternalAppConfig,
  type ExtractRoutePaths,
} from "@skyjt/typed-routes";
import type {
  CrossAppLinkProps,
  LinkProps,
  TypedLinkComponent,
} from "~/types/solid-route";
import { isUnsafeUrlProtocol, sanitizeLinkHref } from "~/utils/url-safety";

interface InternalLinkProps extends Omit<JSX.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  app?: string;
  to: string;
  params?: Record<string, unknown>;
  search?: Record<string, unknown>;
  hash?: string;
  apps?: Record<string, ExternalAppConfig>;
}

/**
 * Creates a `<Link>` component bound to optional external application configurations.
 */
export function createBoundLink<
  TManifest extends readonly unknown[],
  TApps extends AppManifestMap = Record<string, never>,
>(boundApps?: CrossAppConfigs<TApps>): TypedLinkComponent<TManifest, TApps> {
  function BoundLink(rawProps: InternalLinkProps): JSX.Element {
    const href = (): string => {
      if (isUnsafeUrlProtocol(rawProps.to)) {
        return "about:blank";
      }
      let resolved: string;
      const appName = rawProps.app;
      if (typeof appName === "string" && appName.length > 0) {
        const activeApps =
          rawProps.apps ??
          (boundApps as Record<string, ExternalAppConfig | undefined> | undefined);
        const appConfig = activeApps?.[appName];
        if (!appConfig) {
          throw new Error(
            `Unknown external application "${appName}". Register its baseUrl in createRouter({ apps }) or pass apps to <Link>.`,
          );
        }
        resolved = buildCrossAppUrl(appConfig.baseUrl, rawProps.to, {
          params: rawProps.params,
          search: rawProps.search,
          hash: rawProps.hash,
        });
      } else {
        resolved = buildUrl(rawProps.to, {
          params: rawProps.params,
          search: rawProps.search,
          hash: rawProps.hash,
        });
      }
      return sanitizeLinkHref(resolved);
    };

    const rel = (): InternalLinkProps["rel"] => {
      if (rawProps.target !== "_blank") {
        return rawProps.rel;
      }
      if (typeof rawProps.rel !== "string" || rawProps.rel.trim().length === 0) {
        return "noopener noreferrer";
      }
      const relTokens = rawProps.rel.toLowerCase().split(/\s+/);
      const hasNoopener = relTokens.includes("noopener");
      const hasNoreferrer = relTokens.includes("noreferrer");
      if (hasNoopener && hasNoreferrer) {
        return rawProps.rel;
      }
      return `${rawProps.rel}${hasNoopener ? "" : " noopener"}${hasNoreferrer ? "" : " noreferrer"}`;
    };

    return createComponent(Dynamic, {
      component: "a",
      get href() {
        return href();
      },
      class: rawProps.class,
      target: rawProps.target,
      get rel() {
        return rel();
      },
      onClick: rawProps.onClick,
      get children() {
        return rawProps.children;
      },
    });
  }

  return BoundLink as unknown as TypedLinkComponent<TManifest, TApps>;
}

/**
 * Link component deriving target routes and parameters from the local or cross-app route manifest.
 */
export function Link<
  TManifest extends readonly unknown[],
  Path extends ExtractRoutePaths<TManifest> = ExtractRoutePaths<TManifest>,
>(props: LinkProps<TManifest, Path>): JSX.Element;
export function Link<
  TApps extends AppManifestMap,
  TApp extends keyof TApps & string,
  Path extends ExtractRoutePaths<TApps[TApp]> = ExtractRoutePaths<TApps[TApp]>,
>(props: CrossAppLinkProps<TApps, TApp, Path>): JSX.Element;
export function Link(props: InternalLinkProps): JSX.Element {
  return (createBoundLink<readonly unknown[]>() as (p: InternalLinkProps) => JSX.Element)(
    props,
  );
}
