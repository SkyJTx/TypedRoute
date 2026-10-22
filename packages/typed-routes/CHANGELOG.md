# @skyjt/typed-routes

## 0.6.0

### Minor Changes

- **`RouteValidationTuple<T>` (`[data, error]`) API**:
  - Replaced throwing validation errors and component-level error boundary mechanics with the discriminated tuple pattern `RouteValidationTuple<T>` (`[data, error]`), where checking `if (error)` narrows `error` to `RouteValidationError` and `data` to `undefined`, while promoting `data` to `T` in the non-error branch.
  - Exported `evaluateRouteTarget(target, schema, rawInput, context, onError?)` for validating route targets (`params`, `search`, `state`, `hash`), dispatching telemetry side-effects, and returning `RouteValidationTuple<T>`.
  - Updated `RouteConfig.preload` signature to accept discriminated tuples: `preload({ params: [params, paramsErr], search: [search, searchErr], location })`.
  - Retained `onError` in `defineRoute` strictly for telemetry, logging, and error-reporting side effects.

## 0.5.0

### Minor Changes

- **V8 / JavaScriptCore / SpiderMonkey Memory Layout Optimizations**:
  - Replaced per-route object literal and closure allocations in `defineRoute` with the monomorphic prototype-shared `DefinedRoute` class (`16 bytes` in V8 pointer-compressed / `24–34 bytes` in JavaScriptCore, achieving sub-kilobyte route footprints).
  - Replaced polymorphic path segment unions with the monomorphic `PathSegment` class (`kind`, `text`, `optional`) and moved slash collapsing to compile time (`tokenizePattern`), achieving **3.07x faster** single-param URL building (`13.33x` vs `v0.1.1`) and **2.40x faster** complex URL building (`4.17x` vs `v0.1.1`) compared to `v0.4.0`.
  - Added an RFC 3986 unreserved ASCII fast path (`isSimpleUriToken` / `encodeFastComponent`) to skip C++ `encodeURIComponent` calls for common alphanumeric keys and numeric IDs.
  - Added monomorphic `ValidationOutcome<T>` and WeakMap-cached `compileValidator<T>` in `validator-adapter.ts` so validator classification (`StandardSchemaV1`, `Zod`, `Function`) runs once per schema lifetime.
- **Modular Middleware Architecture & Sucrose Lazy Evaluation**:
  - Decomposed `src/middleware/` into single-responsibility modules: `url-scanner.ts` (`ParsedUrl`, `parseFastUrl`), `route-meta.ts` (`RouteNodeMeta` with 31-bit `Smi` bitflags), `route-matcher.ts` (`toRadixPath`, `toApiHandlerRef`, `buildMatcherAndMetadata`), and `middleware.ts` (`typedRoutesMiddleware`).
  - Fixed per-request handler extraction overhead in `toApiHandlerRef` by memoizing `extractHandlersFromModule` once per route lifetime and binding exported handlers directly without wrapper closures.
  - Applied Sucrose-style lazy query parsing in `createMiddleware` to skip `parseFastQueryString` when `searchStr` is empty or unused on validation-only UI pages, reusing frozen `EMPTY_RECORD` singletons.
- **Human-Readable Diagnostics & Custom Inspection**:
  - Exported `inspectRoute`, `inspectPathBuilder`, `formatRouteFlags`, `describeValidator`, and `CUSTOM_INSPECT_SYMBOL` (`Symbol.for("nodejs.util.inspect.custom")`) for human-readable runtime debugging and clean stack traces.

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