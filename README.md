# TypedRoute Monorepo

> End-to-end compile-time typed routes, Universal Schema parameter validation, validation tuples ([data, error]), URL path building, and full-stack API middleware powered by [`filesystem-routing`](https://www.npmjs.com/package/filesystem-routing).

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-blue.svg)](LICENSE)

---

## Packages

| Package | Version | Description |
| :--- | :--- | :--- |
| **[`@skyjt/typed-routes`](./packages/typed-routes)** | `0.6.1` | Framework-agnostic routing core: schema validation (`StandardSchemaV1`, Valibot, Zod), coercion, path builder (`buildUrl`), type inference, `route.handler()`, `RouteValidationTuple` (`[data, error]`), `evaluateRouteTarget`, API middleware (`createMiddleware`), and Vite plugin. |
| **[`@skyjt/typed-routes-solid`](./packages/typed-routes-solid)** | `0.5.0` | SolidJS 2.0 and `@solidjs/router` adapter: `createRouter`, `interceptFileRoutes`, reactive `defineRoute` with `RouteAccessorTuple` accessors (`useParams`, `useSearch`), `<Link>`, `useNavigate`, and Solid SSR Vite plugin. |

---

## Documentation & API Reference

Browse the full documentation and API Reference in [`./docs`](./docs/index.md):

- **Getting Started**
  - [Installation](./docs/01-getting-started/01-installation.md)
  - [Project Structure](./docs/01-getting-started/02-project-structure.md)
- **Building Your Application: Routing**
  - [Defining Routes](./docs/02-routing/01-defining-routes.md)
  - [Linking and Navigating](./docs/02-routing/02-linking-and-navigating.md)
  - [Error Handling (`RouteValidationTuple` & `[data, error]`)](./docs/02-routing/03-error-handling.md)
  - [Route Handlers and Middleware (`route.handler` & `isPage`)](./docs/02-routing/04-route-handlers-and-middleware.md)
- **API Reference**
  - [Components: `<Link>`](./docs/03-api-reference/01-components/link.md)
  - [File Conventions: Route File Exports](./docs/03-api-reference/02-file-conventions/route-file-exports.md)
  - [Functions: `defineRoute`](./docs/03-api-reference/03-functions/define-route.md)
  - [Functions: `createMiddleware`](./docs/03-api-reference/03-functions/create-middleware.md)
  - [Functions: `createRouter` & `interceptFileRoutes`](./docs/03-api-reference/03-functions/create-router.md)
  - [Functions: `useNavigate`, `buildUrl`, & `validateData`](./docs/03-api-reference/03-functions/use-navigate-and-paths.md)
  - [Configuration: `routes()` Vite Plugin](./docs/03-api-reference/04-configuration/vite-plugin.md)

---

## Quick Start (SolidJS 2.0)

1. **Install packages**:
   ```bash
   bun add @skyjt/typed-routes @skyjt/typed-routes-solid filesystem-routing solid-js @solidjs/router @solidjs/web valibot
   ```

2. **Configure `vite.config.ts`**:
   ```ts
   import { defineConfig } from "vite";
   import solid from "@solidjs/vite-plugin";
   import { routes } from "@skyjt/typed-routes-solid/vite";

   export default defineConfig({
     plugins: [
       solid({ start: { middleware: "src/middleware.ts" }, ssr: true }),
       routes({ codeSplitting: true, types: true }),
     ],
   });
   ```

3. **Initialize the Router (`src/router.ts`)**:
   ```ts
   import { pageRoutes } from "virtual:file-routes";
   import { createRouter, interceptFileRoutes } from "@skyjt/typed-routes-solid";

   export const { Router, Link, useNavigate, paths } = createRouter<typeof pageRoutes>({
     routes: interceptFileRoutes(pageRoutes),
   });
   ```

4. **Define a Validated Page Route (`src/routes/(main)/users/[id].tsx`)**:
   ```tsx
   import * as v from "valibot";
   import { Show } from "solid-js";
   import { defineRoute } from "@skyjt/typed-routes-solid";
   import { Link } from "~/router";

   export const route = defineRoute({
     params: v.object({ id: v.number() }),
     search: v.object({ tab: v.optional(v.string(), "overview") }),
   });

   export default function UserPage() {
     const [params, paramsError] = route.useParams();
     const [search] = route.useSearch();

     return (
       <Show
         when={params()}
         fallback={
           <div role="alert">
             <p>Invalid user ID "{paramsError()?.rawParams.id}": {paramsError()?.message}</p>
             <Link to="/users/">Back to Directory</Link>
           </div>
         }
       >
         {(validParams) => (
           <div>User #{validParams().id} — Tab: {search()?.tab}</div>
         )}
       </Show>
     );
   }
   ```

5. **Define a Typed API Route (`src/routes/api/users/[id].ts`)**:
   ```ts
   import * as v from "valibot";
   import { defineRoute } from "@skyjt/typed-routes-solid";

   export const route = defineRoute({
     params: v.object({ id: v.number() }),
   });

   export const GET = route.handler((event) => {
     return Response.json({ userId: event.params.id });
   });
   ```

---

## Monorepo Development

```bash
# Install workspace dependencies
bun install

# Build all packages via Turborepo
bun run build

# Run unit & SSR integration tests
bun run test

# Run TypeScript typechecks & linter
bun run typecheck
bun run lint
```

---

## License

Mozilla Public License 2.0 (`MPL-2.0`). See [LICENSE](LICENSE) for details.