# TypedRoute Documentation

Welcome to the official documentation for [`@skyjt/typed-routes`](../packages/typed-routes) and [`@skyjt/typed-routes-solid`](../packages/typed-routes-solid).

TypedRoute provides end-to-end compile-time typed routes, Universal Schema validation (`StandardSchemaV1`, Valibot, Zod, ArkType), reactive validation tuples (`[data, error]`), local & cross-app URL path construction (`buildUrl`, `createPaths`), OpenAPI 3.1 specification & interactive UI generation, End-to-End Type Safety `[data, error]` Request Client (`createClient`), RFC 9457 Problem Details, and full-stack request middleware on top of [`filesystem-routing`](https://www.npmjs.com/package/filesystem-routing).

---

## Getting Started

Learn how to install TypedRoute, configure the Vite plugin, and structure your route files.

| Guide | Description |
| :--- | :--- |
| **[Installation](./01-getting-started/01-installation.md)** | Install packages, configure `vite.config.ts`, and enable `file-routes.d.ts` type generation. |
| **[Project Structure](./01-getting-started/02-project-structure.md)** | File-system routing conventions (`(groups)`, `[param]`, `[...catchAll]`) and generated virtual module exports. |

---

## Building Your Application: Routing

Explore how to define route schemas, navigate with compile-time safety across local and external micro-frontends, handle validation errors, and build full-stack API handlers with OpenAPI 3.1.

| Guide | Description |
| :--- | :--- |
| **[Defining Routes](./02-routing/01-defining-routes.md)** | Define pages, layouts, and validated `params` / `search` schemas with automatic primitive coercion. |
| **[Linking and Navigating](./02-routing/02-linking-and-navigating.md)** | Navigate between local and cross-app routes using `<Link>`, `useNavigate()`, `paths.build()`, and `createPaths()`. |
| **[Error Handling](./02-routing/03-error-handling.md)** | Handle URL parameter and search query validation errors with reactive `RouteAccessorTuple` accessors and `<Show>`. |
| **[Route Handlers, OpenAPI 3.1, and Middleware](./02-routing/04-route-handlers-and-middleware.md)** | Build typed API endpoints with `route.handler()`, serve OpenAPI 3.1 docs (`/openapi.json`, `/docs`), emit RFC 9457 Problem Details, and consume APIs with `createClient()`. |

---

## API Reference

Detailed reference specifications for components, file conventions, functions, and configuration options.

### Components

- **[`<Link>`](./03-api-reference/01-components/link.md)** — Type-safe anchor component for local SPA and cross-app navigation (`<Link app="..." to="...">`).

### File-System Conventions

- **[Route File Exports](./03-api-reference/02-file-conventions/route-file-exports.md)** — Special exports recognized in route files (`route`, `default`, `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `QUERY`).

### Functions

- **[`defineRoute`](./03-api-reference/03-functions/define-route.md)** — Declare route schemas, preloading, validation error telemetry, reactive hooks, and typed API handlers.
- **[`createMiddleware`](./03-api-reference/03-functions/create-middleware.md)** — Server fetch middleware for API dispatch, schema validation, OpenAPI 3.1 serving, RFC 9457 Problem Details, and `isPage` error routing.
- **[`createRouter` & `interceptFileRoutes`](./03-api-reference/03-functions/create-router.md)** — Initialize the SolidJS router, configure cross-app targets, and bind validation providers to the route manifest.
- **[`useNavigate`, `createPaths`, `createClient`, `buildUrl`, & `validateData`](./03-api-reference/03-functions/use-navigate-and-paths.md)** — Programmatic local/cross-app navigation, URL serialization, End-to-End Type Safety `[data, error]` Request Client, and Universal Schema validation utilities.

### Configuration

- **[`routes()` Vite Plugin](./03-api-reference/04-configuration/vite-plugin.md)** — Vite plugin configuration for `@skyjt/typed-routes/vite` and `@skyjt/typed-routes-solid/vite`.
