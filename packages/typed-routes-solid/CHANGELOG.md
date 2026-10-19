# @skyjt/typed-routes-solid

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
