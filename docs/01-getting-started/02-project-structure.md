# Project Structure

TypedRoute builds on [`filesystem-routing`](https://www.npmjs.com/package/filesystem-routing) conventions to map files in `src/routes/` to both UI page components and HTTP API handlers.

---

## Directory Hierarchy

```text
src/
├── routes/
│   ├── (main).tsx              # Layout for the "(main)" route group
│   ├── (main)/
│   │   ├── index.tsx           # UI Page: /
│   │   └── users/
│   │       ├── index.tsx       # UI Page: /users/
│   │       ├── [id].tsx        # UI Page: /users/:id
│   │       └── new.tsx         # UI Page: /users/new
│   ├── api/
│   │   ├── health.ts           # API Endpoint: /api/health
│   │   └── users/
│   │       ├── index.ts        # API Endpoint: /api/users/
│   │       └── [id].ts         # API Endpoint: /api/users/:id
│   └── [...404].tsx            # Catch-all UI Page: /*404
├── router.ts                   # Client & SSR router instance
├── middleware.ts               # Server request validation & API dispatch middleware
├── App.tsx                     # Root application component
└── Document.tsx                # HTML document shell (Solid 2.0)
```

---

## Path Segment Conventions

| File / Folder Pattern | Extracted Route Path | Description |
| :--- | :--- | :--- |
| `src/routes/index.tsx` | `/` | Root index route. |
| `src/routes/about.tsx` | `/about` | Static path segment. |
| `src/routes/(main).tsx` | `/` (layout wrapper) | Route group layout. Stripped from the URL path in `pageRoutes`. |
| `src/routes/(main)/users/index.tsx` | `/users/` | Nested index route inside a route group. |
| `src/routes/users/[id].tsx` | `/users/:id` | Dynamic path parameter (`params.id`). |
| `src/routes/docs/[...slug].tsx` | `/docs/*slug` | Catch-all wildcard segment (`params.slug`). |

---

## Generated Virtual Module (`virtual:file-routes`)

At build and dev time, `virtual:file-routes` exposes two views of your route files:

| Export | Type | Consumer | Description |
| :--- | :--- | :--- | :--- |
| `default` (`routes`) | Flat `readonly MiddlewareRouteEntry[]` tuple | `createMiddleware(routes)` | Contains every route file in scan order, including both UI pages (`page: true`) and API endpoints (`page: false`). |
| `pageRoutes` | Nested `readonly FileRouteTreeEntry[]` tuple | `interceptFileRoutes(pageRoutes)` | Contains only UI page routes (`page: true`), nested under layout routes with `(group)` segments stripped. |

> **Good to know**: `@skyjt/typed-routes/vite` automatically splits `virtual:file-routes` into a zero-dependency leaf manifest module (`virtual:file-routes-manifest:<env>`) and a route-data binder. This guarantees `routes` and `pageRoutes` are initialized before any route file's top-level imports (such as `import { Link } from "~/router"`) execute during SSR.

---

## Next Steps

Now that your project structure is configured, continue to **[Defining Routes](../02-routing/01-defining-routes.md)** to learn how to declare typed path parameters, query search schemas, and automatic type coercions.
