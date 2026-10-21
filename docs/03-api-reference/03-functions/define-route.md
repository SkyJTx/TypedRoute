# `defineRoute`

`defineRoute` declares validation schemas (`params`, `search`, `state`, `hash`), preloading logic, validation error boundaries (`errorComponent`), reactive SolidJS accessors, and typed API handler builders for a route file.

```tsx
import * as v from "valibot";
import { defineRoute } from "@skyjt/typed-routes-solid";

export const route = defineRoute({
  params: v.object({
    id: v.number(),
  }),
  search: v.object({
    tab: v.optional(v.string(), "profile"),
  }),
  errorComponent: (props) => (
    <div role="alert">Invalid ID "{props.rawParams.id}": {props.error.message}</div>
  ),
});
```

---

## Reference

### Parameters

`defineRoute(config)` accepts a single configuration object with the following properties:

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `params` | `TypeValidator<TParams>` | `undefined` | Schema validator (`StandardSchemaV1`, Valibot, Zod, or custom parser) for dynamic URL path parameters. String values are automatically coerced to numbers/booleans. |
| `search` | `TypeValidator<TSearch>` | `undefined` | Schema validator for URL query string parameters (`?key=value`). |
| `state` | `TypeValidator<TState>` | `undefined` | Schema validator for router history state (`location.state`). |
| `hash` | `TypeValidator<THash>` | `undefined` | Schema validator for the URL hash fragment (`location.hash`). |
| `preload` | `(args: { params: TParams; search: TSearch; location: Location }) => TData` | `undefined` | Preload callback invoked by `@solidjs/router` with validated and coerced `params` and `search`. |
| `onError` | `(args: { error: RouteValidationError; rawParams: Record<string, string \| undefined>; rawSearch: Record<string, unknown> }) => void` | `undefined` | Side-effect callback invoked whenever `params` or `search` validation fails on either the server (`createMiddleware`) or client/SSR (`RouteValidationProvider`). |
| `errorComponent` | `Component<RouteValidationErrorProps>` | `undefined` | (`@skyjt/typed-routes-solid` only) Fallback SolidJS component rendered instead of the route's default component when validation fails. Receives `{ error, rawParams, rawSearch }`. |
| `passThroughError` | `boolean` | `false` | (`@skyjt/typed-routes-solid` only) When `true`, mounts the route's default component even when validation fails so the component can inspect `route.useError()` manually. |
| `info` | `Record<string, unknown>` | `undefined` | Arbitrary route metadata forwarded to `@solidjs/router`. |

---

### Returns

`defineRoute` returns a `DefinedRouteObject<TParams, TSearch, TState, THash, TData>` (in `@skyjt/typed-routes-solid`) or `DefinedRouteConfig` (in `@skyjt/typed-routes`):

| Property / Method | Type | Description |
| :--- | :--- | :--- |
| `config` | `SolidRouteConfig<...>` | The underlying route configuration object read by `interceptFileRoutes` and `createMiddleware`. |
| `useParams()` | `Accessor<TParams>` | (`@skyjt/typed-routes-solid`) Returns a reactive SolidJS accessor for the validated `params` object. Guaranteed non-nullable when `passThroughError` is `false` (default). |
| `useSearch()` | `Accessor<TSearch>` | (`@skyjt/typed-routes-solid`) Returns a reactive SolidJS accessor for the validated `search` query object. Guaranteed non-nullable when `passThroughError` is `false` (default). |
| `useError()` | `Accessor<RouteValidationError \| undefined>` | (`@skyjt/typed-routes-solid`) Returns a reactive SolidJS accessor containing the current `RouteValidationError` if validation failed, or `undefined` when valid. |
| `useState()` | `Accessor<TState \| undefined>` | (`@skyjt/typed-routes-solid`) Returns a reactive SolidJS accessor for the validated `location.state`. |
| `useHash()` | `Accessor<THash \| undefined>` | (`@skyjt/typed-routes-solid`) Returns a reactive SolidJS accessor for the validated `location.hash`. |
| `handler(fn)` | `TypedAPIHandler<TParams, TSearch, TResult>` | Identity helper that binds an HTTP handler function `(event: TypedAPIEvent<TParams, TSearch>) => TResult` to the route's inferred `TParams` and `TSearch` types. |

> **Good to know**:
> - `RouteValidationError` exposes `.target` (`"params" | "search" | "state" | "hash"`), `.issues` (`ReadonlyArray<{ message: string; path?: string }>`), `.rawParams` (`Record<string, string | undefined>`), and `.rawSearch` (`Record<string, unknown>`).
> - Inside `RouteValidationProvider`, `useParams()` and `useSearch()` are backed by `createMemo` signals that update fine-grained DOM bindings without remounting the page component when navigating between sibling parameter values (for example, `/users/1` -> `/users/2`).

---

## Examples

### UI Page with `errorComponent` and Non-Nullable `useParams()`

```tsx
// src/routes/(main)/users/[id].tsx
import * as v from "valibot";
import { defineRoute } from "@skyjt/typed-routes-solid";
import { Link } from "../../../router";

export const route = defineRoute({
  params: v.object({ id: v.number() }),
  errorComponent: (props) => (
    <div class="error-card">
      <h2>Invalid User ID: "{props.rawParams.id}"</h2>
      <p>{props.error.message}</p>
      <Link to="/users/">Back to Users</Link>
    </div>
  ),
});

export default function UserDetailPage() {
  const params = route.useParams();
  // `params().id` is strictly typed as `number` (no `?.` required)
  return <div>Viewing User #{params().id}</div>;
}
```

### API Route with `route.handler()`

```ts
// src/routes/api/users/index.ts
import * as v from "valibot";
import { defineRoute } from "@skyjt/typed-routes-solid";

export const route = defineRoute({
  search: v.object({
    role: v.optional(v.picklist(["all", "admin", "operator"]), "all"),
    limit: v.optional(v.number(), 20),
  }),
});

export const GET = route.handler((event) => {
  const { role, limit } = event.search;
  return Response.json({ role, limit });
});
```

---

## Version History

| Version | Changes |
| :--- | :--- |
| `v0.4.0` / `v0.3.0` | Added `route.handler()`, `errorComponent`, `passThroughError`, `route.useError()`, and tightened `useParams()` / `useSearch()` to non-nullable `Accessor<T>`. |
| `v0.1.0` | Initial release of `defineRoute`. |