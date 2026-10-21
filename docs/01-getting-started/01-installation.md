# Installation

Set up `@skyjt/typed-routes` and `@skyjt/typed-routes-solid` in a SolidJS 2.0 or standard Vite project.

---

## System Requirements

- **Node.js** `>=20.0.0` or **Bun** `>=1.2.0`
- **Vite** `>=5.0.0` (Vite 8 recommended)
- **TypeScript** `>=5.4.0` with `strict: true`
- **SolidJS** `>=2.0.0-rc.6` and `@solidjs/router` `>=2.0.0-next.21` (when using `@skyjt/typed-routes-solid`)

---

## Automatic Installation

Install the SolidJS adapter alongside `filesystem-routing` and your preferred [Standard Schema V1](https://github.com/standard-schema/standard-schema) validator (such as `valibot` or `zod`):

```bash
bun add @skyjt/typed-routes @skyjt/typed-routes-solid filesystem-routing solid-js @solidjs/router @solidjs/web valibot
```

> **Good to know**: If you are building a framework-agnostic backend or custom router without SolidJS, install `@skyjt/typed-routes` and `filesystem-routing` directly.

---

## Configure Vite (`vite.config.ts`)

Register the `routes()` plugin from `@skyjt/typed-routes-solid/vite` alongside `@solidjs/vite-plugin`:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import { routes } from "@skyjt/typed-routes-solid/vite";

export default defineConfig({
  plugins: [
    solid({
      start: {
        middleware: "src/middleware.ts",
      },
      ssr: true,
      extensions: [".jsx", ".tsx"],
    }),
    routes({
      codeSplitting: true,
      types: true,
    }),
  ],
});
```

---

## Configure TypeScript (`tsconfig.json`)

When `types: true` (the default) is enabled in `routes()`, `filesystem-routing` automatically generates `file-routes.d.ts` at the project root whenever routes are added, modified, or removed.

Include `"file-routes.d.ts"` in the `include` array of your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "jsxImportSource": "@solidjs/web",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*", "file-routes.d.ts", "vite.config.ts"]
}
```

> **Good to know**: Never reference both `file-routes.d.ts` and `filesystem-routing/types` in the same project. `file-routes.d.ts` provides the exact literal tuple types for your route tree (`routes` and `pageRoutes`), whereas `filesystem-routing/types` provides untyped fallback declarations.