# TypedRoute Solid 2.0 RC Full-Stack Example

Full-stack reference application demonstrating [`@skyjt/typed-routes-solid`](../../packages/typed-routes-solid) and [`@skyjt/typed-routes`](../../packages/typed-routes) running on Solid 2.0 RC, `@solidjs/router`, Valibot (Standard Schema V1), and Hono.

## Key Capabilities Demonstrated

- **Validated UI Page Routes (`defineRoute` + `RouteAccessorTuple`)**:
  - `/users/`: Search query validation (`q`, `role`) with reactive `route.useSearch()` and graceful invalid-filter fallback UI.
  - `/users/:id`: Numeric path parameter coercion (`v.number()`) with `route.useParams()` and invalid-ID fallback UI.
  - `/users/new`: Static sibling route coexisting cleanly alongside parametric `/users/:id`.
- **Typed API Route Handlers & OpenAPI 3.1**:
  - `GET /api/health`, `GET /api/users`, `POST /api/users`, `GET /api/users/:id`, and `DELETE /api/users/:id` with `openapi` operation metadata and `json()` / `HttpError` helpers.
  - Automatic **OpenAPI 3.1.0** specification at `GET /openapi.json` and interactive **Scalar API Reference UI** at `GET /docs`.
  - Default **RFC 9457 Problem Details** (`application/problem+json`) error responses for validation and API errors.
- **End-to-End Type Safety `[data, error]` Request Client**:
  - `src/services/api-client.ts` uses `createClient<typeof routes>()` for compile-time checked `apiClient.get`, `apiClient.post`, and `apiClient.delete` calls returning `[data, error]` tuples.

## Commands

```bash
# Start Vite SSR development server on http://localhost:3000
bun run dev

# Build client and SSR server bundles for production
bun run build

# Run the standalone Hono production server
bun run server

# Run integration tests (API middleware, UI SSR, and OpenAPI 3.1 verification)
bun run test
```
