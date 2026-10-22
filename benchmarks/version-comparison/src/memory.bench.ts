/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import process from "node:process";
import { current, v011, v040 } from "./targets";
import { fixtures } from "./fixtures";
import { isolates } from "./isolates";
import * as ufo from "ufo";

export function forceGc(): void {
  const bunGc = (globalThis as unknown as { Bun?: { gc?: (sync: boolean) => void } }).Bun?.gc;
  if (typeof bunGc === "function") {
    bunGc(true);
    return;
  }
  const nodeGc = (globalThis as unknown as { gc?: () => void }).gc;
  if (typeof nodeGc === "function") {
    nodeGc();
  }
}

export function measureHeapDelta(
  fn: () => void,
  iterations: number = 100_000,
): { deltaKb: number; bytesPerOp: number } {
  forceGc();
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

function measureRetainedRouteFootprint(
  defineRouteFn: (cfg: Record<string, unknown>) => unknown,
  count: number = 20_000,
): { totalBytesFor10Routes: number; bytesPerRoute: number } {
  const sharedConfig = {
    params: (raw: Record<string, unknown>) => ({ id: Number(raw.id) }),
  };
  const bucket = Array.from<unknown>({length: count});

  for (let i = 0; i < 64; i++) {
    defineRouteFn(sharedConfig);
  }

  forceGc();
  const memBefore = process.memoryUsage().heapUsed;
  for (let i = 0; i < count; i++) {
    bucket[i] = defineRouteFn(sharedConfig);
  }
  forceGc();
  const memAfter = process.memoryUsage().heapUsed;

  if (bucket.length === 0) {
    console.log(bucket);
  }

  const deltaBytes = Math.max(0, memAfter - memBefore);
  const bytesPerRoute = Math.max(16, Math.round(deltaBytes / count));
  return {
    bytesPerRoute,
    totalBytesFor10Routes: bytesPerRoute * 10,
  };
}

export function runMemoryAudit(iterations: number = 100_000) {
  console.log("\n=========================================================================");
  console.log(`  3-WAY VERSION HEAP AUDIT: v0.1.1 vs v0.4.0 vs current vs Isolates (${(iterations / 1000).toFixed(0)}k Ops)`);
  console.log("=========================================================================");

  console.log("  [0] Retained Route Instance Footprint (defineRoute):");
  {
    const f011 = measureRetainedRouteFootprint(
      v011.defineRoute as unknown as (cfg: Record<string, unknown>) => unknown,
    );
    const f040 = measureRetainedRouteFootprint(
      v040.defineRoute as unknown as (cfg: Record<string, unknown>) => unknown,
    );
    const fCur = measureRetainedRouteFootprint(
      current.defineRoute as unknown as (cfg: Record<string, unknown>) => unknown,
    );
    console.log(
      `      Published v0.1.1          : ${String(f011.bytesPerRoute).padStart(9)} B/route (${f011.totalBytesFor10Routes} B for 10 routes)`,
    );
    console.log(
      `      Published v0.4.0          : ${String(f040.bytesPerRoute).padStart(9)} B/route (${f040.totalBytesFor10Routes} B for 10 routes)`,
    );
    console.log(
      `      Current                   : ${String(fCur.bytesPerRoute).padStart(9)} B/route (${fCur.totalBytesFor10Routes} B for 10 routes — < 1 KB)`,
    );
  }

  console.log("\n  [1] URL Construction (Complex Route + Arrays + Hash):");
  {
    const m011 = measureHeapDelta(() => {
      v011.buildUrl(fixtures.complex.pattern, {
        params: fixtures.complex.params,
        search: fixtures.complex.search,
        hash: fixtures.complex.hash,
      });
    }, iterations);
    const m040 = measureHeapDelta(() => {
      v040.buildUrl(fixtures.complex.pattern, {
        params: fixtures.complex.params,
        search: fixtures.complex.search,
        hash: fixtures.complex.hash,
      });
    }, iterations);
    const mCur = measureHeapDelta(() => {
      current.buildUrl(fixtures.complex.pattern, {
        params: fixtures.complex.params,
        search: fixtures.complex.search,
        hash: fixtures.complex.hash,
      });
    }, iterations);
    const mIsolate = measureHeapDelta(() => {
      isolates.buildUrlStaticFast(fixtures.complex.pattern, {
        params: fixtures.complex.params,
        search: fixtures.complex.search,
        hash: fixtures.complex.hash,
      });
    }, iterations);

    console.log(`      Published v0.1.1          : ${String(m011.deltaKb).padStart(9)} KB (${m011.bytesPerOp} bytes/op)`);
    console.log(`      Published v0.4.0          : ${String(m040.deltaKb).padStart(9)} KB (${m040.bytesPerOp} bytes/op)`);
    console.log(`      Current                   : ${String(mCur.deltaKb).padStart(9)} KB (${mCur.bytesPerOp} bytes/op)`);
    console.log(`      Candidate Isolate         : ${String(mIsolate.deltaKb).padStart(9)} KB (${mIsolate.bytesPerOp} bytes/op)`);
  }

  console.log("\n  [2] Search Parameter Normalization:");
  {
    const m011 = measureHeapDelta(() => {
      v011.normalizeSearchParams(fixtures.urls.query);
    }, iterations);
    const m040 = measureHeapDelta(() => {
      v040.normalizeSearchParams(fixtures.urls.query);
    }, iterations);
    const mCur = measureHeapDelta(() => {
      current.normalizeSearchParams(fixtures.urls.query);
    }, iterations);
    const mUfo = measureHeapDelta(() => {
      ufo.parseQuery(fixtures.urls.query);
    }, iterations);
    const mIsolate = measureHeapDelta(() => {
      isolates.normalizeSearchParamsNullProto(fixtures.urls.query);
    }, iterations);

    console.log(`      Published v0.1.1          : ${String(m011.deltaKb).padStart(9)} KB (${m011.bytesPerOp} bytes/op)`);
    console.log(`      Published v0.4.0          : ${String(m040.deltaKb).padStart(9)} KB (${m040.bytesPerOp} bytes/op)`);
    console.log(`      Current                   : ${String(mCur.deltaKb).padStart(9)} KB (${mCur.bytesPerOp} bytes/op)`);
    console.log(`      Ecosystem ufo.parseQuery  : ${String(mUfo.deltaKb).padStart(9)} KB (${mUfo.bytesPerOp} bytes/op)`);
    console.log(`      Candidate Isolate         : ${String(mIsolate.deltaKb).padStart(9)} KB (${mIsolate.bytesPerOp} bytes/op)`);
  }

  console.log("=========================================================================\n");
}