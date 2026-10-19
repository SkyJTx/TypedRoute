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

  const normalizeVirtualRoutesPlugin: Plugin = {
    name: "skyjt:typed-routes:normalize-virtual-routes",
    enforce: "post",
    transform(code, id) {
      if (id === "virtual:file-routes" || id.includes("virtual:file-routes")) {
        return {
          code: code.replace(/"src":\s*"([^"]+)"/g, (_, srcPath: string) => {
            return `"src": "${srcPath.replace(/\\\\/g, "/")}"`;
          }),
          map: null,
        };
      }
    },
  };

  const pluginsList = Array.isArray(fsPlugins) ? fsPlugins : [fsPlugins];
  return [...pluginsList, normalizeVirtualRoutesPlugin];
}