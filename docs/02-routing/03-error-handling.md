# Error Handling

TypedRoute includes a built-in route validation error boundary that prevents invalid URL parameters or search queries from crashing SSR or client rendering.

---

## How Validation Errors Work

When a user navigates to a URL whose `params` or `search` fail schema validation (for example, visiting `/users/abc` when `id` requires `v.number()`):

1. **Server Middleware (`createMiddleware`)**:
   - Invokes `route.config.onError` and `options.onValidationError({ error, rawParams, rawSearch, request, isPage: true })`.
   - If `onValidationError` returns `void` (does not return a custom `Response`), `createMiddleware` attaches `event.validationError = error` and calls `next()` so SSR renders the route's error boundary instead of returning a raw JSON 400 response.
2. **Route Component Boundary (`RouteValidationProvider`)**:
   - Short-circuits mounting the route's default component (`props.children`) so `route.useParams()` and `route.useSearch()` are never read in an invalid state.
   - Renders the fallback component in the following priority order:
     1. Per-route `errorComponent` configured in `defineRoute({ errorComponent })`
     2. Global `defaultErrorComponent` configured in `interceptFileRoutes(pageRoutes, { defaultErrorComponent })`
     3. Built-in `DefaultRouteErrorFallback` (`<div role="alert" data-route-validation-error="...">`)

---

## Per-Route `errorComponent`

Provide an `errorComponent` in `defineRoute` to render a contextual recovery UI with access to `error`, `rawParams`, and `rawSearch`:

```tsx
// src/routes/(main)/users/[id].tsx
import * as v from "valibot";
import { defineRoute } from "@skyjt/typed-routes-solid";
import { Link } from "../../../router";

export const route = defineRoute({
  params: v.object({
    id: v.number(),
  }),
  errorComponent: (props) => (
    <div class="card">
      <h2>Invalid User Identifier</h2>
      <p>
        Could not parse identifier "{props.rawParams.id}". Expected a numeric ID.
      </p>
      <p>
        Validation target: <code>{props.error.target}</code> (
        {props.error.issues.map((i) => i.message).join("; ")})
      </p>
      <Link to="/users/">Return to Directory</Link>
    </div>
  ),
});

export default function UserDetailPage() {
  const params = route.useParams();
  return <h1>User #{params().id}</h1>;
}
```

---

## Global `defaultErrorComponent`

Configure a shared fallback across all routes in `src/router.ts` via `interceptFileRoutes`:

```tsx
// src/router.ts
import { pageRoutes } from "virtual:file-routes";
import { createRouter, interceptFileRoutes } from "@skyjt/typed-routes-solid";

export const { Router, Link, useNavigate, paths } = createRouter<typeof pageRoutes>({
  routes: interceptFileRoutes(pageRoutes, {
    defaultErrorComponent: (props) => (
      <div role="alert">
        <h2>Invalid Route Request ({props.error.target})</h2>
        <p>{props.error.message}</p>
      </div>
    ),
  }),
});
```

---

## Manual Error Handling inside a Page (`passThroughError: true`)

If you prefer to keep the main page component mounted even when search query validation fails (for example, showing an inline banner while preserving filter inputs), set `passThroughError: true` and read `route.useError()`:

```tsx
export const route = defineRoute({
  search: v.object({
    page: v.number(),
  }),
  passThroughError: true,
});

export default function DirectoryPage() {
  const validationError = route.useError();
  const search = route.useSearch();

  return (
    <div>
      {validationError() && (
        <p class="banner-warning">{validationError()!.message}</p>
      )}
      <p>Current Page: {search().page ?? 1}</p>
    </div>
  );
}
```