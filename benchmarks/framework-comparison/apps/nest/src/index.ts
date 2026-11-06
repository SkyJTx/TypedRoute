/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createNestApp } from "./app";

const port = Number(process.env.PORT || 3333);
const host = "127.0.0.1";

const app = await createNestApp();
await app.listen(port, host);

console.log(`READY: NestJS on http://${host}:${port}`);

const shutdown = async () => {
  await app.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
