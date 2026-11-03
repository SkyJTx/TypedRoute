# @skyjt/typed-routes-solid

## 0.6.0

### Minor Changes

- Complete Core API Routes Suite integration and overloaded `SolidDefinedRoute.prototype.handler`:
  
  - **Overloaded `route.handler(config, fn)` & Route-Level Header/Cookie/Middleware Support**: Updated `SolidDefinedRoute` and `defineRoute` to support method-scoped `{ body, headers, cookies, search, use, responses }` schemas as well as route-level `headers`, `cookies`, and `use` middleware arrays while preserving `SolidDefinedRoute`'s single-slot memory layout.
  - **Full Re-export of Core API Route Utilities & RPC Types**: Re-exported `HttpError`, `json`, `text`, `noContent`, `redirect`, `defineMiddleware`, `registerAPIHandler`, `getAPIHandlerMeta`, `CompiledAPIHandlerMeta`, `compileAsyncValidator`, `validateDataAsync`, `parseRequestBody`, `parseRequestCookies`, `parseRequestHeaders`, `formatHandlerFlags`, `InferHandlerInput`, `InferHandlerOutput`, `InferHandlerData`, `RouteMethodHandlerFor`, and `TypedResponse` directly from `@skyjt/typed-routes-solid`.

### Patch Changes

- Updated dependencies:
  - `@skyjt/typed-routes@0.7.0`

## 0.5.1

### Patch Changes

- Lazy reactive validation, isolated `params` and `search` signal tracking, and context streamlining:
  
  - **Deferred `{ lazy: true }` Accessor Memos**: Configured `createRouteAccessorTuple` memos with `{ lazy: true }` and a shared `readValidatedData` helper so route validation only executes when a component actively reads `params()` or `search()`.
  - **Reactive Signal Isolation via Lazy `untrack()` Context**: Wrapped cross-target `rawParams` and `rawSearch` error-reporting snapshots in lazy `untrack()` callbacks inside `RouteValidationProvider`, ensuring search query updates never re-trigger `params` validation (and vice versa) and zero snapshot objects are allocated when validation succeeds.
  - **Streamlined Validation Context**: Removed unused `state` and `hash` memos from `RouteValidationProvider` and `RouteValidationContextValue`, and removed the unused `SchemaValidationError` re-export.
  - **Updated dependencies**:
    - `@skyjt/typed-routes@0.6.3`

## 0.5.0

### Minor Changes

- **`RouteAccessorTuple` Reactive Hooks**:
  - Updated `route.useParams()` and `route.useSearch()` to return reactive SolidJS `RouteAccessorTuple<T>` accessors (`const [params, paramsError] = route.useParams()`, `const [search, searchError] = route.useSearch()`), unpacked once at component setup following Solid's `createSignal` convention.
  - Added `createRouteAccessorTuple` and `RouteAccessorTuple<T>` (`readonly [data: Accessor<T | undefined>, error: Accessor<RouteValidationError | undefined>]`), pairing with Solid's `<Show when={params()}>` to promote `validParams` to a non-nullable `Accessor<TParams>` with zero component remounts on sibling navigation.
  - Removed `errorComponent`, `passThroughError`, `RouteValidationErrorProps`, and `route.useError()`. UI components handle validation errors directly in standard component render flow via `<Show>` or accessor checks.
  - Removed `InterceptRoutesOptions` and `defaultErrorComponent` from `interceptFileRoutes`.
  - Updated `interceptFileRoutes` and route preloading to pass discriminated `RouteValidationTuple` values to route `preload` functions.

### Patch Changes

- Updated dependencies
  - @skyjt/typed-routes@0.6.0

## 0.4.0

### Minor Changes

- **Prototype-Shared `SolidDefinedRoute` Memory Layout**:
  - Replaced the 6-property object literal and 5 per-route closures (`useParams`, `useSearch`, `useError`, `useLocation`, `handler`) in `defineRoute` with the monomorphic prototype-shared `SolidDefinedRoute` class holding a single in-object `config` slot.
  - Replaced anonymous component and preload wrappers in `interceptFileRoutes` with named functions (`BoundRouteValidationComponent`, `preloadValidatedRoute`, `resolveLazyRouteComponent`) for clear SSR and DevTools stack traces.
  - Re-exported core diagnostic and inspection utilities (`inspectRoute`, `inspectPathBuilder`, `formatRouteFlags`, `describeValidator`, `compileValidator`, `ValidationOutcome`, `PathSegment`, `ParsedUrl`, `RouteNodeMeta`, `EMPTY_RECORD`).

### Patch Changes

- Updated dependencies
  - @skyjt/typed-routes@0.5.0
## 0.3.0

### Minor Changes

- **Built-in Route Validation Error Boundary & Non-Nullable Accessors**:
  - Added `errorComponent` and `passThroughError` options to `defineRoute()`, plus `defaultErrorComponent` to `interceptFileRoutes(entries, options)`.
  - Updated `RouteValidationProvider` to short-circuit mounting `props.children` when parameter or search validation fails and render `errorComponent` / `defaultErrorComponent` with `{ error, rawParams, rawSearch }`.
  - Tightened `route.useParams()` (`Accessor<TParams>`) and `route.useSearch()` (`Accessor<TSearch>`) to non-nullable accessors so route components can read `params().id` and `search().q` directly without optional chaining or `<Show>` guards.
  - Added `route.useError()` and `route.handler()` to `DefinedRouteObject`.
  - Re-exported `RouteSectionProps`, `Location`, `RouteDefinition`, `TypedAPIEvent`, and `TypedAPIHandler` from `@skyjt/typed-routes-solid`.
  - Added lazy `$$route` config resolution in `interceptFileRoutes` for circular SSR module graphs.

### Patch Changes

- Updated dependencies
  - @skyjt/typed-routes@0.4.0

## 0.2.0

### Minor Changes

- **Bundler Migration**: Migrated from `tsup` to `tsdown` powered by Rolldown and `rolldown-plugin-dts` for high-performance library bundling.
  - **Peer Dependency Updates**: Upgraded `filesystem-routing` peer and dev dependencies to `^0.4.0`.
  - **Validation Engine**: Upgraded `zod` dev dependency to `^4.6.7` with zero breaking changes, leveraging native Standard Schema V1 (`~standard`) execution in `validator-adapter.ts`.
  - **Linter & Tooling**: Upgraded `oxlint` to `^1.89.0` and pinned `typescript` at `^5.9.3` for maximum consumer compatibility.
  - **Solid Adapter Testing**: Upgraded `@testing-library/jest-dom` to `^7.0.1`, `jsdom` to `^30.1.3`, and added `@testing-library/dom` `^10.4.0` peer dependency.

### Patch Changes

- Updated dependencies
  - @skyjt/typed-routes@0.3.0

## 0.1.4

### Patch Changes

- Relicense package under Mozilla Public License 2.0 (MPL-2.0).
- Updated dependencies
  - @skyjt/typed-routes@0.2.1

## 0.1.3

### Patch Changes

- Updated dependencies
  - @skyjt/typed-routes@0.2.0

## 0.1.2

### Patch Changes

- Use caret range `workspace:^` for `@skyjt/typed-routes` dependency so published packages require `^0.1.1`, allowing downstream consumers to automatically resolve the Solid 2.0 SSR middleware fix.

## 0.1.1

### Patch Changes

- Fix Solid 2.0 SSR runtime exceptions in `createMiddleware`:
  - Support Solid `RequestEvent` ({ request: Request, locals, response }) as middleware input alongside Fetch `Request`, resolving `HTTPError: Invalid URL` caused by `event.url` being undefined.
  - Invoke `next()` with zero arguments during fallthrough to adhere to `@solidjs/vite-plugin` middleware argument enforcement.
  - Export `MiddlewareInput` and `MiddlewareNext` types.
- Updated dependencies
  - @skyjt/typed-routes@0.1.1

## 0.1.0

### Minor Changes

- Initial release: SolidJS and `@solidjs/router` adapter for `@skyjt/typed-routes` featuring reactive routing hooks, typed `Link` component, and navigation guards.