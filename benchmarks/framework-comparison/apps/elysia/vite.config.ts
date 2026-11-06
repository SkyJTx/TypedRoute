/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { defineConfig } from "vite";
import { aot } from "elysia/plugin/aot/vite";

export default defineConfig({
  plugins: [
    aot("src/app.ts"),
  ],
  build: {
    outDir: "dist/aot-vite",
    target: "esnext",
    ssr: "src/app.ts",
  },
});
