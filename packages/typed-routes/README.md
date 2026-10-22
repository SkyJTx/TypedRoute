# `@skyjt/typed-routes`

> Framework-agnostic compile-time typed routes, Universal Schema validation (`StandardSchemaV1`, Valibot, Zod, custom parsers), URL path building, typed `route.handler()` API builders, and request middleware for [`filesystem-routing`](https://www.npmjs.com/package/filesystem-routing).

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-blue.svg)](LICENSE)

---

## Documentation & API Reference

See the full [TypedRoute Documentation](../../docs/index.md):

- [Defining Routes](../../docs/02-routing/01-defining-routes.md)
- [Route Handlers and Middleware (`isPage` Lifecycle)](../../docs/02-routing/04-route-handlers-and-middleware.md)
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

### 1. Typed API Route Handlers (`defineRoute` & `route.handler`)

```ts
// src/routes/api/users/[id].ts
import * as v from "valibot";
import { defineRoute } from "@skyjt/typed-routes";

export const route = defineRoute({
  params: v.object({ id: v.number() }),
  search: v.object({ verbose: v.optional(v.boolean(), false) }),
});

export const GET = route.handler((event) => {
  // event.params.id is `number`; event.search.verbose is `boolean`
  return Response.json({
    id: event.params.id,
    verbose: event.search.verbose,
  });
});
```

### 2. Request Middleware (`createMiddleware`)

```ts
// src/middleware.ts
import routes from "virtual:file-routes";
import { createMiddleware } from "@skyjt/typed-routes";

export const apiMiddleware = createMiddleware(routes, {
  base: "/",
  onValidationError({ error, rawParams, rawSearch, isPage }) {
    // Allow UI page requests (isPage === true) to proceed to SSR page rendering
    if (isPage) {
      return;
    }
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

---

## License

Mozilla Public License 2.0 (`MPL-2.0`). See [LICENSE](LICENSE) for details.