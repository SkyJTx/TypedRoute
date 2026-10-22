# Linking and Navigating

TypedRoute provides compile-time checked navigation primitives created from your `pageRoutes` manifest tuple in `src/router.ts`.

---

## Initializing the Router (`src/router.ts`)

Pass `typeof pageRoutes` as the type argument to `createRouter`:

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

## Declarative Navigation with `<Link>`

Use `<Link>` to render an `<a>` element with compile-time validation for `to`, `params`, and `search`:

```tsx
import { Link } from "~/router";

export function UserDirectoryActions() {
  return (
    <nav>
      {/* Static route: params is disallowed */}
      <Link to="/">Home</Link>

      {/* Dynamic route with schema: params={{ id: number }} is required */}
      <Link to="/users/:id" params={{ id: 42 }}>
        View User 42
      </Link>

      {/* Route with optional search schema: search keys are optional */}
      <Link to="/users/" search={{ role: "admin", q: "wriothesley" }}>
        Filter Admins
      </Link>
    </nav>
  );
}
```

---

## Programmatic Navigation with `useNavigate()`

Call `useNavigate()` inside a component to navigate imperatively in event handlers or actions:

```tsx
import { useNavigate } from "~/router";

export function SearchToolbar() {
  const navigate = useNavigate();

  const applyFilter = (role: "all" | "admin" | "operator") => {
    navigate("/users/", {
      search: { role },
      replace: true,
    });
  };

  return (
    <button type="button" onClick={() => applyFilter("admin")}>
      Show Admins
    </button>
  );
}
```

> **Good to know**:
> - If a route defines `params: v.object({ id: v.number() })` in `defineRoute`, `RouteParamsFor` infers `{ id: number }`.
> - If a dynamic route `/posts/:slug` does **not** export `defineRoute({ params })`, `RouteParamsFor` automatically falls back to `ExtractPathParams<"/posts/:slug">`, inferring `{ slug: string | number }`.
> - `RouteSearchFor` automatically wraps schema output keys in `Partial<...>`, allowing callers to omit keys that have schema defaults (`v.optional(v.string(), "")`).