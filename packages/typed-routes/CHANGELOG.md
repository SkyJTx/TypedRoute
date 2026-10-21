# @skyjt/typed-routes

## 0.4.0

### Minor Changes

- **Zero-Cast Middleware & Route Handlers**:
  - Updated `createMiddleware` to natively accept `"virtual:file-routes"` arrays (`readonly MiddlewareRouteEntry[]`) without `as unknown as readonly FileRouteHandlers[]` casts.
  - Added `route.handler(fn)` on `defineRoute` and exported `TypedAPIEvent<TParams, TSearch>` / `TypedAPIHandler<TParams, TSearch>` for end-to-end typed API handlers with zero `filesystem-routing/api` imports or type assertions.
- **UI Page Validation & `onValidationError` Support**:
  - Normalized UI page routes (`page: true`) carrying `$$route` schemas in `createMiddleware` with isolated per-route handler references to prevent `WeakMap` collisions.
  - Added `isPage: boolean` to `MiddlewareOptions.onValidationError`. When `isPage: true` and `onValidationError` returns `void`, `createMiddleware` attaches `event.validationError` and calls `next()` with zero arguments so SSR can render the route's `errorComponent`.
  - Extended `RouteValidationError` with `rawParams` and `rawSearch` context.
- **Strict Path & Search Type Inference**:
  - Fixed `ExtractPathParams`, `RouteParamsFor`, and `RouteSearchFor` so routes without explicit `params` or `search` schemas infer path parameters from the URL template and allow optional search queries without `as never` casts.
- **Circular SSR Import Resolution in Vite Plugin**:
  - Split `virtual:file-routes` into a zero-dependency leaf manifest module (`virtual:file-routes-manifest:*`) and route-data binder so `routes` and `pageRoutes` are always initialized before route modules that import `<Link>` or router helpers evaluate in SSR.

## 0.3.0

### Minor Changes

- **Bundler Migration**: Migrated from `tsup` to `tsdown` powered by Rolldown and `rolldown-plugin-dts` for high-performance library bundling.
  - **Peer Dependency Updates**: Upgraded `filesystem-routing` peer and dev dependencies to `^0.4.0`.
  - **Validation Engine**: Upgraded `zod` dev dependency to `^4.6.7` with zero breaking changes, leveraging native Standard Schema V1 (`~standard`) execution in `validator-adapter.ts`.
  - **Linter & Tooling**: Upgraded `oxlint` to `^1.89.0` and pinned `typescript` at `^5.9.3` for maximum consumer compatibility.
  - **Solid Adapter Testing**: Upgraded `@testing-library/jest-dom` to `^7.0.1`, `jsdom` to `^30.1.3`, and added `@testing-library/dom` `^10.4.0` peer dependency.

## 0.2.1

### Patch Changes

- Relicense package under Mozilla Public License 2.0 (MPL-2.0).

## 0.2.0

### Minor Changes

- High-performance engine optimization and zero-allocation routing:
  - **Precompiled Path Builders**: Tokenizes route templates into static fragments and parameter index tuples at compile time, achieving 104x faster static route construction (`buildUrl`).
  - **Zero-Allocation Query Serializer**: Direct string buffer serialization bypassing `URLSearchParams` memory overhead.
  - **Fast-Path Query String Parser**: Inlined ASCII scanning skipping `decodeURIComponent` on plain unencoded tokens for 2.6x faster query normalization.
  - **Pure-JS ASCII URL Scanner**: Scans scheme, host, pathname, search, and hash delimiters using pure integer offsets (`parseFastUrl`), bypassing native C++ `new URL()` host allocations.
  - **Public API Export**: Exported `parseFastUrl` from root @skyjt/typed-routes for high-throughput server middlewares.

## 0.1.1

### Patch Changes

- Fix Solid 2.0 SSR runtime exceptions in `createMiddleware`:
  - Support Solid `RequestEvent` ({ request: Request, locals, response }) as middleware input alongside Fetch `Request`, resolving `HTTPError: Invalid URL` caused by `event.url` being undefined.
  - Invoke `next()` with zero arguments during fallthrough to adhere to `@solidjs/vite-plugin` middleware argument enforcement.
  - Export `MiddlewareInput` and `MiddlewareNext` types.

## 0.1.0

### Minor Changes

- Initial release: Framework-agnostic compile-time typed routes, Standard Schema V1 validation, URL builder, and API middleware for filesystem-routing.