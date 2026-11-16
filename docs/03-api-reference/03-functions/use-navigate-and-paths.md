# `useNavigate`, `createPaths`, `createClient`, `buildUrl`, and `validateData`

Core navigation, URL serialization, and Universal Schema validation utilities exported by `@skyjt/typed-routes` and `@skyjt/typed-routes-solid`.

---

## `useNavigate()`

Returns a type-safe navigation function bound to your route manifest.

```tsx
import { useNavigate } from "~/router";

export function QuickJumpButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/users/:id", { params: { id: 10 }, replace: true })}
    >
      Jump to User #10
    </button>
  );
}
```

### Signature

```ts
type TypedNavigate = <Path extends ExtractRoutePaths<TManifest>>(
  to: Path,
  ...args: NavigationArgs<RouteParamsFor<TManifest, Path>, RouteSearchFor<TManifest, Path>, unknown>
) => void;
```

### Options (`args[0]`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `params` | `RouteParamsFor<TManifest, Path>` | Conditional | **Required** if `Path` contains dynamic `:param` or `*wildcard` segments; disallowed on static paths. |
| `search` | `RouteSearchFor<TManifest, Path>` | `undefined` | Optional search query parameters (`Partial<TSearch>`). |
| `hash` | `string` | `undefined` | Optional URL hash fragment. |
| `state` | `unknown` | `undefined` | Optional history state object. |
| `replace` | `boolean` | `false` | Replaces the current history entry when `true`. |
| `scroll` | `boolean` | `true` | Scrolls to top after navigation when `true`. |

> **Good to know**:
>
> - `useNavigate()` and `navigateCrossApp()` reject executable URI schemes (`javascript:`, `data:`, `vbscript:`) with a `TypeError`, collapse leading protocol-relative slashes (`//host` -> `/host`) on relative targets, and pass `"noopener,noreferrer"` when opening external tabs via `window.open`.

---

## `buildUrl(pattern, options?)`

Precompiles a route pattern into static and parameter segments and constructs a formatted URL string with zero `URLSearchParams` host allocations.

```ts
import { buildUrl } from "@skyjt/typed-routes";

const href = buildUrl("/users/:id", {
  params: { id: 42 },
  search: { role: "admin", tags: ["core", "ops"] },
  hash: "permissions",
});
// -> "/users/42?role=admin&tags=core&tags=ops#permissions"
```

### Parameters

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `pattern` | `string` | **Required** | Route pattern supporting `:param`, `:param?`, `*wildcard`, `[param]`, and `[...wildcard]`. |
| `options.params` | `Record<string, unknown>` | `undefined` | Values substituted into dynamic path segments. Throws an `Error` if a required parameter is missing. |
| `options.search` | `Record<string, unknown>` | `undefined` | Query parameters serialized into `?key=value`. Arrays are serialized as repeated keys (`?tag=a&tag=b`); `undefined` and `null` values are omitted. |
| `options.hash` | `string` | `undefined` | Hash fragment appended to the URL. |

### Route Builder Caching & Lifecycle

`buildUrl` compiles route patterns into optimized template functions on first access and stores them in a bounded native `Map` capped at `MAX_BUILDER_CACHE_SIZE` (default: 2,048 entries) using O(1) FIFO eviction.

```ts
import { clearBuilderCache, getBuilderCacheSize, MAX_BUILDER_CACHE_SIZE } from "@skyjt/typed-routes";

console.log(MAX_BUILDER_CACHE_SIZE); // 2048
console.log(getBuilderCacheSize());  // e.g. 42

// Reset cache if needed (e.g. between isolated test suites or server restarts)
clearBuilderCache();
```

---

## `validateData(validator, rawInput)`

Executes synchronous validation against any [Standard Schema V1](https://github.com/standard-schema/standard-schema) validator (Valibot, Zod 3.24+, ArkType), legacy Zod schema (`safeParse`), or custom parser function, with automatic string-to-primitive coercion fallback.

```ts
import * as v from "valibot";
import { validateData } from "@skyjt/typed-routes";

const schema = v.object({
  id: v.number(),
  active: v.boolean(),
});

const result = validateData(schema, { id: "42", active: "true" });
if (result.success) {
  console.log(result.data); // { id: 42, active: true }
} else {
  console.error(result.issues);
}
```

### Returns (`ValidationResult<T>`)

| Property | Type | Description |
| :--- | :--- | :--- |
| `success` | `boolean` | `true` when validation succeeded; `false` when validation failed. |
| `data` | `T \| undefined` | The validated (and coerced) output when `success === true`. |
| `issues` | `ReadonlyArray<{ message: string; path?: string }> \| undefined` | Normalized validation issues when `success === false`. |

> **Good to know**: `validateData` uses a two-step strategy: it first validates `rawInput` directly without allocation; only if direct validation fails and `rawInput` is a record does it run `coerceRecord(rawInput)` (converting numeric strings like `"42"` to `42` and boolean strings `"true"`/`"false"` to booleans) and re-validate.

---

## `createPaths(options?)` & Cross-App URL Builders

Creates a standalone typed path builder and navigation helper supporting both 2-argument local calls and 3-argument cross-app calls:

```ts
import type mainRoutes from "virtual:file-routes";
import type docsRoutes from "../../docs-app/file-routes";
import { createPaths } from "@skyjt/typed-routes";

export const paths = createPaths<typeof mainRoutes, { docs: typeof docsRoutes }>({
  baseUrl: "",
  apps: {
    docs: { baseUrl: "https://docs.example.com", target: "_blank" },
  },
});

paths.build("/users/:id", { params: { id: 1 } });
paths.build("docs", "/guides/:slug", { params: { slug: "intro" } });
```

---

## `createClient(options?)`

Creates a method-first End-to-End Type Safety Request Client bound to a route manifest. Every method (`get`, `post`, `put`, `patch`, `delete`, `head`, `options`, `query`) resolves to a `Promise<[data, null] | [null, ProblemDetails]>` tuple:

```ts
import type routes from "virtual:file-routes";
import { createClient } from "@skyjt/typed-routes";

export const api = createClient<typeof routes>({
  baseUrl: "http://localhost:3000",
});

const [data, error] = await api.get("/api/users/:id", {
  params: { id: 1 },
});
```

---

## Version History

| Version | Changes |
| :--- | :--- |
| `v0.9.1` | Added executable URI scheme rejection (`TypeError`), leading `//` normalization in `useNavigate`, `joinBaseAndPath`, and `navigateCrossApp`, `"noopener,noreferrer"` window features on `window.open`, and `Object.hasOwn` guards in `serializeFastQuery`. |
| `v0.9.0` | Added `createPaths`, `buildCrossAppUrl`, `navigateCrossApp`, 3-argument cross-app `useNavigate(app, to, options?)` overloads, and `createClient<typeof routes>()` returning `[data, error]` tuples with RFC 9457 `ProblemDetails`. |
| `v0.6.3` | Replaced `LruCache` wrapper with bounded native `Map` FIFO eviction, added single-parameter builder specialization (`buildSingleRequiredParamUrl`), and added IEEE-754 finite numeric parameter validation (`RangeError` on `NaN` / `Infinity / -Infinity`). |
| `v0.6.2` | Replaced unbounded builder cache with `MAX_BUILDER_CACHE_SIZE = 2048` bounded `LruCache`, exported `clearBuilderCache` and `getBuilderCacheSize`, and added prototype pollution defense in query parameter coercion. |
| `v0.6.1` | Added zero-options fast path (`options === undefined`) in `buildUrl`, returning static paths with near-zero latency. |
| `v0.4.0` | Updated `RouteParamsFor` and `RouteSearchFor` inference for zero-cast `useNavigate` and `paths.build`. |
| `v0.2.0` | Introduced precompiled path builders (`compilePathBuilder`) and zero-allocation query serialization (`serializeFastQuery`). |
| `v0.1.0` | Initial release of `useNavigate`, `buildUrl`, and `validateData`. |
