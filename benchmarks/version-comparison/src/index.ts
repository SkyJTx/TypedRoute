/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { run } from "mitata";
import { registerPerformanceBenchmarks } from "./performance.bench";
import { runMemoryAudit } from "./memory.bench";

console.log("=========================================================================");
console.log("  TOPIC: VERSION COMPARISON (PUBLISHED v0.1.1 vs CURRENT OPTIMIZED)");
console.log("=========================================================================\n");

registerPerformanceBenchmarks();

await run();

runMemoryAudit();
