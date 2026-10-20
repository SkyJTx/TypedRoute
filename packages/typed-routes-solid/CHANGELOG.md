# @skyjt/typed-routes-solid

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
