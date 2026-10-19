# `@skyjt/typed-routes-solid`

> SolidJS and `@solidjs/router` adapter for [`@skyjt/typed-routes`](../typed-routes), providing end-to-end compile-time typed routing, reactive parameter validation, preloading, API request middleware, and safe navigation powered by [`filesystem-routing`](https://www.npmjs.com/package/filesystem-routing).

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)

---

## Features

- **Unified Developer Experience**: Re-exports all core schema validation tools (`validateData`), path builders (`buildUrl`), and API middleware (`createMiddleware`) alongside Solid-specific primitives.
- **Compile-Time Route Inference**: Automatically extracts literal route paths and parameter types from the route manifest.
- **Universal Schema Validation**: Validates route `params`, query `search`, location `state`, and `hash` with [Standard Schema V1](https://github.com/standard-schema/standard-schema) (Valibot, ArkType), Zod, or custom parser functions.
- **Fine-Grained Reactive Accessors**: Exposes reactive SolidJS `Accessor<T>` signals (`useParams()`, `useSearch()`) that update in-place without component remounts or state teardown.
- **Type-Safe Navigation**: `<Link>` and `useNavigate()` prevent typos in route paths and enforce required path parameters and search queries at compile time.
- **Full-Stack API Middleware**: `createMiddleware` validates API endpoints before delegating to backend request handlers.
- **Vite Integration**: `@skyjt/typed-routes-solid/vite` integrates `filesystem-routing/vite` with Solid SSR deduplication and POSIX path normalization.

---

## Installation

Install `@skyjt/typed-routes-solid` alongside `filesystem-routing` and SolidJS dependencies:

```bash
# Using Bun
bun add @skyjt/typed-routes-solid filesystem-routing solid-js @solidjs/router @solidjs/web

# Using pnpm
pnpm add @skyjt/typed-routes-solid filesystem-routing solid-js @solidjs/router @solidjs/web

# Using npm
npm install @skyjt/typed-routes-solid filesystem-routing solid-js @solidjs/router @solidjs/web
```

Optionally install your preferred schema validation library:

```bash
bun add valibot
# or: bun add zod
```

---

## Setup Guide

### 1. Configure Vite (`vite.config.ts`)

```ts
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import { routes } from "@skyjt/typed-routes-solid/vite";

export default defineConfig({
  plugins: [
    solid({
      start: {
        middleware: "src/middleware.ts",
      },
      ssr: true,
      extensions: [".jsx", ".tsx"],
    }),
    routes({
      codeSplitting: true,
    }),
  ],
});
```

> **Note**: On startup, `filesystem-routing` generates `file-routes.d.ts` at the root of the project containing typed manifest tuples (`pageRoutes` and `routes`) corresponding to your route files.

---

### 2. TypeScript Configuration (`tsconfig.json`)

Include `"file-routes.d.ts"` in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "jsxImportSource": "@solidjs/web",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "file-routes.d.ts"]
}
```

---

### 3. Route File Conventions

Place page components and API endpoints inside `src/routes/`:

```
src/
├── routes/
│   ├── (main).tsx              # Layout component for "(main)" route group
│   ├── (main)/
│   │   ├── index.tsx           # /
│   │   └── user/
│   │       └── [id].tsx        # /user/:id
│   ├── api/
│   │   └── [...slug].ts        # /api/*
│   └── [...404].tsx            # /*404
├── router.ts                   # Router instance initialization
├── middleware.ts               # Server fetch middleware
├── app.tsx                     # Root component mounting <Router>
└── index.tsx                   # Client entry point
```

---

### 4. Router Initialization (`src/router.ts`)

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

---

### 5. Application Root (`src/app.tsx`)

```tsx
import { Errored, Loading, type ParentProps } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Router } from "~/router";

export default function App(): JSX.Element {
  return (
    <Router>
      {(props: ParentProps) => (
        <Errored fallback={(error) => <div>An error occurred: {String(error())}</div>}>
          <Loading fallback={<div>Loading page...</div>}>
            {props.children}
          </Loading>
        </Errored>
      )}
    </Router>
  );
}
```

---

### 6. Defining Typed Routes (`src/routes/(main)/user/[id].tsx`)

```tsx
import * as v from "valibot";
import { defineRoute, validateData, type InferOutput } from "@skyjt/typed-routes-solid";
import { query } from "@solidjs/router";
import { createMemo, Errored, Loading } from "solid-js";

const loadUserData = query(async (id: number) => {
  "use server";
  const res = await fetch(`https://api.example.com/users/${id}`);
  if (!res.ok) throw new Error("Failed to fetch user");
  const data = await res.json();

  const userSchema = v.object({
    id: v.pipe(v.number(), v.minValue(1)),
    name: v.string(),
  });

  const validated = validateData(userSchema, data);
  if (!validated.success) throw new Error("Invalid user payload");
  return validated.data;
}, "user-data-query");

export const route = defineRoute({
  params: v.object({
    id: v.number(),
  }),
  preload: async ({ params }) => {
    return loadUserData(params.id);
  },
});

export default function UserRoute() {
  const params = route.useParams();
  const userData = createMemo(() => loadUserData(params().id));

  return (
    <Errored fallback={<p>Error loading user.</p>}>
      <Loading fallback={<p>Loading user data...</p>}>
        <div>
          <h1>User ID: {params().id}</h1>
          <p>Name: {userData().name}</p>
        </div>
      </Loading>
    </Errored>
  );
}
```

---

### 7. Type-Safe Navigation (`<Link>` & `useNavigate`)

```tsx
import { Link, useNavigate, paths } from "../router";

export function Navigation() {
  const navigate = useNavigate();

  return (
    <nav class="flex gap-4">
      <Link to="/">Home</Link>

      <Link
        to="/user/:id"
        params={{ id: 42 }}
        class="text-blue-600 underline"
      >
        User Profile
      </Link>

      <button
        onClick={() => {
          navigate("/user/:id", {
            params: { id: 99 },
          });
        }}
      >
        Go to User 99
      </button>

      <a href={paths.build("/user/:id", { params: { id: 100 } })}>
        External Link
      </a>
    </nav>
  );
}
```

---

## Server API Routes with `createMiddleware`

### 1. Middleware Pipeline (`src/middleware.ts`)

```ts
import routes from "virtual:file-routes";
import { createMiddleware } from "@skyjt/typed-routes-solid";

export default [
  createMiddleware(routes),
];
```

### 2. API Server (`src/server/index.ts`)

```ts
import Elysia from "elysia";

const app = new Elysia({ prefix: "/api" })
  .get("/", () => ({ message: "API Service" }))
  .get("/ping", ({ request }) => ({
    status: "active",
    timestamp: Date.now(),
    url: request.url,
  }));

export default app;
export type AppType = typeof app;
```

### 3. API Catch-All Route (`src/routes/api/[...slug].ts`)

```ts
import type { APIEvent } from "filesystem-routing/api";
import app from "~/server";

async function handleRequest(event: APIEvent): Promise<Response> {
  return app.fetch(event.request, event);
}

export const GET = handleRequest;
export const QUERY = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const HEAD = handleRequest;
export const OPTIONS = handleRequest;
```

---

## License

GNU Affero General Public License v3 (`AGPL-3.0-or-later`). See [LICENSE](LICENSE) for details.