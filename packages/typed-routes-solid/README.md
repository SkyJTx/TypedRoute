# `@skyjt/typed-routes-solid`

> SolidJS 2.0 and `@solidjs/router` adapter for [`@skyjt/typed-routes`](../typed-routes), providing end-to-end compile-time typed routing, local & cross-app navigation (`<Link>`, `useNavigate`, `paths`), reactive `RouteAccessorTuple` parameter validation (`[params, paramsError]`), method-scoped API handlers (`body`, `headers`, `cookies`, `use`, `responses`, `openapi`), OpenAPI 3.1 documentation, and the End-to-End Type Safety `[data, error]` Request Client (`createClient`) powered by [`filesystem-routing`](https://www.npmjs.com/package/filesystem-routing).

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-blue.svg)](LICENSE)

---

## Documentation & API Reference

See the full [TypedRoute Documentation](../../docs/index.md):

- [Installation & Setup](../../docs/01-getting-started/01-installation.md)
- [Defining Routes](../../docs/02-routing/01-defining-routes.md)
- [Linking and Navigating (Local & Cross-App)](../../docs/02-routing/02-linking-and-navigating.md)
- [Error Handling (`RouteAccessorTuple` & `[data, error]`)](../../docs/02-routing/03-error-handling.md)
- [Route Handlers, OpenAPI 3.1, and Middleware (`route.handler`, `use`, `HttpError`, & `isPage`)](../../docs/02-routing/04-route-handlers-and-middleware.md)
- [API Reference: `<Link>`](../../docs/03-api-reference/01-components/link.md)
- [API Reference: `defineRoute`](../../docs/03-api-reference/03-functions/define-route.md)
- [API Reference: `createMiddleware` & OpenAPI 3.1](../../docs/03-api-reference/03-functions/create-middleware.md)
- [API Reference: `createRouter` & `interceptFileRoutes`](../../docs/03-api-reference/03-functions/create-router.md)
- [API Reference: `useNavigate`, `createPaths`, & `createClient`](../../docs/03-api-reference/03-functions/use-navigate-and-paths.md)

---

## Installation

```bash
bun add @skyjt/typed-routes @skyjt/typed-routes-solid filesystem-routing solid-js @solidjs/router @solidjs/web valibot
```

---

## Quick Usage

### 1. Router Initialization with Optional Cross-App Targets (`src/router.ts`)

```ts
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

### 2. Validated Page Route with `RouteAccessorTuple` (`src/routes/(main)/users/[id].tsx`)

```tsx
import * as v from "valibot";
import { Show } from "solid-js";
import { defineRoute } from "@skyjt/typed-routes-solid";
import { Link } from "~/router";

export const route = defineRoute({
  params: v.object({
    id: v.number(),
  }),
});

export default function UserDetailPage() {
  const [params, paramsError] = route.useParams();

  return (
    <Show
      when={params()}
      fallback={
        <div role="alert">
          <h2>Invalid User Identifier "{paramsError()?.rawParams.id}"</h2>
          <p>{paramsError()?.message}</p>
          <Link to="/users/">Return to Directory</Link>
        </div>
      }
    >
      {(validParams) => <h1>User ID: {validParams().id}</h1>}
    </Show>
  );
}
```

### 3. End-to-End Type Safety `[data, error]` Request Client (`src/services/api-client.ts`)

```ts
import type routes from "virtual:file-routes";
import { createClient } from "@skyjt/typed-routes-solid";

export const apiClient = createClient<typeof routes>();

export async function fetchUserById(id: number) {
  const [data, error] = await apiClient.get("/api/users/:id", {
    params: { id },
  });
  if (error) {
    throw new Error(error.detail || `User ${id} not found`);
  }
  return data;
}
```

### 4. Server Middleware with OpenAPI 3.1 & Scalar UI (`src/middleware.ts`)

```ts
import routes from "virtual:file-routes";
import { createMiddleware } from "@skyjt/typed-routes-solid";

export default createMiddleware(routes, {
  base: "/",
  openapi: {
    info: {
      title: "TypedRoute Solid API",
      version: "1.0.0",
    },
    ui: "scalar", // Serves interactive Scalar API Reference at GET /docs and spec at GET /openapi.json
  },
});
```

---

## License

Mozilla Public License 2.0 (`MPL-2.0`). See [LICENSE](LICENSE) for details.
