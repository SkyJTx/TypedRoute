# `createRouter` and `interceptFileRoutes`

`createRouter` and `interceptFileRoutes` initialize the `@solidjs/router` instance from the `pageRoutes` manifest tuple and wrap each route component in `RouteValidationProvider`.

```ts
// src/router.ts
import { pageRoutes } from "virtual:file-routes";
import { createRouter, interceptFileRoutes } from "@skyjt/typed-routes-solid";

export const {
  Router,
  Link,
  useNavigate,
  paths,
  routes,
} = createRouter<typeof pageRoutes>({
  routes: interceptFileRoutes(pageRoutes),
});
```

---

## Reference

### `interceptFileRoutes(entries, options?)`

Transforms the `pageRoutes` tuple from `"virtual:file-routes"` into an array of `@solidjs/router` `RouteDefinition` objects with automatic schema validation and error boundary wrapping.

#### Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `entries` | `TManifest` (`readonly FileRouteEntry[]`) | **Required** | The `pageRoutes` manifest array exported by `"virtual:file-routes"`. |
| `options` | `InterceptRoutesOptions` | `undefined` | Optional configuration for route interception. |
| `options.defaultErrorComponent` | `Component<RouteValidationErrorProps>` | `DefaultRouteErrorFallback` | Global fallback component rendered when a route fails `params` or `search` validation and does not define its own `errorComponent` in `defineRoute`. |

#### Returns

Returns `RouteDefinition[]` ready to pass to `createRouter({ routes })`.

---

### `createRouter<TManifest>(config)`

Creates a SolidJS router instance bound to the compile-time route manifest type `TManifest`.

#### Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `config.routes` | `RouteDefinition[]` | **Required** | The intercepted route definitions returned by `interceptFileRoutes(pageRoutes)`. |
| `config.base` | `string` | `undefined` | Optional base path forwarded to `@solidjs/router`. |

#### Returns

| Property | Type | Description |
| :--- | :--- | :--- |
| `Router` | `Component<RouterProps>` | Root SolidJS router component mounted in `src/App.tsx`. |
| `Link` | `Component<LinkProps<TManifest, Path>>` | Type-safe `<Link>` component pre-bound to `TManifest`. |
| `useNavigate` | `() => TypedNavigateFunction<TManifest>` | Hook returning a type-safe programmatic navigation function pre-bound to `TManifest`. |
| `paths` | `RouterPaths<TManifest>` | Object exposing `paths.build(path, options)` for type-safe URL string construction. |
| `routes` | `RouteDefinition[]` | The underlying route definitions array. |

> **Good to know**:
> - `interceptFileRoutes` resolves `entry.$$route?.require()?.route` lazily via an internal getter (`getConfig()`). If a route file imports `Link` from `src/router.ts` inside `defineRoute({ errorComponent })`, `interceptFileRoutes` completes without throwing a ReferenceError during circular module initialization and resolves the route's config when the component renders or preloads.

---

## Version History

| Version | Changes |
| :--- | :--- |
| `v0.3.0` | Added `InterceptRoutesOptions` (`defaultErrorComponent`), lazy `$$route` resolution for circular SSR imports, and re-exported `RouteSectionProps`, `Location`, and `RouteDefinition`. |
| `v0.1.0` | Initial release of `createRouter` and `interceptFileRoutes`. |