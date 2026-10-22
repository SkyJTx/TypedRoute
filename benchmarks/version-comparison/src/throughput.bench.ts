/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { performance } from "node:perf_hooks";
import { current, v011, v040 } from "./targets";
import { fixtures } from "./fixtures";
import { forceGc } from "./memory.bench";

export interface ThroughputResult {
  readonly name: string;
  readonly iterations: number;
  readonly elapsedMs: number;
  readonly opsPerSec: number;
  readonly nsPerOp: number;
}

export function measureThroughput(
  name: string,
  fn: () => void,
  iterations: number = 250_000,
): ThroughputResult {
  // Warm-up to trigger JIT optimization
  for (let i = 0; i < 2_000; i++) {
    fn();
  }
  forceGc();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const elapsedMs = performance.now() - start;
  const opsPerSec = Math.round(iterations / (elapsedMs / 1000));
  const nsPerOp = Number(((elapsedMs * 1_000_000) / iterations).toFixed(2));

  return { name, iterations, elapsedMs: Number(elapsedMs.toFixed(2)), opsPerSec, nsPerOp };
}

function printThroughputGroup(
  title: string,
  v011Res: ThroughputResult,
  v040Res: ThroughputResult,
  curRes: ThroughputResult,
) {
  const speedupVsV011 = (curRes.opsPerSec / v011Res.opsPerSec).toFixed(2);
  const speedupVsV040 = (curRes.opsPerSec / v040Res.opsPerSec).toFixed(2);

  console.log(`  ${title}:`);
  console.log(
    `      Published v0.1.1          : ${v011Res.opsPerSec.toLocaleString().padStart(12)} ops/sec (${v011Res.elapsedMs.toFixed(1)} ms, ${v011Res.nsPerOp} ns/op)`,
  );
  console.log(
    `      Published v0.4.0          : ${v040Res.opsPerSec.toLocaleString().padStart(12)} ops/sec (${v040Res.elapsedMs.toFixed(1)} ms, ${v040Res.nsPerOp} ns/op)`,
  );
  console.log(
    `      Current                   : ${curRes.opsPerSec.toLocaleString().padStart(12)} ops/sec (${curRes.elapsedMs.toFixed(1)} ms, ${curRes.nsPerOp} ns/op) -> [${speedupVsV011}x vs v0.1.1, ${speedupVsV040}x vs v0.4.0]`,
  );
}

export function runThroughputBenchmarks(iterations: number = 250_000) {
  console.log("\n=========================================================================");
  console.log(`  3-WAY VERSION SUSTAINED THROUGHPUT STRESS (${(iterations / 1000).toFixed(0)}k Iterations)`);
  console.log("=========================================================================");

  // 1. Static URL Construction Throughput
  {
    const t011 = measureThroughput("Static URL (v0.1.1)", () => v011.buildUrl(fixtures.static.pattern), iterations);
    const t040 = measureThroughput("Static URL (v0.4.0)", () => v040.buildUrl(fixtures.static.pattern), iterations);
    const tCur = measureThroughput("Static URL (current)", () => current.buildUrl(fixtures.static.pattern), iterations);
    printThroughputGroup("[1] Static URL Construction Throughput", t011, t040, tCur);
  }

  // 2. Dynamic Single-Param URL Throughput
  {
    const t011 = measureThroughput("Single Param (v0.1.1)", () => v011.buildUrl(fixtures.singleParam.pattern, { params: fixtures.singleParam.params }), iterations);
    const t040 = measureThroughput("Single Param (v0.4.0)", () => v040.buildUrl(fixtures.singleParam.pattern, { params: fixtures.singleParam.params }), iterations);
    const tCur = measureThroughput("Single Param (current)", () => current.buildUrl(fixtures.singleParam.pattern, { params: fixtures.singleParam.params }), iterations);
    printThroughputGroup("[2] Dynamic Single-Param URL Construction Throughput", t011, t040, tCur);
  }

  // 3. Complex Multi-Param + Query + Hash Throughput
  {
    const t011 = measureThroughput("Complex URL (v0.1.1)", () => v011.buildUrl(fixtures.complex.pattern, {
      params: fixtures.complex.params,
      search: fixtures.complex.search,
      hash: fixtures.complex.hash,
    }), iterations);
    const t040 = measureThroughput("Complex URL (v0.4.0)", () => v040.buildUrl(fixtures.complex.pattern, {
      params: fixtures.complex.params,
      search: fixtures.complex.search,
      hash: fixtures.complex.hash,
    }), iterations);
    const tCur = measureThroughput("Complex URL (current)", () => current.buildUrl(fixtures.complex.pattern, {
      params: fixtures.complex.params,
      search: fixtures.complex.search,
      hash: fixtures.complex.hash,
    }), iterations);
    printThroughputGroup("[3] Complex Multi-Param + Arrays + Hash Throughput", t011, t040, tCur);
  }

  // 4. URL Parsing Throughput
  {
    const t011 = measureThroughput("URL Parse (v0.1.1)", () => {
      const u = new URL(fixtures.urls.full);
      return u.pathname;
    }, iterations);
    const t040 = measureThroughput("URL Parse (v0.4.0)", () => v040.parseFastUrl(fixtures.urls.full), iterations);
    const tCur = measureThroughput("URL Parse (current)", () => current.parseFastUrl(fixtures.urls.full), iterations);
    printThroughputGroup("[4] URL Parsing (Host & Pathname Extraction) Throughput", t011, t040, tCur);
  }

  // 5. Search Parameter Normalization Throughput
  {
    const t011 = measureThroughput("Query Normalize (v0.1.1)", () => v011.normalizeSearchParams(fixtures.urls.query), iterations);
    const t040 = measureThroughput("Query Normalize (v0.4.0)", () => v040.normalizeSearchParams(fixtures.urls.query), iterations);
    const tCur = measureThroughput("Query Normalize (current)", () => current.normalizeSearchParams(fixtures.urls.query), iterations);
    printThroughputGroup("[5] Search Parameter Normalization Throughput", t011, t040, tCur);
  }

  console.log("=========================================================================\n");
}