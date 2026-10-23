/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { run } from "mitata";
import { registerPerformanceBenchmarks } from "./performance.bench";
import { runThroughputBenchmarks } from "./throughput.bench";
import { runMemoryAudit } from "./memory.bench";

console.log("=========================================================================");
console.log("  TOPIC: 4-WAY VERSION COMPARISON SUITE (v0.1.1 vs v0.4.0 vs v0.6.1 vs CURRENT)");
console.log("  Pure Versioning Benchmark: Speed, Latency, Throughput & Memory Retained");
console.log("=========================================================================\n");

console.log(">>> PHASE 1: SPEED & LATENCY MICRO-BENCHMARKS (mitata JIT profiling)\n");
registerPerformanceBenchmarks();
await run();

console.log("\n>>> PHASE 2: SUSTAINED THROUGHPUT STRESS (250,000 continuous iterations)");
runThroughputBenchmarks(250_000);

console.log("\n>>> PHASE 3: HEAP RETENTION & MEMORY ALLOCATION AUDIT (100,000 iterations)");
runMemoryAudit(100_000);

console.log("=========================================================================");
console.log("  4-WAY VERSION COMPARISON COMPLETE");
console.log("=========================================================================\n");