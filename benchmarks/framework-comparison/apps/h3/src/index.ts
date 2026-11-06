/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { app } from "./app";

const port = Number(process.env.PORT || 3333);
const host = "127.0.0.1";

console.log(`READY: H3 (v2) on http://${host}:${port}`);

// Idiomatic Bun server binding for H3 v2
export default {
  port,
  hostname: host,
  fetch: app.fetch,
};
