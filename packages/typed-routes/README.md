# `@skyjt/typed-routes`

> Framework-agnostic compile-time typed routes, sync/async Universal Schema validation (`StandardSchemaV1`, Valibot, Zod, custom parsers), local & cross-app URL path building (`buildUrl`, `createPaths`), method-scoped `route.handler(config, fn)` API builders (`body`, `headers`, `cookies`, `responses`, `use`, `openapi`), OpenAPI 3.1 specification & interactive UI (`generateOpenAPISpec`, `createOpenAPIHandler`), End-to-End Type Safety `[data, error]` Request Client (`createClient`), RFC 9457 Problem Details (`problem`), runtime adapters (`Bun`, `Node`, `Standard`), and zero-allocation static JSON response envelopes for [`filesystem-routing`](https://www.npmjs.com/package/filesystem-routing).

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-blue.svg)](LICENSE)

---

## Documentation & API Reference

See the full [TypedRoute Documentation](../../docs/index.md):

- [Defining Routes](../../docs/02-routing/01-defining-routes.md)
- [Linking and Navigating (Local & Cross-App)](../../docs/02-routing/02-linking-and-navigating.md)
- [Route Handlers, OpenAPI 3.1, and Middleware (`route.handler`, `use`, `HttpError`, & `isPage`)](../../docs/02-routing/04-route-handlers-and-middleware.md)
- [API Reference: `defineRoute`](../../docs/03-api-reference/03-functions/define-route.md)
- [API Reference: `createMiddleware` & OpenAPI 3.1](../../docs/03-api-reference/03-functions/create-middleware.md)
- [API Reference: `buildUrl`, `createPaths`, `createClient`, & `validateData`](../../docs/03-api-reference/03-functions/use-navigate-and-paths.md)
- [API Reference: `routes()` Vite Plugin](../../docs/03-api-reference/04-configuration/vite-plugin.md)

---

## Installation

```bash
bun add @skyjt/typed-routes filesystem-routing
```

If you are using SolidJS, install [`@skyjt/typed-routes-solid`](../typed-routes-solid) as well.

---

## Usage Overview

### 1. Typed API Route Handlers (`defineRoute`, `route.handler`, `defineMiddleware`, `json`, `HttpError`)

```ts
// src/routes/api/users/[id].ts
import * as v from "valibot";
import {
  defineMiddleware,
  defineRoute,
  HttpError,
  json,
} from "@skyjt/typed-routes";

const requireAuth = defineMiddleware((event) => {
  const token = event.request.headers.get("authorization");
  if (!token) {
    throw HttpError.unauthorized("Missing Authorization header");
  }
  return { currentUser: { role: "admin" as const } };
});

export const route = defineRoute({
  params: v.object({ id: v.number() }),
  search: v.object({ verbose: v.optional(v.boolean(), false) }),
});

export const GET = route.handler(
  {
    openapi: {
      summary: "Get User by ID",
      tags: ["Users"],
      operationId: "getUserById",
    },
  },
  (event) => {
    // event.params.id is `number`; event.search.verbose is `boolean`
    return json({
      id: event.params.id,
      verbose: event.search.verbose,
    });
  },
);

export const PATCH = route.handler(
  {
    openapi: {
      summary: "Update User",
      tags: ["Users"],
      operationId: "updateUser",
    },
    body: v.object({
      name: v.pipe(v.string(), v.nonEmpty()),
    }),
    use: [requireAuth],
  },
  (event) => {
    // event.body.name is `string`; event.context.currentUser.role is `"admin"`
    return json(
      {
        id: event.params.id,
        name: event.body.name,
        updatedBy: event.context.currentUser.role,
      },
      200,
    );
  },
);
```

### 2. Request Middleware with OpenAPI 3.1 & RFC 9457 Defaults (`createMiddleware`)

```ts
// src/middleware.ts
import routes from "virtual:file-routes";
import { createMiddleware } from "@skyjt/typed-routes";

export const apiMiddleware = createMiddleware(routes, {
  base: "/",
  adapter: "bun", // or "node", "standard", or custom RuntimeAdapter (auto-detected by default)
  openapi: {
    path: "/openapi.json",
    docsPath: "/docs",
    ui: "scalar", // "scalar" | "swagger" | "redoc" | "elements" | CustomOpenAPIUIRenderer | false
    info: {
      title: "Users API",
      version: "1.0.0",
    },
  },
  // Validation and API errors automatically default to RFC 9457 Problem Details (application/problem+json).
  // Any custom onValidationError / onApiError returning json(...) is automatically reflected into OpenAPI!
});
```

### 3. End-to-End Type Safety `[data, error]` Request Client (`createClient`)

```ts
import type routes from "virtual:file-routes";
import { createClient } from "@skyjt/typed-routes";

export const api = createClient<typeof routes>({ baseUrl: "http://localhost:3000" });

const [user, error] = await api.get("/api/users/:id", {
  params: { id: 42 },
  search: { verbose: true },
});

if (error) {
  // error conforms to RFC 9457 ProblemDetails (type, title, status, detail, instance)
  console.error(error.status, error.title, error.detail);
} else {
  console.log(user.id, user.verbose);
}
```

### 4. Standalone Local & Cross-App Typed Paths (`createPaths`)

```ts
import type mainRoutes from "virtual:file-routes";
import type docsRoutes from "../../docs-app/file-routes";
import { createPaths } from "@skyjt/typed-routes";

export const paths = createPaths<
  typeof mainRoutes,
  { docs: typeof docsRoutes }
>({
  apps: {
    docs: { baseUrl: "https://docs.example.com", target: "_blank" },
  },
});

const localHref = paths.build("/users/:id", { params: { id: 1 } });
const externalHref = paths.build("docs", "/guides/:slug", {
  params: { slug: "getting-started" },
});
```

---

## License

Mozilla Public License 2.0 (`MPL-2.0`). See [LICENSE](LICENSE) for details.
