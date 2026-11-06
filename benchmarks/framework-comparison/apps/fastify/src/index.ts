/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createFastifyApp } from "./app";

const port = Number(process.env.PORT || 3333);
const host = "127.0.0.1";

const fastify = createFastifyApp();
await fastify.listen({ port, host });

console.log(`READY: Fastify on http://${host}:${port}`);

const shutdown = async () => {
  await fastify.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
