# Error Handling

TypedRoute handles parameter and query string validation errors using reactive accessor tuples (`RouteAccessorTuple<T>`) in SolidJS UI components and discriminated value tuples (`RouteValidationTuple<T>`) in route preloading. This design integrates with Solid 2 reactivity and TypeScript control-flow type narrowing, eliminating component-level error boundaries or hidden error states.

---

## How Validation Errors Work

When a user visits a route with invalid URL parameters or search queries (for example, `/users/abc` when `id` requires `v.number()`):

1. **Server Middleware (`createMiddleware`)**:
   - For UI page requests (`isPage: true`), if `options.onValidationError` returns `void`, `createMiddleware` sets `event.validationError = error` and falls through via `next()`. This allows SSR to render the page component directly with validation error information instead of returning a generic 400 JSON response.
2. **Reactive Accessor Tuples (`RouteAccessorTuple<T>`)**:
   - `route.useParams()` and `route.useSearch()` return a tuple of two independent reactive accessors:

     ```ts
     export type RouteAccessorTuple<T> = readonly [
       data: Accessor<T | undefined>,
       error: Accessor<RouteValidationError | undefined>,
     ];
     ```

   - Unpacked once at component setup (`const [params, paramsError] = route.useParams()`), following Solid's `createSignal` idiom.
   - Passing `when={params()}` to Solid's `<Show>` promotes the keyed render prop `(validParams)` to a non-nullable `Accessor<TParams>`, providing fine-grained DOM updates without remounting the page on parameter changes.

---

## Validating in UI Page Components

Unpack accessors once at component setup and pass them to `<Show>`:

```tsx
// src/routes/(main)/users/[id].tsx
import * as v from "valibot";
import { Show } from "solid-js";
import { defineRoute } from "@skyjt/typed-routes-solid";
import { Link } from "~/router";

export const route = defineRoute({
  params: v.object({
    id: v.number(),
  }),
  search: v.object({
    tab: v.optional(v.string(), "overview"),
  }),
});

export default function UserDetailPage() {
  const [params, paramsError] = route.useParams();
  const [search, searchError] = route.useSearch();

  return (
    <div>
      <Show
        when={params()}
        fallback={
          <div role="alert" class="card error">
            <h2>Invalid User Identifier</h2>
            <p>Could not parse identifier "{paramsError()?.rawParams.id}". Expected a numeric ID.</p>
            <p>Validation target: <code>{paramsError()?.target}</code></p>
            <Link to="/users/">Return to Directory</Link>
          </div>
        }
      >
        {(validParams) => (
          <section>
            <h1>User #{validParams().id}</h1>
            <Show
              when={search()}
              fallback={<p class="banner-warning">Invalid search query: {searchError()?.message}</p>}
            >
              {(validSearch) => <p>Active Tab: {validSearch().tab}</p>}
            </Show>
          </section>
        )}
      </Show>
    </div>
  );
}
```

### Why `RouteAccessorTuple` is Solid 2 Best Practice

- **Idiomatic Setup**: Unpacked once at component setup (`const [params, paramsError] = route.useParams()`), matching `createSignal` and `createResource`.
- **Fine-Grained Independence**: `params()` and `paramsError()` are independent `createMemo` signals. When navigating between valid sibling parameters (`/users/1` -> `/users/2`), `paramsError()` remains `undefined` and only fine-grained bindings inside `<Show>` update, with zero component or DOM remounting.
- **Type-Safe Narrowing**: Inside `<Show when={params()}>`, the keyed render prop `validParams` is typed as `Accessor<TParams>` (`Accessor<{ id: number }>`).
- **Reactivity in Effects**: In `createEffect`:

  ```ts
  createEffect(() => params(), (validParams) => {
    if (!validParams) return;
    // validParams is narrowed to TParams
    console.log("Viewing user:", validParams.id);
  });
  ```

---

## Validation in Preloading (`preload`)

When defining route preloading logic with `preload`, arguments are passed as discriminated value tuples (`RouteValidationTuple<T>`):

```tsx
import * as v from "valibot";
import { defineRoute } from "@skyjt/typed-routes-solid";
import { fetchUserData } from "~/api/users";

export const route = defineRoute({
  params: v.object({ id: v.number() }),
  search: v.object({ tab: v.optional(v.string()) }),
  preload: ({ params: [params, paramsErr], search: [search, searchErr], location }) => {
    // Check if parameters failed validation before initiating network requests
    if (paramsErr) {
      return null;
    }

    return fetchUserData(params.id, {
      tab: search?.tab,
    });
  },
});
```

> **Good to know**: `preload` receives the value tuple `[data, error]` directly (not accessors) because preloading runs once per navigation before component instantiation.

---

## Telemetry and Logging Side Effects (`onError`)

The `onError` callback in `defineRoute` is retained strictly for telemetry, structured logging, and monitoring side effects (e.g. Sentry, Datadog):

```tsx
export const route = defineRoute({
  params: v.object({ id: v.number() }),
  onError({ error, rawParams, rawSearch }) {
    console.error(`[Route Validation Failed] target=${error.target}`, {
      issues: error.issues,
      rawParams,
      rawSearch,
    });
  },
});
```

> **Good to know**: `onError` runs during both server evaluation (`createMiddleware`) and client/SSR reactivity (`RouteValidationProvider`), but does not alter the return values of `useParams()` or `useSearch()`.

---

## Server Validation Fallthrough in `createMiddleware`

In your server middleware (`src/middleware.ts`), UI page validation errors fall through to Solid SSR:

```ts
import routes from "virtual:file-routes";
import { createMiddleware } from "@skyjt/typed-routes-solid";

export default createMiddleware(routes, {
  onValidationError({ error, rawParams, rawSearch, isPage }) {
    // Allow UI page requests (isPage === true) to fall through to SSR
    if (isPage) {
      return;
    }

    // Return a structured 400 JSON response for API endpoints
    return Response.json(
      {
        error: "Route Validation Error",
        target: error.target,
        issues: error.issues,
        received: { params: rawParams, search: rawSearch },
      },
      { status: 400 },
    );
  },
});
```
