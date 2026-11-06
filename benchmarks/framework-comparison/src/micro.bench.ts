/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { bench, group, run, summary } from "mitata";
import { app as elysiaApp } from "@framework-benchmark/elysia";
import { fetch as trFetch } from "@framework-benchmark/typed-routes";
import { app as honoApp } from "@framework-benchmark/hono";
import { app as h3App } from "@framework-benchmark/h3";

export async function runMicroBenchmarks(): Promise<void> {
  console.log("=========================================================================");
  console.log("  IN-MEMORY DISPATCH MICRO-BENCHMARKS (Mitata JIT Profiler)");
  console.log("  Evaluating pure routing, parameter decoding, and handler dispatch (ns/op)");
  console.log("  Request templates hoisted; response body stream fully consumed.");
  console.log("=========================================================================\n");

  const elysiaFetch = (req: Request) => elysiaApp.fetch(req);
  const honoFetch = (req: Request) => honoApp.fetch(req);
  const h3Fetch = (req: Request) => h3App.fetch(req);

  // Hoisted Pre-Allocated GET Requests
  const reqStatic = new Request("http://localhost/");
  const reqDynamic = new Request("http://localhost/user/42");
  const reqQuery = new Request("http://localhost/items?category=tools&limit=50");

  // Hoisted Pre-Serialized POST Payload
  const postUrl = "http://localhost/user";
  const postBody = JSON.stringify({ name: "Wriothesley", role: "Administrator" });
  const postHeaders = { "Content-Type": "application/json" };
  const createPostReq = () =>
    new Request(postUrl, {
      method: "POST",
      headers: postHeaders,
      body: postBody,
    });

  // Group 1: Static Route
  group("1. In-Memory Dispatch: Static Route (GET /)", () => {
    summary(() => {
      bench("Elysia (AOT 2.0 RC)", async () => {
        const res = await elysiaFetch(reqStatic);
        await res.text();
      });
      bench("@skyjt/typed-routes", async () => {
        const res = await trFetch(reqStatic);
        await res.text();
      });
      bench("Hono", async () => {
        const res = await honoFetch(reqStatic);
        await res.text();
      });
      bench("H3 (v2)", async () => {
        const res = await h3Fetch(reqStatic);
        await res.text();
      });
    });
  });

  // Group 2: Dynamic Route Parameter
  group("2. In-Memory Dispatch: Dynamic Param (GET /user/:id)", () => {
    summary(() => {
      bench("Elysia (AOT 2.0 RC)", async () => {
        const res = await elysiaFetch(reqDynamic);
        await res.text();
      });
      bench("@skyjt/typed-routes", async () => {
        const res = await trFetch(reqDynamic);
        await res.text();
      });
      bench("Hono", async () => {
        const res = await honoFetch(reqDynamic);
        await res.text();
      });
      bench("H3 (v2)", async () => {
        const res = await h3Fetch(reqDynamic);
        await res.text();
      });
    });
  });

  // Group 3: Query Parameter Parsing
  group("3. In-Memory Dispatch: Query Params (GET /items?category=tools&limit=50)", () => {
    summary(() => {
      bench("Elysia (AOT 2.0 RC)", async () => {
        const res = await elysiaFetch(reqQuery);
        await res.text();
      });
      bench("@skyjt/typed-routes", async () => {
        const res = await trFetch(reqQuery);
        await res.text();
      });
      bench("Hono", async () => {
        const res = await honoFetch(reqQuery);
        await res.text();
      });
      bench("H3 (v2)", async () => {
        const res = await h3Fetch(reqQuery);
        await res.text();
      });
    });
  });

  // Group 4: POST JSON Payload
  group("4. In-Memory Dispatch: POST JSON Echo", () => {
    summary(() => {
      bench("Elysia (AOT 2.0 RC)", async () => {
        const res = await elysiaFetch(createPostReq());
        await res.text();
      });
      bench("@skyjt/typed-routes", async () => {
        const res = await trFetch(createPostReq());
        await res.text();
      });
      bench("Hono", async () => {
        const res = await honoFetch(createPostReq());
        await res.text();
      });
      bench("H3 (v2)", async () => {
        const res = await h3Fetch(createPostReq());
        await res.text();
      });
    });
  });

  await run();
}

if (import.meta.main) {
  runMicroBenchmarks().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
