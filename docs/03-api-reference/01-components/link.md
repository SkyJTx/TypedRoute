# `<Link>`

`<Link>` is a SolidJS component that extends `@solidjs/router`'s `<A>` element with compile-time route path validation, typed path parameters (`params`), and typed search query serialization (`search`).

```tsx
import { Link } from "~/router";

export default function Navigation() {
  return (
    <Link to="/users/:id" params={{ id: 1 }} search={{ tab: "overview" }}>
      View User Profile
    </Link>
  );
}
```

---

## Reference

### Props

`<Link>` accepts the following props in addition to standard HTML `<a>` attributes (`class`, `style`, `id`, `aria-*`, etc.):

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `to` | `ExtractRoutePaths<TManifest>` | **Required** | Target route path literal from `pageRoutes` (for example, `"/"`, `"/users/"`, `"/users/:id"`). |
| `params` | `RouteParamsFor<TManifest, Path>` | Conditional | Object containing dynamic path parameters. **Required** when the route path contains `:param` or `*wildcard` segments; disallowed on static paths. |
| `search` | `RouteSearchFor<TManifest, Path>` | `undefined` | Optional search query object. Keys are inferred as `Partial<InferOutput<TSearchSchema>>` when the target route defines a `search` schema. |
| `hash` | `string` | `undefined` | Optional URL hash fragment (with or without leading `#`). |
| `state` | `TState` | `undefined` | Optional history state passed to `@solidjs/router`. |
| `replace` | `boolean` | `false` | When `true`, replaces the current history entry instead of pushing a new entry. |
| `noScroll` | `boolean` | `false` | When `true`, prevents scrolling to the top of the page after navigation. |
| `preload` | `boolean` | `true` | Controls whether `@solidjs/router` preloads the target route on hover/focus. |
| `activeClass` | `string` | `"active"` | CSS class applied when the link's `href` matches the current location. |
| `inactiveClass` | `string` | `"inactive"` | CSS class applied when the link's `href` does not match the current location. |
| `end` | `boolean` | `false` | When `true`, only matches `activeClass` when the pathname matches the end of the URL exactly. |

> **Good to know**:
> - Always import the bound `<Link>` returned by `createRouter<typeof pageRoutes>(...)` in `src/router.ts` so `TManifest` is pre-bound to your project's `pageRoutes` tuple.
> - Because `virtual:file-routes` splits its manifest into a leaf module (`virtual:file-routes-manifest:*`), you can safely import `<Link>` from `src/router.ts` inside `defineRoute({ errorComponent })` without causing circular SSR import errors.

---

## Examples

### Linking to Dynamic Routes

```tsx
import { Link } from "~/router";

export function UserRow(props: { userId: number; name: string }) {
  return (
    <Link
      to="/users/:id"
      params={{ id: props.userId }}
      class="btn btn-outline"
    >
      Inspect {props.name}
    </Link>
  );
}
```

### Linking with Typed Search Queries

```tsx
import { Link } from "~/router";

export function RoleFilterTabs() {
  return (
    <div class="tabs">
      <Link to="/users/" search={{ role: "admin" }}>
        Admins
      </Link>
      <Link to="/users/" search={{ role: "operator", q: "sector-4" }}>
        Sector 4 Operators
      </Link>
    </div>
  );
}
```

---

## Version History

| Version | Changes |
| :--- | :--- |
| `v0.3.0` | Fixed `RouteParamsFor` and `RouteSearchFor` so routes without explicit schemas infer path parameters and allow optional search queries without casts. |
| `v0.1.0` | Initial release of `<Link>` in `@skyjt/typed-routes-solid`. |