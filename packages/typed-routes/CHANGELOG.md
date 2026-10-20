# @skyjt/typed-routes

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
