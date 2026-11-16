# @skyjt/typed-routes

## 0.9.1

### Patch Changes

- Security Hardening, Request Body DoS Protection, Safe Redirects, and Strict Payload Parsing:

  - **Request Body Size Limits & DoS Protection (`DEFAULT_MAX_BODY_SIZE`, `MiddlewareOptions.maxBodySize`)**: Enforced a default 1 MiB (`1_048_576` bytes) payload ceiling across `Content-Length` headers, bounded stream chunk readers (`readBoundedStreamBytes`, `createBoundedStream`, `readBoundedText`), and `multipart/form-data` uploads, while redacting raw stream error details (`"Failed to read request body stream"`).
  - **Safe Redirect & Navigation Protocol Sanitization (`redirect`, `navigateCrossApp`, `joinBaseAndPath`, `extractRequestPathname`)**: Rejected client-executable URI schemes (`javascript:`, `data:`, `vbscript:`) with `TypeError`, collapsed protocol-relative leading slashes (`//attacker.com` -> `/attacker.com`), and enforced `"noopener,noreferrer"` in `navigateCrossApp` window opens.
  - **Strict JSON Body Validation**: Disabled implicit string-to-primitive fallback coercion (`shouldCoerce = false`) on JSON request bodies and response schemas while preserving form-urlencoded and multipart body coercion.
  - **Prototype Pollution & Malformed URI Guards**: Added `safeDecodeComponent` (`URIError`-safe query decoding returning `Object.create(null)` in `parseFastQueryString`), decoded cookie keys before evaluating `isForbiddenKey` in `parseRequestCookies`, blocked `__proto__`/`constructor`/`prototype` extension keys in `problem()`, and guarded `for...in` iteration in `serializeFastQuery` with `Object.hasOwn`.
  - **OpenAPI Swagger UI XSS Defense**: Escaped single quotes (`&#39;`) in `escapeHtml` and serialized `specUrl` safely inside `<script>` blocks via `JSON.stringify` with `<`, `\u2028`, and `\u2029` escaping.

## 0.9.0

### Minor Changes

- Cross-App Typed Navigation, OpenAPI 3.1 Specification & Interactive UI, and End-to-End Type Safety `[data, error]` Request Client with RFC 9457 Problem Details:

  - **Cross-App Typed Navigation (`createPaths`, `buildCrossAppUrl`, `navigateCrossApp`)**: Added unified 2-argument local (`paths.build(path, options?)`) and 3-argument cross-app (`paths.build(app, path, options?)`) URL building and navigation (`paths.href`, `navigateCrossApp`), automatic `target="_blank"` + `rel="noopener noreferrer"` resolution, and safe base/path joining (`joinBaseAndPath`).
  - **OpenAPI 3.1 Specification, Interactive UI & Dynamic Error Reflection (`generateOpenAPISpec`, `createOpenAPIHandler`, `renderOpenAPIUI`)**: Added zero-dependency Standard Schema V1 / Valibot / Zod to JSON Schema Draft 2020-12 conversion (`schemaToJsonSchema`), runtime `TypedResponse` sample value inference (`inferJsonSchemaFromValue`), automatic reflection of custom `onValidationError` / `onApiError` handlers (`resolveOpenAPIErrorContracts`), and built-in Scalar, Swagger UI, Redoc, Stoplight Elements, and custom UI rendering at `/openapi.json` and `/docs` via `MiddlewareOptions.openapi`.
  - **End-to-End Type Safety `[data, error]` Request Client & RFC 9457 Problem Details (`createClient`, `problem`, `normalizeProblemDetails`)**: Added method-first `createClient<typeof routes>()` returning `Promise<[data, null] | [null, ProblemDetails]>` with automatic path parameter interpolation, query serialization, JSON body encoding, and RFC 9457 Problem Details normalization. Updated `defaultOnValidationError` and `defaultOnApiError` to emit standard `application/problem+json` responses.

### Patch Changes

- Static Page Route Shadowing Fix, Zero-Allocation `TYPED_RESPONSE_BODY` Tagging, and Browser-Safe `presetNode`:

  - **Static Page Route Precedence in `buildMatcherAndMetadata`**: Registered unconfigured UI page routes (`page: true` without `$$route` or HTTP handlers) in `radix3` via shared `UNCONFIGURED_PAGE_REF` and `UNCONFIGURED_PAGE_META` sentinels so static page routes (`/users/new`) are never shadowed by parametric sibling page routes (`/users/:id`).
  - **Zero-Allocation `TYPED_RESPONSE_BODY` Symbol Tagging**: Replaced `Object.defineProperty` descriptor allocations in `json()` with direct `TYPED_RESPONSE_BODY` symbol assignment on `Response` and lazy body parsing in `getTypedResponseMeta`, preserving `18,912 req/sec` middleware throughput.
  - **Browser-Safe `presetNode` Runtime Adapter**: Replaced top-level static `node:querystring` and `node:stream/consumers` imports in `src/adapters/node.ts` with `process.getBuiltinModule` resolution inside `presetNode()` and `/* @__PURE__ */` adapter annotations so browser client bundles contain zero `node:*` imports.

## 0.8.0

### Minor Changes

- Pluggable Runtime Adapter System & Zero-Allocation Response Envelopes:

  - **Pluggable Runtime Adapters (`bun`, `node`, `standard`, custom)**: Isolated runtime-specific C++ APIs and parsing primitives (`headers.toJSON`, `"node:querystring"`, `"node:stream/consumers"`) behind a typed `RuntimeAdapter` interface (`parseQuery`, `readJson`, `readText`, `parseHeaders`). Exported presets `bunAdapter` / `presetBun()`, `nodeAdapter` / `presetNode()`, and `standardAdapter` / `presetStandard()`, alongside the `createRuntimeAdapter` factory and automatic runtime detection `resolveRuntimeAdapter`.
  - **Zero-Allocation Static JSON Response Envelopes**: Pre-allocated and exported `STATIC_JSON_HEADERS` (`content-type: application/json; charset=utf-8`) and `STATIC_JSON_200_INIT` (`status: 200`). Updated `json()` and `toResponse()` to bypass creating fresh options dictionaries and headers on default 200 responses, reusing the static envelope directly with `new Response(JSON.stringify(data), STATIC_JSON_200_INIT)`.
  - **Middleware Adapter Integration**: Added `adapter?: RuntimeAdapter | RuntimeAdapterPreset` to `MiddlewareOptions`. Incoming query strings and request bodies/headers delegate to the resolved adapter while maintaining strict web-standard compatibility and prototype pollution defenses.
  - **Stream Instantiation Optimization in Bun**: Avoided evaluating the `request.body` getter when deserializing payloads via native `request.json()` or `request.text()`, preventing Bun from constructing unwanted JavaScript `ReadableStream` wrappers on the hot request path.

## 0.7.0

### Minor Changes

- Complete Core API Routes Suite ? method-scoped schemas, sync-first async validation, composable middleware with typed context, response & `HttpError` helpers, and end-to-end RPC type inference:
  
  - **Overloaded `route.handler(config, fn)` & Zero-Allocation Fast Path**: Added a 2-argument `route.handler({ body, headers, cookies, search, use, responses }, fn)` overload on `DefinedRoute` while preserving the 1-argument `route.handler(fn)` as a zero-allocation identity return and keeping `DefinedRoute`'s single-slot (`16 B` V8 / `24 B` JSC) memory layout intact.
  - **WeakMap Handler Metadata & Smi Bitflags**: Stored compiled per-method validators and middleware chains inside `apiHandlerMetaMap` (`CompiledAPIHandlerMeta`) with 31-bit Smi bitflags (`HANDLER_FLAG_*`, `ROUTE_FLAG_*`) so handler functions never undergo V8 hidden-class property transitions and unconfigured `GET` routes pay zero parsing overhead.
  - **Content-Type Request Body, Header & Cookie Validation Pipeline**: Added `parseRequestBody` (supporting `application/json`, `application/x-www-form-urlencoded`, `multipart/form-data`, `text/*`, and `ArrayBuffer`, with clean `400 Bad Request` validation errors on malformed JSON), `parseRequestHeaders` (normalized lowercase keys), and single-pass ASCII `parseRequestCookies` with prototype-pollution guards. Widened `RouteValidationTarget` and `RouteValidationError` with `rawBody`, `rawHeaders`, and `rawCookies`.
  - **Sync-First Asynchronous Schema Validation (`compileAsyncValidator` & `validateDataAsync`)**: Added async `StandardSchemaV1` and async function validator support in `createMiddleware` while executing synchronous validators directly without allocating a `Promise` or triggering a microtask tick. Unwrapped `Awaited<O>` in `InferOutput<T>` for async function parsers.
  - **Composable API Middleware (`defineMiddleware` & `use`)**: Added route-level (`defineRoute({ use })`) and handler-level (`route.handler({ use }, fn)`) middleware chains that can short-circuit with a `Response` or return typed context objects merged into `event.context` (`MergeMiddlewareContext`).
  - **Typed Response Helpers & `HttpError` Exception Hierarchy**: Exported `json()`, `text()`, `noContent()`, and `redirect()` returning `TypedResponse<TData, TStatus>`, optional per-status `responses` schema validation, and structured `HttpError` (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessable`, `internal`) with automatic serialization and `MiddlewareOptions.onApiError` customization.
  - **End-to-End Compile-Time RPC Type Inference**: Exported `InferHandlerInput`, `InferHandlerOutput`, `InferHandlerData`, and `RouteMethodHandlerFor` for zero-cost client/server type sharing.

## 0.6.3

### Patch Changes

- Native `Map` FIFO builder cache, single-param URL builder specialization, zero-escape URL scanner fast-path, and validator hardening:
  
  - **Bounded Native `Map` FIFO Builder Cache**: Replaced `LruCache` wrapper and per-hit doubly-linked list pointer mutations in `buildUrl` with a bounded native `Map` (`MAX_BUILDER_CACHE_SIZE = 2048`) using O(1) FIFO eviction (`builderCache.keys().next().value`), achieving `595 ps/iter` (`55.1M ops/sec`) static URL construction and removing internal `LruCache` / `LruNode` exports.
  - **Single-Parameter Builder Specialization & IEEE-754 Numeric Fast-Path**: Added specialized `buildSingleRequiredParamUrl` closure compilation in `compilePathBuilder` and an IEEE-754 finite range check (`val > -1e21 && val < 1e21`) in `encodeFastComponent`, accelerating single-parameter dynamic URL construction to `30.40 ns/iter` (`21.01M ops/sec`) while throwing `RangeError` on non-finite numbers (`NaN`, `Infinity`, `-Infinity`) and percent-encoding `'+'` in scientific notation (`1e21` -> `"1e%2B21"`).
  - **Zero-Escape `parseFastUrl` Sanitization Fast-Path**: Moved protocol-relative (`//`) and native SIMD backslash (`urlStr.indexOf("\\", pathStart)`) checks in `parseFastUrl` directly onto `urlStr` prior to substring consumption, restoring JIT Escape Analysis (`73.45 ns/iter`, `4.15 B/iter`) while preserving full open-redirect and internal backslash neutralization.
  - **Validator & Coercion Hardening**: Updated `isNumericString` to require `Number.isFinite(num)` so `"Infinity"` and `"-Infinity"` are preserved as strings, rejected asynchronous `StandardSchemaV1` Promises with a deterministic validation issue, added `ValidationOutcome.ok` / `ValidationOutcome.fail` static factories, and added lazy error context callback support (`() => ({ rawParams, rawSearch })`) in `evaluateRouteTarget` to avoid allocating context objects on the happy path.
  - **Path Parameter Type Inference & API Cleanup**: Refined `ExtractSegmentsParams`, `RouteParamsFor`, `RouteSearchFor`, `NavigationArgs`, `InferOutput`, and `InferInput` to accurately infer optional `:param?`, `[...catchAll]`, and `[bracket]` segments, and removed unused `SchemaValidationError`.
  - **5-Way Version Benchmark Suite**: Added published `v0.6.2` to `@benchmarks/version-comparison` (`v0.1.1` vs `v0.4.0` vs `v0.6.1` vs `v0.6.2` vs `Current`).

## 0.6.2

### Patch Changes

- Security hardening, bounded LRU builder cache, and memory leak defense:
  
  - **Prototype Pollution Defense**: Sanitized `parseFastQueryString`, `normalizeSearchParams`, and `coerceRecord` to drop malicious prototype pollution keys (`__proto__`, `constructor`, `prototype`), protecting against object property tampering.
  - **Protocol-Relative Open Redirect Sanitization**: Added protocol-relative URL sanitization in `parseFastUrl` that collapses leading double-slashes (`//evil.com` -> `/evil.com`) and neutralizes backslashes (`\`), preventing open redirect bypasses while preserving standard route path structure.
  - **Bounded LRU Route Builder Cache**: Replaced unbounded Map cache in `compilePathBuilder` with a high-throughput, O(1) doubly-linked list `LruCache` capped at `MAX_BUILDER_CACHE_SIZE = 2048` entries to prevent heap exhaustion under high-cardinality dynamic routing patterns.
  - **Cache Management Utilities**: Exported `MAX_BUILDER_CACHE_SIZE`, `clearBuilderCache()`, `getBuilderCacheSize()`, and `LruCache` / `LruNode`.
  - **4-Way Version Benchmark Suite**: Added published `v0.6.1` to `@benchmarks/version-comparison`, establishing a comprehensive 4-way evaluation matrix (`v0.1.1` vs `v0.4.0` vs `v0.6.1` vs `Current`).

## 0.6.1

### Patch Changes

- Streamline middleware request pipeline and engine performance:
  
  - **1.47 µs Middleware Pipeline**: Reduced middleware request dispatch latency from 2.16 µs to 1.47 µs (32% speedup) and cut memory allocation from 293 B to 189 B (35% reduction).
  - **Monomorphic Pre-Compiled Validator Slots**: Pre-compiled params and search validators once on RouteNodeMeta initialization (compiledParamsValidator, compiledSearchValidator), eliminating runtime WeakMap.get lookups on every request.
  - **Active Request Lifecycle Binding**: Passed active incoming Request directly to getScopedEvent, eliminating synthetic fallback new Request() allocations.
  - **Zero-Closure Query Extraction**: Eliminated per-request getRawSearch closure allocation and short-circuited unvalidated routes via integer bitflags (RouteFlags.HasValidation).
  - **Leading-Slash URL Fast-Path**: Added leading-slash ASCII short-circuit (urlStr.charCodeAt(0) === 47) in parseFastUrl to bypass protocol scanning for pathname-only requests.
  - **Zero-Options Path Builder Fast-Path**: Added fast-path in buildUrl when options === undefined, eliminating option object property checks.

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