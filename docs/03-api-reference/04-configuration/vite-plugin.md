# `routes()` Vite Plugin

The `routes()` Vite plugin (available from `@skyjt/typed-routes/vite` and `@skyjt/typed-routes-solid/vite`) configures `filesystem-routing/vite`, enables full HTTP method scanning, normalizes Windows module paths, and splits `virtual:file-routes` to prevent circular SSR initialization errors.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import { routes } from "@skyjt/typed-routes-solid/vite";

export default defineConfig({
  plugins: [
    solid({
      start: { middleware: "src/middleware.ts" },
      ssr: true,
      extensions: [".jsx", ".tsx"],
    }),
    routes({
      dir: "src/routes",
      codeSplitting: true,
      types: true,
    }),
  ],
});
```

---

## Reference

### Options (`RoutesPluginOptions`)

`routes(options?)` accepts all options from `filesystem-routing/vite`'s `FileRoutesOptions`:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dir` | `string` | `"src/routes"` | Directory scanned for route files, relative to the Vite project root. |
| `extensions` | `readonly string[]` | `[".tsx", ".ts", ".jsx", ".js"]` | File extensions recognized as route modules. |
| `httpMethods` | `boolean \| readonly string[]` | `true` (`["HEAD", "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "QUERY"]`) | HTTP method exports scanned for server API dispatch. |
| `codeSplitting` | `boolean` | `true` | Emits `$component` and `$METHOD` references as dynamic `import()` chunks when `true`, or static `require()` imports when `false`. |
| `types` | `boolean \| string` | `true` (`"file-routes.d.ts"`) | Generates the ambient TypeScript declaration file describing the literal tuple types of `routes` and `pageRoutes` in `"virtual:file-routes"`. |
| `moduleId` | `string` | `"virtual:file-routes"` | Virtual module specifier used to import the route manifest. |

> **Good to know**:
> - **Circular SSR Import Protection (`virtual:file-routes-manifest:*`)**: When a route file defines `export const route = defineRoute(...)` and imports `<Link>` from `src/router.ts` (which in turn imports `{ pageRoutes } from "virtual:file-routes"`), a static import cycle exists:
>   `virtual:file-routes` -> `route-file.tsx?pick=route` -> `src/router.ts` -> `virtual:file-routes`.
>   To guarantee `routes` and `pageRoutes` are never in the Temporal Dead Zone (TDZ) when `src/router.ts` evaluates, `skyjt:typed-routes:normalize-virtual-routes` splits `virtual:file-routes` into a zero-dependency leaf manifest module (`virtual:file-routes-manifest:<env>`) and a route-data binder (`Object.assign(__routeData, ...)`). Because the leaf manifest has zero static imports, ECMAScript DFS post-order evaluation and Vite's `ssrTransform` always initialize `routes` and `pageRoutes` first before evaluating any route module.
> - **SolidJS SSR Deduplication**: `@skyjt/typed-routes-solid/vite` automatically adds `resolve.dedupe: ["solid-js", "@solidjs/web"]` and `ssr.noExternal: true` so reactive context symbols (`RouteValidationContext` and `solid.RequestContext`) are shared across SSR module boundaries.

---

## Version History

| Version | Changes |
| :--- | :--- |
| `v0.4.0` / `v0.3.0` | Added `virtual:file-routes-manifest:<env>` leaf module splitting to eliminate circular SSR TDZ errors when route files import `<Link>`. |
| `v0.1.0` | Initial release of `@skyjt/typed-routes/vite` and `@skyjt/typed-routes-solid/vite`. |