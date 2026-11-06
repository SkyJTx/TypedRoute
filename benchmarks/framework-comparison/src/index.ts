/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { runMicroBenchmarks } from "./micro.bench";
import { runHttpBenchmarks } from "./http.bench";
import { runMemoryAudit } from "./memory.bench";

console.log("=========================================================================");
console.log("  FRAMEWORK COMPARISON BENCHMARK SUITE (HARDENED TWO-TIER ARCHITECTURE)");
console.log("  Targets: NestJS vs Express vs Fastify vs Hono vs H3 vs Elysia (AOT) vs @skyjt/typed-routes");
console.log("=========================================================================\n");

console.log("\n>>> PHASE 1: IN-MEMORY DISPATCH MICRO-BENCHMARKS (Mitata JIT)\n");
await runMicroBenchmarks();

console.log("\n>>> PHASE 2A: TIER 1 - RAW ROUTING LOAD TEST (Zero Validation)\n");
await runHttpBenchmarks(3, "raw");

console.log("\n>>> PHASE 2B: TIER 2 - VALIDATED CONTRACT LOAD TEST (End-to-End)\n");
await runHttpBenchmarks(3, "validated");

console.log("\n>>> PHASE 3: SUBPROCESS-ISOLATED HEAP RETENTION & MEMORY AUDIT\n");
await runMemoryAudit(50_000);

console.log("=========================================================================");
console.log("  FRAMEWORK COMPARISON BENCHMARK COMPLETE");
console.log("=========================================================================\n");
