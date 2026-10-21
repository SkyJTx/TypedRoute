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
      diagnostics: true,
    }),
    routes({
      codeSplitting: true,
      types: true,
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
    assetsInlineLimit: 0,
  },
});
