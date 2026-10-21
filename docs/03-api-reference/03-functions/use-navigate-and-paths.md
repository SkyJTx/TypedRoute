# `useNavigate`, `buildUrl`, and `validateData`

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

## Version History

| Version | Changes |
| :--- | :--- |
| `v0.4.0` | Updated `RouteParamsFor` and `RouteSearchFor` inference for zero-cast `useNavigate` and `paths.build`. |
| `v0.2.0` | Introduced precompiled path builders (`compilePathBuilder`) and zero-allocation query serialization (`serializeFastQuery`). |
| `v0.1.0` | Initial release of `useNavigate`, `buildUrl`, and `validateData`. |