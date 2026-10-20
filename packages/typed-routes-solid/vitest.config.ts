/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
import solid from "@solidjs/vite-plugin";

export default defineConfig({
  plugins: [
    solid({
      extensions: [".jsx", ".tsx"],
    }),
  ],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    conditions: ["browser", "development"],
    dedupe: ["solid-js", "@solidjs/web"],
  },
  ssr: {
    noExternal: [/solid-js/, /@solidjs/],
  },
  test: {
    environment: "jsdom",
    server: {
      deps: {
        inline: [/solid-js/, /@solidjs/],
      },
    },
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});