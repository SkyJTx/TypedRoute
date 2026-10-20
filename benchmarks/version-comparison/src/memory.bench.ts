import process from "node:process";
import { current, published } from "./targets";
import { fixtures } from "./fixtures";

function measureHeapDelta(fn: () => void, iterations: number = 100_000): { deltaKb: number; bytesPerOp: number } {
  const gc = (globalThis as unknown as { gc?: () => void }).gc;
  if (typeof gc === "function") {
    gc();
  }
  const memBefore = process.memoryUsage().heapUsed;
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const memAfter = process.memoryUsage().heapUsed;
  const deltaBytes = Math.max(0, memAfter - memBefore);
  return {
    deltaKb: Number((deltaBytes / 1024).toFixed(2)),
    bytesPerOp: Number((deltaBytes / iterations).toFixed(2)),
  };
}

export function runMemoryAudit(iterations: number = 100_000) {
  console.log("\n=========================================================================");
  console.log(`  VERSION COMPARISON HEAP AUDIT (${(iterations / 1000).toFixed(0)}k Operations)`);
  console.log("=========================================================================");

  console.log("  [1] URL Construction (Complex Route + Arrays + Hash):");
  {
    const pub = measureHeapDelta(() => {
      published.buildUrl(fixtures.complex.pattern, {
        params: fixtures.complex.params,
        search: fixtures.complex.search,
        hash: fixtures.complex.hash,
      });
    }, iterations);
    const cur = measureHeapDelta(() => {
      current.buildUrl(fixtures.complex.pattern, {
        params: fixtures.complex.params,
        search: fixtures.complex.search,
        hash: fixtures.complex.hash,
      });
    }, iterations);

    console.log(`      Published v0.1.1          : ${String(pub.deltaKb).padStart(9)} KB (${pub.bytesPerOp} bytes/op)`);
    console.log(`      Current (Optimized Branch): ${String(cur.deltaKb).padStart(9)} KB (${cur.bytesPerOp} bytes/op)`);
  }

  console.log("\n  [2] Search Parameter Normalization:");
  {
    const pub = measureHeapDelta(() => {
      published.normalizeSearchParams(fixtures.urls.query);
    }, iterations);
    const cur = measureHeapDelta(() => {
      current.normalizeSearchParams(fixtures.urls.query);
    }, iterations);

    console.log(`      Published v0.1.1          : ${String(pub.deltaKb).padStart(9)} KB (${pub.bytesPerOp} bytes/op)`);
    console.log(`      Current (Optimized Branch): ${String(cur.deltaKb).padStart(9)} KB (${cur.bytesPerOp} bytes/op)`);
  }

  console.log("=========================================================================\n");
}
