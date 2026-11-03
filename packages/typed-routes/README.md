# `@skyjt/typed-routes`

> Framework-agnostic compile-time typed routes, sync/async Universal Schema validation (`StandardSchemaV1`, Valibot, Zod, custom parsers), URL path building, method-scoped `route.handler(config, fn)` API builders (`body`, `headers`, `cookies`, `responses`, `use`), composable middleware, typed responses, `HttpError`, and RPC type inference for [`filesystem-routing`](https://www.npmjs.com/package/filesystem-routing).

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-blue.svg)](LICENSE)

---

## Documentation & API Reference

See the full [TypedRoute Documentation](../../docs/index.md):

- [Defining Routes](../../docs/02-routing/01-defining-routes.md)
- [Route Handlers and Middleware (`route.handler`, `use`, `HttpError`, & `isPage`)](../../docs/02-routing/04-route-handlers-and-middleware.md)
- [API Reference: `defineRoute`](../../docs/03-api-reference/03-functions/define-route.md)
- [API Reference: `createMiddleware`](../../docs/03-api-reference/03-functions/create-middleware.md)
- [API Reference: `buildUrl` & `validateData`](../../docs/03-api-reference/03-functions/use-navigate-and-paths.md)
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

export const GET = route.handler((event) => {
  // event.params.id is `number`; event.search.verbose is `boolean`
  return json({
    id: event.params.id,
    verbose: event.search.verbose,
  });
});

export const PATCH = route.handler(
  {
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

### 2. Request Middleware (`createMiddleware`)

```ts
// src/middleware.ts
import routes from "virtual:file-routes";
import { createMiddleware } from "@skyjt/typed-routes";

export const apiMiddleware = createMiddleware(routes, {
  base: "/",
  onValidationError({ error, rawParams, rawSearch, rawBody, isPage }) {
    // Allow UI page requests (isPage === true) to proceed to SSR page rendering
    if (isPage) {
      return;
    }
    return Response.json(
      {
        error: "Route Validation Error",
        target: error.target,
        issues: error.issues,
        received: { params: rawParams, search: rawSearch, body: rawBody },
      },
      { status: 400 },
    );
  },
  onApiError({ error }) {
    return Response.json(
      {
        error: error.message,
        status: error.status,
        code: error.code,
        details: error.details,
      },
      { status: error.status },
    );
  },
});
```

---

## License

Mozilla Public License 2.0 (`MPL-2.0`). See [LICENSE](LICENSE) for details.
