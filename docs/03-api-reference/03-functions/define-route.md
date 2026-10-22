# `defineRoute`

`defineRoute` declares validation schemas (`params`, `search`, `state`, `hash`), preloading logic, validation error telemetry, reactive SolidJS `RouteAccessorTuple` accessors, and typed API handler builders for a route file.

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
| `preload` | `(args: { params: RouteValidationTuple<TParams>; search: RouteValidationTuple<TSearch>; location: Location<TState> }) => TData` | `undefined` | Preload callback invoked by `@solidjs/router` with `params` and `search` as discriminated `RouteValidationTuple` values. |
| `onError` | `(args: { error: RouteValidationError; rawParams: Record<string, string \| undefined>; rawSearch: Record<string, unknown> }) => void` | `undefined` | Side-effect telemetry callback invoked whenever `params` or `search` validation fails on either the server (`createMiddleware`) or client/SSR (`RouteValidationProvider`). |
| `info` | `Record<string, unknown>` | `undefined` | Arbitrary route metadata forwarded to `@solidjs/router`. |

---

### Returns

`defineRoute` returns a `DefinedRouteObject<TParams, TSearch, TState, THash, TData>` (in `@skyjt/typed-routes-solid`) or `DefinedRouteConfig` (in `@skyjt/typed-routes`):

| Property / Method | Type | Description |
| :--- | :--- | :--- |
| `config` | `SolidRouteConfig<...>` | The underlying route configuration object read by `interceptFileRoutes` and `createMiddleware`. |
| `useParams()` | `RouteAccessorTuple<TParams>` | (`@skyjt/typed-routes-solid`) Returns a reactive tuple of accessors (`readonly [data: Accessor<TParams \| undefined>, error: Accessor<RouteValidationError \| undefined>]`). Unpacked once at component setup; pair with `<Show when={params()}>` to promote `validParams` to a non-nullable `Accessor<TParams>`. |
| `useSearch()` | `RouteAccessorTuple<TSearch>` | (`@skyjt/typed-routes-solid`) Returns a reactive tuple of accessors (`readonly [data: Accessor<TSearch \| undefined>, error: Accessor<RouteValidationError \| undefined>]`). Unpacked once at component setup; pair with `<Show when={search()}>` to promote `validSearch` to a non-nullable `Accessor<TSearch>`. |
| `useLocation()` | `Location<TState>` | (`@skyjt/typed-routes-solid`) Returns the current `@solidjs/router` location object. |
| `handler(fn)` | `TypedAPIHandler<TParams, TSearch, TResult>` | Identity helper that binds an HTTP handler function `(event: TypedAPIEvent<TParams, TSearch>) => TResult` to the route's inferred `TParams` and `TSearch` types. |

---

## Reactive Accessor Tuples (`RouteAccessorTuple<T>`)

In SolidJS components, `route.useParams()` and `route.useSearch()` return `RouteAccessorTuple<T>`:

```ts
export type RouteAccessorTuple<T> = readonly [
  data: Accessor<T | undefined>,
  error: Accessor<RouteValidationError | undefined>,
];
```

Unpack accessors once at the component setup root, matching Solid's `createSignal` pattern:

```tsx
import { Show } from "solid-js";

export default function UserDetailPage() {
  const [params, paramsError] = route.useParams();

  return (
    <Show
      when={params()}
      fallback={
        <div role="alert">
          <p>Invalid ID: {paramsError()?.message}</p>
        </div>
      }
    >
      {(validParams) => <div>Viewing User #{validParams().id}</div>}
    </Show>
  );
}
```

### Why `RouteAccessorTuple` is Solid 2 Best Practice

1. **Unpacked Once**: Unpack `const [params, paramsError] = route.useParams()` once during component initialization.
2. **Fine-Grained Independence**: `params()` and `paramsError()` are independent `createMemo` signals. When navigating between sibling parameter values (`/users/1` -> `/users/2`), only fine-grained bindings inside `<Show>` update without remounting the component.
3. **Type Promotion**: Inside `<Show when={params()}>`, `validParams` is typed as non-nullable `Accessor<TParams>`.
4. **Reactivity in Effects**: In `createEffect`:
   ```ts
   createEffect(() => params(), (validParams) => {
     if (!validParams) return;
     console.log("User ID:", validParams.id);
   });
   ```

---

## Preloading & Core Target Evaluation (`RouteValidationTuple<T>`)

For route preloading and server evaluation, TypedRoute uses the discriminated value tuple `RouteValidationTuple<T>`:

```ts
export type RouteValidationTuple<T> =
  | [data: T, error: undefined]
  | [data: undefined, error: RouteValidationError];
```

### Evaluating Route Targets Directly (`evaluateRouteTarget`)

Core validation uses `evaluateRouteTarget` (exported from `@skyjt/typed-routes`):

```ts
import { evaluateRouteTarget } from "@skyjt/typed-routes";

const [data, error] = evaluateRouteTarget(
  "params",
  route.config.params,
  rawParams,
  { rawParams, rawSearch },
  route.config.onError,
);
```

### Creating Accessor Tuples (`createRouteAccessorTuple`)

In SolidJS adapters, `createRouteAccessorTuple` wraps a tuple computation function into a `RouteAccessorTuple<T>`:

```ts
import { createRouteAccessorTuple } from "@skyjt/typed-routes-solid";

const [data, error] = createRouteAccessorTuple(() =>
  evaluateRouteTarget("params", schema, raw, context, onError)
);
```

---

## Examples

### UI Page with `<Show>` Error Handling

```tsx
// src/routes/(main)/users/[id].tsx
import * as v from "valibot";
import { Show } from "solid-js";
import { defineRoute } from "@skyjt/typed-routes-solid";
import { Link } from "~/router";

export const route = defineRoute({
  params: v.object({ id: v.number() }),
});

export default function UserDetailPage() {
  const [params, paramsError] = route.useParams();

  return (
    <Show
      when={params()}
      fallback={
        <div class="error-card" role="alert">
          <h2>Invalid User ID: "{paramsError()?.rawParams.id}"</h2>
          <p>{paramsError()?.message}</p>
          <Link to="/users/">Back to Users</Link>
        </div>
      }
    >
      {(validParams) => <div>Viewing User #{validParams().id}</div>}
    </Show>
  );
}
```

### Preloading with Tuple Arguments

```tsx
export const route = defineRoute({
  params: v.object({ id: v.number() }),
  preload: ({ params: [params, error] }) => {
    if (error) {
      return null;
    }
    return fetchUser(params.id);
  },
});
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
| `v0.6.0` / `v0.5.0` | Introduced `RouteAccessorTuple<T>` (`[data, error]`) accessors for `useParams()` and `useSearch()`, `RouteValidationTuple` for `preload()`, added `evaluateRouteTarget` and `createRouteAccessorTuple`, retained `onError` for telemetry. Removed `errorComponent`, `passThroughError`, and `useError()`. |
| `v0.4.0` / `v0.3.0` | Added `route.handler()`. |
| `v0.1.0` | Initial release of `defineRoute`. |
