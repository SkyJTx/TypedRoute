import { run } from "mitata";
import { registerPerformanceBenchmarks } from "./performance.bench";
import { runMemoryAudit } from "./memory.bench";

console.log("=========================================================================");
console.log("  TOPIC: VERSION COMPARISON (PUBLISHED v0.1.1 vs CURRENT OPTIMIZED)");
console.log("=========================================================================\n");

registerPerformanceBenchmarks();

await run();

runMemoryAudit();
