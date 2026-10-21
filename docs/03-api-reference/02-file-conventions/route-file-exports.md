# Route File Exports

Route files inside `src/routes/` support a standardized set of named and default exports that `filesystem-routing`, `@skyjt/typed-routes`, and `@skyjt/typed-routes-solid` use to wire UI components, validation schemas, and HTTP API handlers.

```tsx
// src/routes/(main)/users/[id].tsx
import * as v from "valibot";
import { defineRoute } from "@skyjt/typed-routes-solid";

// 1. Route configuration & validation schema export
export const route = defineRoute({
  params: v.object({ id: v.number() }),
});

// 2. Default UI page component export
export default function UserPage() {
  const params = route.useParams();
  return <h1>User #{params().id}</h1>;
}
```

---

## Reference

### Supported Exports

| Export Name | Environment | Type | Description |
| :--- | :--- | :--- | :--- |
| `route` | Server & Client | `DefinedRouteObject` / `DefinedRouteConfig` | Created via `defineRoute(...)`. Declares `params`, `search`, `state`, `hash` schemas, `preload`, `onError`, and `errorComponent`. Picked eagerly into `$$route` in `virtual:file-routes`. |
| `default` | Server (SSR) & Client | `Component<RouteSectionProps>` | The UI page or layout component rendered by `@solidjs/router`. Code-split into `$component` in `virtual:file-routes`. |
| `GET` | Server Only | `TypedAPIHandler<TParams, TSearch>` | Handles HTTP `GET` (and fallback `HEAD`) requests. Returning `undefined` on a hybrid page route (`page: true`) declines API handling and renders the UI component instead. |
| `POST` | Server Only | `TypedAPIHandler<TParams, TSearch>` | Handles HTTP `POST` requests. Must return a `Response`, `string`, or JSON-serializable value. |
| `PUT` | Server Only | `TypedAPIHandler<TParams, TSearch>` | Handles HTTP `PUT` requests. |
| `PATCH` | Server Only | `TypedAPIHandler<TParams, TSearch>` | Handles HTTP `PATCH` requests. |
| `DELETE` | Server Only | `TypedAPIHandler<TParams, TSearch>` | Handles HTTP `DELETE` requests. |
| `HEAD` | Server Only | `TypedAPIHandler<TParams, TSearch>` | Handles HTTP `HEAD` requests explicitly (overrides the automatic `GET` fallback). |
| `OPTIONS` | Server Only | `TypedAPIHandler<TParams, TSearch>` | Handles HTTP `OPTIONS` preflight/discovery requests. |
| `QUERY` | Server Only | `TypedAPIHandler<TParams, TSearch>` | Handles HTTP `QUERY` (idempotent body-carrying query) requests. |

> **Good to know**:
> - Client builds automatically strip all `$GET`, `$POST`, `$DELETE`, etc. handler references from `virtual:file-routes` so server-only code imported by API handlers never enters the browser bundle.
> - Use `route.handler((event) => ...)` to define HTTP method exports so `event.params` and `event.search` are automatically typed from `export const route = defineRoute(...)`.

---

## Version History

| Version | Changes |
| :--- | :--- |
| `v0.4.0` | Added `route.handler()` for typed HTTP method exports and leaf manifest splitting for `$$route` imports. |
| `v0.1.0` | Initial support for `route`, `default`, and HTTP method exports. |