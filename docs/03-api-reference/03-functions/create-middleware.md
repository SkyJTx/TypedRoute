# `createMiddleware`

`createMiddleware` creates a standard Fetch middleware function that matches incoming HTTP requests against the `virtual:file-routes` manifest, validates `params` and `search` schemas defined via `defineRoute`, dispatches API handlers, and coordinates SSR validation error handling for UI pages.

```ts
// src/middleware.ts
import routes from "virtual:file-routes";
import { createMiddleware } from "@skyjt/typed-routes-solid";

export const apiMiddleware = createMiddleware(routes, {
  base: "/",
  onValidationError({ error, rawParams, rawSearch, isPage }) {
    if (isPage) {
      return;
    }
    return Response.json(
      {
        error: "Route Validation Error",
        target: error.target,
        issues: error.issues,
        received: { params: rawParams, search: rawSearch },
      },
      { status: 400 },
    );
  },
});

export default apiMiddleware;
```

---

## Reference

### Signature

```ts
function createMiddleware(
  routes: readonly MiddlewareRouteEntry[],
  options?: MiddlewareOptions,
): (eventOrRequest: MiddlewareInput, next: MiddlewareNext) => Promise<Response>;
```

### Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `routes` | `readonly MiddlewareRouteEntry[]` | **Required** | The flat route manifest array exported as the default export of `"virtual:file-routes"`. |
| `options` | `MiddlewareOptions` | `{}` | Optional configuration for path stripping, request event resolution, and validation error handling. |
| `options.base` | `string` | `"/"` | Base URL path prefix stripped from incoming request pathnames prior to route matching. |
| `options.getEvent` | `() => APIEvent` | Solid `RequestContext` store | Custom supplier for the server request event when `createMiddleware` is invoked with a bare `Request` instead of a framework event object. |
| `options.onValidationError` | `(args: OnValidationErrorArgs) => Response \| Promise<Response \| void> \| void` | `undefined` | Hook invoked when `params` or `search` validation fails. Returning a `Response` short-circuits the request chain with that response. |

#### `onValidationError` Arguments

| Property | Type | Description |
| :--- | :--- | :--- |
| `error` | `RouteValidationError` | The validation error instance containing `target` (`"params" \| "search"`), `issues`, `rawParams`, and `rawSearch`. |
| `rawParams` | `Record<string, string \| undefined>` | Raw uncoerced path parameters extracted from the URL pathname. |
| `rawSearch` | `Record<string, unknown>` | Raw parsed query string parameters extracted from the URL search string. |
| `request` | `Request` | The incoming Fetch `Request` instance. |
| `isPage` | `boolean` | `true` when the matched route is a UI page (`route.page === true`) accessed via `GET` or `HEAD`; `false` for API endpoints or non-`GET`/`HEAD` requests. |

---

### Returns

`createMiddleware` returns an async middleware function `(eventOrRequest: MiddlewareInput, next: MiddlewareNext) => Promise<Response>`:

- **`eventOrRequest`**: Accepts either a standard Fetch `Request` (Hono, Bun, Cloudflare Workers, Node) or a Solid Start `RequestEvent` (`{ request: Request, locals, response }`).
- **`next`**: Fallback callback `() => Response | Promise<Response>`. Always invoked with **zero arguments** (`next()`) for compatibility with `@solidjs/vite-plugin` (`start.middleware`).

> **Good to know**:
> - **How `isPage` is calculated**: Internally, `createMiddleware` builds a `WeakMap<APIHandlerRef, MatchedRouteMetadata>` (`buildMatcherAndMetadata`) during initialization. For each matched route, `isPage` is computed deterministically as:
>   $$\text{isPage} = (\text{route.page} === \text{true}) \land (\text{request.method} \in \{\text{"GET"}, \text{"HEAD"}\})$$
>   Unlike `filesystem-routing/api`'s internal `createAPIMatcher` (which checks `route.page === true && route.$component !== undefined` and only indexes routes with HTTP handlers), `createMiddleware` tracks `MatchedRouteMetadata` directly without mutating `$component` or executing synthetic handler functions.
> - **When `isPage` is `true` on validation failure**: If `options.onValidationError` is omitted or returns `void`/`undefined`, `createMiddleware` attaches `event.validationError = error` onto the request event and calls `return next()` so Solid SSR proceeds to render the UI page with validation error tuples (`[undefined, error]`). If `options.onValidationError` returns a `Response` (for example, `Response.redirect(...)`), that response is returned immediately.
> - **When `isPage` is `false` on validation failure**: If `options.onValidationError` returns `void`/`undefined`, `createMiddleware` automatically returns a `400 Bad Request` JSON response (`{ error: "Validation Failed", target, issues }`).

---

## Examples

### Composing with Hono (`app.use`)

```ts
// server/index.ts
import { Hono } from "hono";
import { apiMiddleware } from "~/middleware";

const app = new Hono();

app.use("*", async (c, next) => {
  let fellThrough = false;
  const response = await apiMiddleware(c.req.raw, async () => {
    fellThrough = true;
    await next();
    return c.res;
  });
  if (!fellThrough) {
    return response;
  }
});
```

### Redirecting Invalid UI Page Requests in Middleware

```ts
import routes from "virtual:file-routes";
import { createMiddleware } from "@skyjt/typed-routes-solid";

export default createMiddleware(routes, {
  onValidationError({ error, request, isPage }) {
    if (isPage && error.target === "params") {
      return Response.redirect(new URL("/404", request.url), 302);
    }
  },
});
```

---

## Version History

| Version | Changes |
| :--- | :--- |
| `v0.6.1` | Streamlined middleware request pipeline to 1.47 µs (32% latency reduction, 35% heap reduction), monomorphic pre-compiled route validator caching on `RouteNodeMeta`, direct active `Request` reuse in `getScopedEvent`, and leading-slash ASCII short-circuit in `parseFastUrl`. |
| `v0.4.0` | Accepted `virtual:file-routes` without casts (`MiddlewareRouteEntry`), added deterministic `isPage` calculation via `MatchedRouteMetadata`, and enabled UI page validation fallthrough to SSR. |
| `v0.2.0` | Added zero-allocation ASCII URL scanner (`parseFastUrl`). |
| `v0.1.1` | Added support for Solid 2.0 `RequestEvent` objects and zero-argument `next()` invocation. |
| `v0.1.0` | Initial release of `createMiddleware`. |