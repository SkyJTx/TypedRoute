/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { fetch } from "./app";

const port = Number(process.env.PORT || 3333);
const host = "127.0.0.1";

console.log(`READY: @skyjt/typed-routes on http://${host}:${port}`);

// Idiomatic Bun server binding for typed-routes middleware
export default {
  port,
  hostname: host,
  fetch,
};
