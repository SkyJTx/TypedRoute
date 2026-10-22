# Defining Routes

Routes are defined by placing files inside `src/routes/` and optionally exporting `export const route = defineRoute(...)` to declare schemas, preloaders, and validation error telemetry.

---

## Creating a UI Page Route

Export a default SolidJS component from a `.tsx` file in `src/routes/`. To validate URL path parameters (`params`) or query strings (`search`), export `route = defineRoute(...)`:

```tsx
// src/routes/(main)/users/[id].tsx
import * as v from "valibot";
import { Show } from "solid-js";
import { defineRoute } from "@skyjt/typed-routes-solid";

export const route = defineRoute({
  params: v.object({
    id: v.number(),
  }),
  search: v.object({
    tab: v.optional(v.picklist(["overview", "activity"]), "overview"),
  }),
});

export default function UserProfilePage() {
  const [params, paramsError] = route.useParams();
  const [search, searchError] = route.useSearch();

  return (
    <Show
      when={params()}
      fallback={
        <div role="alert">
          <h1>Invalid User ID</h1>
          <p>{paramsError()?.message}</p>
        </div>
      }
    >
      {(validParams) => (
        <section>
          <h1>User #{validParams().id}</h1>
          <p>Active Tab: {search()?.tab}</p>
        </section>
      )}
    </Show>
  );
}
```

> **Good to know**:
> - `route.useParams()` and `route.useSearch()` return reactive SolidJS `RouteAccessorTuple<T>` accessors (`readonly [data: Accessor<T | undefined>, error: Accessor<RouteValidationError | undefined>]`), unpacked once at component setup following Solid's `createSignal` convention (`const [params, paramsError] = route.useParams()`).
> - `params()` and `paramsError()` are independent fine-grained `createMemo` accessors. Passing `when={params()}` to Solid's `<Show>` promotes `validParams` to a non-nullable `Accessor<TParams>` (`Accessor<{ id: number }>`) with 100% fine-grained DOM updates and zero remounts on sibling navigation (`/users/1` -> `/users/2`).
> - In effects or observers, `createEffect(() => params(), (validParams) => { if (!validParams) return; ... })` narrows `validParams` to `TParams`.
> - String values from URLs (such as `"42"` or `"true"`) are automatically coerced to primitives (`42`, `true`) when validated against your schema.

---

## Creating a Layout Route

A file named after a directory or route group (for example, `src/routes/(main).tsx` next to `src/routes/(main)/`) acts as a layout wrapper for all child routes inside that directory:

```tsx
// src/routes/(main).tsx
import type { RouteSectionProps } from "@skyjt/typed-routes-solid";
import { Link } from "~/router";

export default function MainLayout(props: RouteSectionProps) {
  return (
    <div class="app-layout">
      <header>
        <Link to="/">Dashboard</Link>
        <Link to="/users/">Directory</Link>
      </header>
      <main>{props.children}</main>
    </div>
  );
}
```

> **Good to know**: `RouteSectionProps` and `Location` are re-exported directly from `@skyjt/typed-routes-solid`, so layout and page components never need to import from `@solidjs/router` directly.
