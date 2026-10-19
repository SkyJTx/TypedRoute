# TypedRoute Monorepo

> End-to-end compile-time typed routes, Universal Schema parameter validation, URL path building, and API middleware powered by [`filesystem-routing`](https://www.npmjs.com/package/filesystem-routing).

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)

---

## Packages

| Package | Version | Description |
| :--- | :--- | :--- |
| **[`@skyjt/typed-routes`](./packages/typed-routes)** | `0.1.0` | Framework-agnostic routing core: schema validation (`StandardSchemaV1`, Zod), coercion, path builder (`buildUrl`), type inference, API middleware, and Vite plugin. |
| **[`@skyjt/typed-routes-solid`](./packages/typed-routes-solid)** | `0.1.0` | SolidJS and `@solidjs/router` adapter: `createRouter`, `interceptFileRoutes`, reactive `defineRoute`, `<Link>`, `useNavigate`, and Solid SSR Vite plugin. |

---

## Quick Start (SolidJS)

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
     plugins: [solid(), routes({ codeSplitting: true })],
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

4. **Define a Route (`src/routes/users/[id].tsx`)**:
   ```tsx
   import * as v from "valibot";
   import { defineRoute } from "@skyjt/typed-routes-solid";

   export const route = defineRoute({
     params: v.object({ id: v.number() }),
     search: v.object({ tab: v.optional(v.string()) }),
   });

   export default function UserPage() {
     const params = route.useParams();
     const search = route.useSearch();
     return <div>User {params().id} - Tab: {search().tab ?? "default"}</div>;
   }
   ```

For complete documentation, see the [SolidJS Guide](./packages/typed-routes-solid/README.md) or the [Core Guide](./packages/typed-routes/README.md).

---

## Monorepo Development

```bash
# Install workspace dependencies
bun install

# Build all packages via Turborepo
bun run build

# Run unit tests
bun run test

# Run TypeScript typechecks & linter
bun run typecheck
bun run lint
```

---

## License

GNU Affero General Public License v3 (`AGPL-3.0-or-later`). See [LICENSE](LICENSE) for details.