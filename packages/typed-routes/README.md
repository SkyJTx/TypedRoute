# `@skyjt/typed-routes`

> Framework-agnostic compile-time typed routes, Universal Schema validation (`StandardSchemaV1`, Zod, custom parsers), URL path building, and API request middleware for [`filesystem-routing`](https://www.npmjs.com/package/filesystem-routing).

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE)

---

## Features

- **Compile-Time Route Manifest Inference**: Extracts literal route paths, path parameters (`:id`, `:id?`, `*slug`, `[id]`, `[...slug]`), and schema types directly from `filesystem-routing` manifest tuples without runtime overhead.
- **Universal Schema Validation**: Works out of the box with any [Standard Schema V1](https://github.com/standard-schema/standard-schema) library (Valibot, Zod 3.24+, ArkType), legacy Zod (`safeParse`), or plain custom parser functions.
- **Automatic Primitive Coercion**: Automatically coerces string URL inputs (`"42"` -> `42`, `"true"` -> `true`) when running schema validation.
- **URL Path Builder**: `buildUrl` safely substitutes path parameters, normalizes duplicate search queries into arrays, and formats hashes.
- **API Request Middleware**: `createMiddleware` matches HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `QUERY`), enforces schema validation on request `params` and query `search`, and returns 400 Bad Request on failure.
- **Vite Plugin**: `@skyjt/typed-routes/vite` integrates `filesystem-routing/vite` with full HTTP method scanning and cross-platform POSIX path normalization.

---

## Installation

```bash
# Using Bun
bun add @skyjt/typed-routes filesystem-routing

# Using pnpm
pnpm add @skyjt/typed-routes filesystem-routing

# Using npm
npm install @skyjt/typed-routes filesystem-routing
```

If you are using SolidJS, install the framework adapter [`@skyjt/typed-routes-solid`](../typed-routes-solid) instead.

---

## Usage Guide

### 1. Vite Plugin Setup (`vite.config.ts`)

Configure `filesystem-routing` in your Vite configuration using `@skyjt/typed-routes/vite`:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { routes } from "@skyjt/typed-routes/vite";

export default defineConfig({
  plugins: [
    routes({
      dir: "src/routes",
      httpMethods: true, // Enables GET, POST, PUT, DELETE, PATCH, OPTIONS, QUERY, HEAD
      codeSplitting: true,
    }),
  ],
});
```

---

### 2. Universal Schema Validation & Coercion

Validate parameters or search query objects with automatic string-to-primitive coercion:

```ts
import * as v from "valibot";
import { validateData } from "@skyjt/typed-routes";

const userSchema = v.object({
  id: v.number(),
  active: v.boolean(),
  tags: v.optional(v.array(v.string())),
});

// String inputs from URLs are automatically coerced to numbers/booleans
const result = validateData(userSchema, {
  id: "101",
  active: "true",
  tags: ["admin", "staff"],
});

if (result.success) {
  console.log(result.data); // { id: 101, active: true, tags: ["admin", "staff"] }
} else {
  console.error(result.issues);
}
```

---

### 3. URL Path Building (`buildUrl`)

Construct URLs with path parameters, search queries (including arrays), and hashes:

```ts
import { buildUrl } from "@skyjt/typed-routes";

const url = buildUrl("/users/:id/posts", {
  params: { id: 42 },
  search: {
    sort: "desc",
    filter: ["drafts", "archived"],
  },
  hash: "comments",
});

console.log(url);
// Output: /users/42/posts?sort=desc&filter=drafts&filter=archived#comments
```

---

### 4. API Request Middleware (`createMiddleware`)

Connect your file-based API route handlers to standard `Request`/`Response` servers (Node, Bun, Cloudflare Workers, Nitro, Elysia, Express):

```ts
import routes from "virtual:file-routes";
import { createMiddleware } from "@skyjt/typed-routes";

export const apiMiddleware = createMiddleware(routes, {
  base: "/api",
  onValidationError({ error, rawParams, rawSearch, request }) {
    // Custom error formatting
    return Response.json(
      {
        status: "error",
        target: error.target,
        issues: error.issues,
      },
      { status: 422 },
    );
  },
});

// Example fetch handler
export default {
  async fetch(request: Request) {
    return apiMiddleware(request, async (req) => {
      return new Response("Not Found", { status: 404 });
    });
  },
};
```

---

## Framework Adapters

- **SolidJS**: [`@skyjt/typed-routes-solid`](../typed-routes-solid)

---

## License

GNU Affero General Public License v3 (`AGPL-3.0-or-later`). See [LICENSE](LICENSE) for details.