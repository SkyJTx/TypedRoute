# @skyjt/typed-routes-solid

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