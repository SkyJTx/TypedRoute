/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { Plugin, PluginOption } from "vite";
import { fileRoutes, type FileRoutesOptions } from "filesystem-routing/vite";

/**
 * Default HTTP methods scanned for route handlers.
 */
export const defaultHttpMethods: readonly string[] = [
  "HEAD",
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "QUERY",
];

export type RoutesPluginOptions = FileRoutesOptions;

const MANIFEST_PUBLIC_PREFIX = "virtual:file-routes-manifest:";
const MANIFEST_RESOLVED_PREFIX = "\0virtual:file-routes-manifest:";

function normalizeWindowsSrcPaths(code: string): string {
  return code.replace(/"src":\s*"([^"]+)"/g, (_, srcPath: string) => {
    return `"src": "${srcPath.replace(/\\\\/g, "/")}"`;
  });
}

/**
 * Splits `virtual:file-routes` into a zero-dependency leaf manifest module and a route-data binder
 * so `routes` and `pageRoutes` are always initialized before any route module's top-level imports
 * (such as `import { Link } from "./router"`) execute in circular SSR or client module graphs.
 */
function splitVirtualRoutesModule(
  code: string,
  envKey: string,
): { entryCode: string; manifestCode: string } | null {
  const lines = code.split(/\r?\n/);
  const importLines: string[] = [];
  const bodyLines: string[] = [];
  const routeDataVars: string[] = [];

  const routeImportRegex = /^\s*import\s+\{\s*route\s+as\s+(routeData\d+)\s*\}\s+from\s+['"][^'"]+['"]\s*;?\s*$/;

  for (const line of lines) {
    const match = routeImportRegex.exec(line);
    if (match && match[1]) {
      importLines.push(line);
      routeDataVars.push(match[1]);
    } else {
      bodyLines.push(line);
    }
  }

  if (routeDataVars.length === 0) {
    return null;
  }

  const rawBody = bodyLines.join("\n");
  const rewrittenBody = rawBody
    .replace(/\b(routeData\d+)\b/g, "__routeData.$1")
    .replace(/^\s*export\s+default\s+routes\s*;?\s*$/m, "export { routes };");

  const manifestCode = `${rewrittenBody}\nexport const __routeData = {};\n`;
  const manifestPublicId = `${MANIFEST_PUBLIC_PREFIX}${envKey}`;

  const entryCode = [
    `export { routes as default, pageRoutes } from ${JSON.stringify(manifestPublicId)};`,
    `import { __routeData } from ${JSON.stringify(manifestPublicId)};`,
    ...importLines,
    `Object.assign(__routeData, { ${routeDataVars.join(", ")} });`,
  ].join("\n");

  return { entryCode, manifestCode };
}

/**
 * Framework-agnostic Vite plugin configuring file routes and normalizing Windows paths in virtual modules.
 */
export function routes(options?: RoutesPluginOptions): PluginOption[] {
  const httpMethods =
    options?.httpMethods === true || options?.httpMethods === undefined
      ? [...defaultHttpMethods]
      : options.httpMethods;

  const fsPlugins = fileRoutes({
    types: true,
    ...options,
    httpMethods,
  });

  const pluginsList = Array.isArray(fsPlugins) ? fsPlugins : [fsPlugins];
  const fsMainPlugin = pluginsList.find(
    (p): p is Plugin => Boolean(p && typeof p === "object" && "name" in p && p.name === "filesystem-routing"),
  );

  const manifestByEnv = new Map<string, string>();
  const virtualModuleId = options?.moduleId ?? "virtual:file-routes";

  const manifestResolverPlugin: Plugin = {
    name: "skyjt:typed-routes:manifest-resolver",
    enforce: "pre",
    resolveId(id) {
      if (id.startsWith(MANIFEST_PUBLIC_PREFIX)) {
        return `\0${id}`;
      }
      if (id.startsWith(MANIFEST_RESOLVED_PREFIX)) {
        return id;
      }
    },
    async load(id) {
      let envKey: string | undefined;
      if (id.startsWith(MANIFEST_RESOLVED_PREFIX)) {
        envKey = id.slice(MANIFEST_RESOLVED_PREFIX.length);
      } else if (id.startsWith(MANIFEST_PUBLIC_PREFIX)) {
        envKey = id.slice(MANIFEST_PUBLIC_PREFIX.length);
      }
      if (envKey === undefined) {
        return;
      }

      const cached = manifestByEnv.get(envKey) ?? manifestByEnv.get("default");
      if (cached) {
        return cached;
      }

      if (fsMainPlugin && fsMainPlugin.load) {
        const loadFn =
          typeof fsMainPlugin.load === "function"
            ? fsMainPlugin.load
            : fsMainPlugin.load.handler;
        const rawResult = await loadFn.call(this, virtualModuleId);
        const rawCode =
          typeof rawResult === "string"
            ? rawResult
            : rawResult && typeof rawResult === "object" && "code" in rawResult
              ? rawResult.code
              : undefined;
        if (typeof rawCode === "string") {
          const normalizedPaths = normalizeWindowsSrcPaths(rawCode);
          const split = splitVirtualRoutesModule(normalizedPaths, envKey);
          if (split) {
            manifestByEnv.set(envKey, split.manifestCode);
            return split.manifestCode;
          }
        }
      }

      return "";
    },
  };

  const normalizeVirtualRoutesPlugin: Plugin = {
    name: "skyjt:typed-routes:normalize-virtual-routes",
    enforce: "post",
    transform(code, id) {
      if (
        (id === virtualModuleId || id.includes("virtual:file-routes")) &&
        !id.includes("virtual:file-routes-manifest:")
      ) {
        const normalizedPaths = normalizeWindowsSrcPaths(code);
        const envKey = (this as { environment?: { name?: string } }).environment?.name ?? "default";
        const split = splitVirtualRoutesModule(normalizedPaths, envKey);
        if (!split) {
          return {
            code: normalizedPaths,
            map: null,
          };
        }
        manifestByEnv.set(envKey, split.manifestCode);
        return {
          code: split.entryCode,
          map: null,
        };
      }
    },
  };

  return [manifestResolverPlugin, ...pluginsList, normalizeVirtualRoutesPlugin];
}