# Defining Routes

Routes are defined by placing files inside `src/routes/` and optionally exporting `export const route = defineRoute(...)` to declare schemas, preloaders, and validation error components.

---

## Creating a UI Page Route

Export a default SolidJS component from a `.tsx` file in `src/routes/`. To validate URL path parameters (`params`) or query strings (`search`), export `route = defineRoute(...)`:

```tsx
// src/routes/(main)/users/[id].tsx
import * as v from "valibot";
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
  const params = route.useParams();
  const search = route.useSearch();

  return (
    <section>
      <h1>User #{params().id}</h1>
      <p>Active Tab: {search().tab}</p>
    </section>
  );
}
```

> **Good to know**:
> - `route.useParams()` and `route.useSearch()` return non-nullable SolidJS `Accessor<T>` functions (`Accessor<{ id: number }>`, `Accessor<{ tab: "overview" | "activity" }>`).
> - Because `RouteValidationProvider` intercepts invalid parameters before mounting `UserProfilePage`, `params().id` is guaranteed to be a validated `number` whenever `UserProfilePage` renders.
> - String values from URLs (such as `"42"` or `"true"`) are automatically coerced to primitives (`42`, `true`) when validated against your schema.

---

## Creating a Layout Route

A file named after a directory or route group (for example, `src/routes/(main).tsx` next to `src/routes/(main)/`) acts as a layout wrapper for all child routes inside that directory:

```tsx
// src/routes/(main).tsx
import type { RouteSectionProps } from "@skyjt/typed-routes-solid";
import { Link } from "../router";

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