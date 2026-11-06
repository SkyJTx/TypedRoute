/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import autocannon from "autocannon";
import pidusage from "pidusage";
import { fixtures } from "./fixtures";
import type { FrameworkHttpSummary, HttpScenarioResult } from "./types";
import { spawnFrameworkServer } from "./subprocess";

export function forceGc(): void {
  const bunGc = (globalThis as unknown as { Bun?: { gc?: (sync: boolean) => void } }).Bun?.gc;
  if (typeof bunGc === "function") {
    bunGc(true);
    return;
  }
  const nodeGc = (globalThis as unknown as { gc?: () => void }).gc;
  if (typeof nodeGc === "function") {
    nodeGc();
    return;
  }
}

async function runAutocannonScenario(
  baseUrl: string,
  path: string,
  scenarioName: string,
  options?: { method?: "GET" | "POST"; body?: string; headers?: Record<string, string>; duration?: number },
): Promise<HttpScenarioResult> {
  const duration = options?.duration ?? 3;
  const result = await autocannon({
    url: `${baseUrl}${path}`,
    connections: 100,
    pipelining: 1,
    duration,
    method: options?.method ?? "GET",
    body: options?.body,
    headers: options?.headers,
  });

  if (result.non2xx > 0) {
    throw new Error(`Scenario [${scenarioName}] failed with ${result.non2xx} non-2xx HTTP responses!`);
  }

  const throughputMbSec = Number((result.throughput.average / (1024 * 1024)).toFixed(2));

  return {
    scenario: scenarioName,
    path,
    requestsPerSec: Math.round(result.requests.average),
    latencyAvgMs: Number(result.latency.average.toFixed(2)),
    latencyP50Ms: Number(result.latency.p50.toFixed(2)),
    latencyP90Ms: Number(result.latency.p90.toFixed(2)),
    latencyP99Ms: Number(result.latency.p99.toFixed(2)),
    throughputMbSec,
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
  };
}

async function benchmarkTargetSubprocess(
  name: string,
  appName: string,
  durationSec: number = 3,
  mode: "raw" | "validated" = "raw",
): Promise<FrameworkHttpSummary> {
  const server = await spawnFrameworkServer(name, appName, undefined, mode);

  try {
    // 1. Comprehensive Warm-up across ALL 4 routes
    for (let i = 0; i < 100; i++) {
      await fetch(`${server.url}${fixtures.static.path}`);
      await fetch(`${server.url}${fixtures.dynamic.path}`);
      await fetch(`${server.url}${fixtures.query.path}`);
      await fetch(`${server.url}${fixtures.post.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fixtures.post.payload),
      });
    }

    // Cooldown post warmup
    await new Promise((r) => setTimeout(r, 400));

    // Baseline memory of child process
    const statsBefore = await pidusage(server.proc.pid);
    const baselineChildRssMb = Number((statsBefore.memory / (1024 * 1024)).toFixed(2));

    const scenarios: HttpScenarioResult[] = [];
    const memorySamples: number[] = [statsBefore.memory];
    const cpuSamples: number[] = [statsBefore.cpu];

    const sampleTelemetry = async () => {
      try {
        const s = await pidusage(server.proc.pid);
        memorySamples.push(s.memory);
        cpuSamples.push(s.cpu);
      } catch {}
    };

    // 1. Static Route
    scenarios.push(
      await runAutocannonScenario(server.url, fixtures.static.path, "Static (GET /)", { duration: durationSec }),
    );
    await sampleTelemetry();
    await new Promise((r) => setTimeout(r, 500));

    // 2. Dynamic Param
    scenarios.push(
      await runAutocannonScenario(server.url, fixtures.dynamic.path, "Dynamic (GET /user/:id)", { duration: durationSec }),
    );
    await sampleTelemetry();
    await new Promise((r) => setTimeout(r, 500));

    // 3. Query
    scenarios.push(
      await runAutocannonScenario(server.url, fixtures.query.path, "Query (GET /items?...)", { duration: durationSec }),
    );
    await sampleTelemetry();
    await new Promise((r) => setTimeout(r, 500));

    // 4. POST JSON
    scenarios.push(
      await runAutocannonScenario(server.url, fixtures.post.path, "POST JSON (POST /user)", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fixtures.post.payload),
        duration: durationSec,
      }),
    );
    await sampleTelemetry();

    const peakMemory = Math.max(...memorySamples);
    const peakChildRssMb = Number((peakMemory / (1024 * 1024)).toFixed(2));
    const childRssDeltaMb = Number(((peakMemory - statsBefore.memory) / (1024 * 1024)).toFixed(2));
    const avgCpu = cpuSamples.reduce((a, b) => a + b, 0) / cpuSamples.length;
    const childCpuPercent = Number(avgCpu.toFixed(1));

    const avgRequestsPerSec = Math.round(
      scenarios.reduce((acc, s) => acc + s.requestsPerSec, 0) / scenarios.length,
    );
    const p99LatencyMs = Number(
      (scenarios.reduce((acc, s) => acc + s.latencyP99Ms, 0) / scenarios.length).toFixed(2),
    );

    return {
      name,
      scenarios,
      avgRequestsPerSec,
      p99LatencyMs,
      peakChildRssMb,
      baselineChildRssMb,
      childRssDeltaMb,
      childCpuPercent,
    };
  } finally {
    try {
      pidusage.clear();
    } catch {}
    await server.stop();
  }
}

export async function runHttpBenchmarks(
  durationSec: number = 3,
  mode: "raw" | "validated" = "raw",
): Promise<FrameworkHttpSummary[]> {
  const tierTitle = mode === "raw" ? "TIER 1: RAW ROUTING (Zero Validation)" : "TIER 2: VALIDATED CONTRACT (End-to-End)";
  console.log("=========================================================================");
  console.log(`  LIVE HTTP BENCHMARK - ${tierTitle}`);
  console.log(`  Duration: ${durationSec}s/scenario, Concurrency: 100, Process-Isolated`);
  console.log("=========================================================================\n");

  const targets = [
    { name: "@skyjt/typed-routes", appName: "typed-routes" },
    { name: "Elysia (AOT 2.0 RC)", appName: "elysia" },
    { name: "Hono", appName: "hono" },
    { name: "H3 (v2)", appName: "h3" },
    { name: "Fastify", appName: "fastify" },
    { name: "Express", appName: "express" },
    { name: "NestJS", appName: "nest" },
  ];

  const results: FrameworkHttpSummary[] = [];

  for (const target of targets) {
    console.log(`>>> Spawning isolated subprocess for [${target.name}] (apps/${target.appName}) [${mode}]...`);
    try {
      const summary = await benchmarkTargetSubprocess(target.name, target.appName, durationSec, mode);
      results.push(summary);
      console.log(
        `    [${summary.name}] completed -> Avg RPS: ${summary.avgRequestsPerSec.toLocaleString()} req/s, p99: ${summary.p99LatencyMs}ms, Baseline RSS: ${summary.baselineChildRssMb}MB, Peak RSS: ${summary.peakChildRssMb}MB`,
      );
    } catch (err) {
      console.error(`    [${target.name}] FAILED:`, err);
    }
    // Inter-framework socket drain
    await new Promise((r) => setTimeout(r, 1000));
  }

  printLeaderboards(results, tierTitle);
  return results;
}

function printLeaderboards(results: FrameworkHttpSummary[], tierTitle: string): void {
  console.log("\n=========================================================================");
  console.log(`  LEADERBOARD: ${tierTitle}`);
  console.log("=========================================================================");

  const sorted = [...results].sort((a, b) => b.avgRequestsPerSec - a.avgRequestsPerSec);

  console.log(
    "| Rank | Framework                 | Avg RPS (req/s) | p99 Latency | Baseline RSS | Peak RSS | RSS Delta | Child CPU |",
  );
  console.log(
    "| :--- | :------------------------ | --------------: | ----------: | -----------: | -------: | --------: | --------: |",
  );

  sorted.forEach((item, idx) => {
    const rank = `#${idx + 1}`.padEnd(4);
    const name = item.name.padEnd(25);
    const rps = item.avgRequestsPerSec.toLocaleString().padStart(15);
    const p99 = `${item.p99LatencyMs} ms`.padStart(11);
    const baseRss = `${item.baselineChildRssMb} MB`.padStart(12);
    const peakRss = `${item.peakChildRssMb} MB`.padStart(8);
    const deltaRss = `+${item.childRssDeltaMb} MB`.padStart(9);
    const cpu = `${item.childCpuPercent}%`.padStart(9);
    console.log(`| ${rank} | ${name} | ${rps} | ${p99} | ${baseRss} | ${peakRss} | ${deltaRss} | ${cpu} |`);
  });

  console.log("\n=========================================================================");
  console.log(`  DETAILED SCENARIO BREAKDOWN: ${tierTitle}`);
  console.log("=========================================================================");

  const scenarioNames = [
    "Static (GET /)",
    "Dynamic (GET /user/:id)",
    "Query (GET /items?...)",
    "POST JSON (POST /user)",
  ];

  for (const sName of scenarioNames) {
    console.log(`\n--- [Scenario: ${sName}] ---`);
    console.log("| Framework                 | RPS (req/s)     | Latency (avg/p99) | Throughput  | Errors | Non-2xx |");
    console.log("| :------------------------ | --------------: | ----------------: | ----------: | -----: | ------: |");

    const scenarioRankings = results
      .map((r) => ({
        name: r.name,
        res: r.scenarios.find((s) => s.scenario === sName)!,
      }))
      .filter((x) => x.res !== undefined)
      .sort((a, b) => b.res.requestsPerSec - a.res.requestsPerSec);

    for (const item of scenarioRankings) {
      const name = item.name.padEnd(25);
      const rps = item.res.requestsPerSec.toLocaleString().padStart(15);
      const lat = `${item.res.latencyAvgMs}ms / ${item.res.latencyP99Ms}ms`.padStart(17);
      const tp = `${item.res.throughputMbSec} MB/s`.padStart(11);
      const err = String(item.res.errors).padStart(6);
      const non2 = String(item.res.non2xx).padStart(7);
      console.log(`| ${name} | ${rps} | ${lat} | ${tp} | ${err} | ${non2} |`);
    }
  }
}

if (import.meta.main) {
  const mode = (process.env.BENCH_MODE as "raw" | "validated") || "raw";
  runHttpBenchmarks(3, mode).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
