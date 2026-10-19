import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "vite/index": "src/vite/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    "@skyjt/typed-routes",
    "@skyjt/typed-routes/vite",
    "solid-js",
    "@solidjs/router",
    "@solidjs/web",
    "filesystem-routing",
    "filesystem-routing/vite",
    "vite",
  ],
});