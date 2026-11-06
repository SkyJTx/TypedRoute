/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { forceGc } from "./http.bench";

interface MemoryResult {
  name: string;
  heapDeltaKb: number;
  bytesPerReq: number;
  finalRssMb: number;
  rssDeltaMb: number;
}

const TARGETS: Record<string, { name: string; getFetch: () => Promise<(req: Request) => Promise<Response> | Response> }> = {
  "typed-routes": {
    name: "@skyjt/typed-routes",
    getFetch: async () => {
      const mod = await import("@framework-benchmark/typed-routes");
      return mod.fetch;
    },
  },
  "elysia": {
    name: "Elysia (AOT 2.0 RC)",
    getFetch: async () => {
      const mod = await import("@framework-benchmark/elysia");
      return (req: Request) => mod.app.fetch(req);
    },
  },
  "hono": {
    name: "Hono",
    getFetch: async () => {
      const mod = await import("@framework-benchmark/hono");
      return (req: Request) => mod.app.fetch(req);
    },
  },
  "h3": {
    name: "H3 (v2)",
    getFetch: async () => {
      const mod = await import("@framework-benchmark/h3");
      return (req: Request) => mod.app.fetch(req);
    },
  },
};

async function runWorker(targetId: string, iterations: number): Promise<void> {
  const target = TARGETS[targetId];
  if (!target) {
    throw new Error(`Unknown target: ${targetId}`);
  }

  const fetchFn = await target.getFetch();
  const testReq = new Request("http://localhost/user/42");

  // Warm up
  for (let i = 0; i < 500; i++) {
    const res = await fetchFn(testReq);
    await res.text();
  }
  forceGc();

  const memBefore = process.memoryUsage();

  for (let i = 0; i < iterations; i++) {
    const res = await fetchFn(testReq);
    await res.text();
  }

  forceGc();
  const memAfter = process.memoryUsage();

  const heapDeltaBytes = memAfter.heapUsed - memBefore.heapUsed;
  const heapDeltaKb = Number((heapDeltaBytes / 1024).toFixed(2));
  const bytesPerReq = Number((heapDeltaBytes / iterations).toFixed(2));
  const finalRssMb = Number((memAfter.rss / (1024 * 1024)).toFixed(2));
  const rssDeltaMb = Number(((memAfter.rss - memBefore.rss) / (1024 * 1024)).toFixed(2));

  const result: MemoryResult = {
    name: target.name,
    heapDeltaKb,
    bytesPerReq,
    finalRssMb,
    rssDeltaMb,
  };

  console.log(`__JSON_RESULT__${JSON.stringify(result)}`);
}

export async function runMemoryAudit(iterations: number = 50_000): Promise<void> {
  console.log("=========================================================================");
  console.log(`  HEAP RETENTION & MEMORY CONSUMPTION AUDIT (${(iterations / 1000).toFixed(0)}k Iterations)`);
  console.log("  Each target executed in a pristine, dedicated subprocess");
  console.log("=========================================================================\n");

  console.log("| Framework                 | Heap Delta (KB) | Bytes / Request | Final RSS (MB) | RSS Delta (MB) |");
  console.log("| :------------------------ | --------------: | --------------: | -------------: | -------------: |");

  const results: MemoryResult[] = [];
  const scriptPath = import.meta.path;

  for (const targetId of Object.keys(TARGETS)) {
    const proc = Bun.spawn(
      ["bun", "run", scriptPath, `--worker=${targetId}`, `--iterations=${iterations}`],
      {
        stdout: "pipe",
        stderr: "inherit",
      },
    );

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    const marker = "__JSON_RESULT__";
    const line = output.split("\n").find((l) => l.startsWith(marker));
    if (line) {
      const res: MemoryResult = JSON.parse(line.slice(marker.length));
      results.push(res);

      const name = res.name.padEnd(25);
      const dKb = `${res.heapDeltaKb} KB`.padStart(15);
      const bpReq = `${res.bytesPerReq} B/req`.padStart(15);
      const rssStr = `${res.finalRssMb} MB`.padStart(14);
      const dRss = `${res.rssDeltaMb >= 0 ? "+" : ""}${res.rssDeltaMb} MB`.padStart(14);

      console.log(`| ${name} | ${dKb} | ${bpReq} | ${rssStr} | ${dRss} |`);
    } else {
      console.error(`Failed to execute memory audit worker for [${targetId}]`);
    }
  }
  console.log("");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const workerArg = args.find((a) => a.startsWith("--worker="));
  const iterArg = args.find((a) => a.startsWith("--iterations="));

  if (workerArg) {
    const targetId = workerArg.split("=")[1];
    const iters = iterArg ? Number(iterArg.split("=")[1]) : 50_000;
    runWorker(targetId, iters).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else {
    runMemoryAudit(50_000).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
}
