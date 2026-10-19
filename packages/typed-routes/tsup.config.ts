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
    "filesystem-routing",
    "filesystem-routing/api",
    "filesystem-routing/vite",
    "vite",
  ],
});