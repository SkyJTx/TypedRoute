import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import solid from "@solidjs/vite-plugin";
import { routes } from "@skyjt/typed-routes-solid/vite";

export default defineConfig({
  plugins: [
    solid({
      ssr: true,
      extensions: [".jsx", ".tsx"],
    }),
    routes(),
  ],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});