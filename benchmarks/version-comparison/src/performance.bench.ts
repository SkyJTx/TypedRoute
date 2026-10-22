/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { bench, group, summary } from "mitata";
import { current, v011, v040 } from "./targets";
import { fixtures, createMockRoutes } from "./fixtures";
import { isolates } from "./isolates";
import { forceGc } from "./memory.bench";
import { compile as compilePathToRegexp } from "path-to-regexp";
import * as ufo from "ufo";

export function registerPerformanceBenchmarks() {
  const sharedRouteConfig = {
    params: (raw: never) => ({ id: Number((raw as Record<string, unknown>).id) }),
    search: (raw: never) => raw as Record<string, unknown>,
  };

  // Group 0: Route Definition Instance Creation
  forceGc();
  group("0. Route Definition Instance Creation: defineRoute", () => {
    summary(() => {
      bench("Published v0.1.1 defineRoute", () => {
        v011.defineRoute(sharedRouteConfig);
      });

      bench("Published v0.4.0 defineRoute", () => {
        v040.defineRoute(sharedRouteConfig);
      });

      bench("Current v0.5.0 defineRoute (Prototype Shared)", () => {
        current.defineRoute(sharedRouteConfig);
      });
    });
  });

  // Group 1: Static Route Construction
  forceGc();
  group("1. URL Construction: Static Route", () => {
    summary(() => {
      bench("Published v0.1.1 buildUrl", () => {
        v011.buildUrl(fixtures.static.pattern);
      });

      bench("Published v0.4.0 buildUrl", () => {
        v040.buildUrl(fixtures.static.pattern);
      });

      bench("Current v0.5.0 buildUrl", () => {
        current.buildUrl(fixtures.static.pattern);
      });

      bench("Candidate Isolate: Static Fast-Path", () => {
        isolates.buildUrlStaticFast(fixtures.static.pattern);
      });
    });
  });

  // Group 2: Dynamic Single Parameter
  const pathToRegexpSingle = compilePathToRegexp(fixtures.singleParam.pattern);
  const singleParamStringified = { id: String(fixtures.singleParam.params.id) };

  forceGc();
  group("2. URL Construction: Dynamic Single Parameter", () => {
    summary(() => {
      bench("Published v0.1.1 buildUrl", () => {
        v011.buildUrl(fixtures.singleParam.pattern, { params: fixtures.singleParam.params });
      });

      bench("Published v0.4.0 buildUrl", () => {
        v040.buildUrl(fixtures.singleParam.pattern, { params: fixtures.singleParam.params });
      });

      bench("Current v0.5.0 buildUrl", () => {
        current.buildUrl(fixtures.singleParam.pattern, { params: fixtures.singleParam.params });
      });

      bench("Candidate Isolate: buildUrlStaticFast", () => {
        isolates.buildUrlStaticFast(fixtures.singleParam.pattern, { params: fixtures.singleParam.params });
      });

      bench("Ecosystem path-to-regexp (Stringified Params)", () => {
        pathToRegexpSingle(singleParamStringified);
      });
    });
  });

  // Group 3: Complex Multi-Param + Array Search + Hash
  const pathToRegexpComplex = compilePathToRegexp("/orgs/:orgId/projects/:projectId/issues{/:issueId}");
  const complexParamsStringified = {
    orgId: fixtures.complex.params.orgId,
    projectId: fixtures.complex.params.projectId,
    issueId: String(fixtures.complex.params.issueId),
  };

  forceGc();
  group("3. URL Construction: Complex Multi-Param + Array Search + Hash", () => {
    summary(() => {
      bench("Published v0.1.1 buildUrl", () => {
        v011.buildUrl(fixtures.complex.pattern, {
          params: fixtures.complex.params,
          search: fixtures.complex.search,
          hash: fixtures.complex.hash,
        });
      });

      bench("Published v0.4.0 buildUrl", () => {
        v040.buildUrl(fixtures.complex.pattern, {
          params: fixtures.complex.params,
          search: fixtures.complex.search,
          hash: fixtures.complex.hash,
        });
      });

      bench("Current v0.5.0 buildUrl", () => {
        current.buildUrl(fixtures.complex.pattern, {
          params: fixtures.complex.params,
          search: fixtures.complex.search,
          hash: fixtures.complex.hash,
        });
      });

      bench("Candidate Isolate: buildUrlStaticFast", () => {
        isolates.buildUrlStaticFast(fixtures.complex.pattern, {
          params: fixtures.complex.params,
          search: fixtures.complex.search,
          hash: fixtures.complex.hash,
        });
      });

      bench("Ecosystem path-to-regexp + ufo.withQuery", () => {
        const path = pathToRegexpComplex(complexParamsStringified);
        ufo.withQuery(path + "#" + fixtures.complex.hash, fixtures.complex.search);
      });
    });
  });

  // Group 4: URL Parsing
  forceGc();
  group("4. URL Parsing: Host & Pathname Extraction", () => {
    summary(() => {
      bench("Published v0.1.1 new URL(url) (C++ Host Allocation)", () => {
        const url = new URL(fixtures.urls.full);
        return url.pathname;
      });

      bench("Published v0.4.0 parseFastUrl", () => {
        v040.parseFastUrl(fixtures.urls.full);
      });

      bench("Current v0.5.0 parseFastUrl (Monomorphic ParsedUrl)", () => {
        current.parseFastUrl(fixtures.urls.full);
      });

      bench("Candidate Isolate: parseFastUrlPathFirst", () => {
        isolates.parseFastUrlPathFirst(fixtures.urls.full);
      });

      bench("Ecosystem ufo.parseURL", () => {
        ufo.parseURL(fixtures.urls.full);
      });
    });
  });

  // Group 5: Query Parameter Parsing
  forceGc();
  group("5. Query Parameter Parsing: Multi-key & Arrays", () => {
    summary(() => {
      bench("Published v0.1.1 normalizeSearchParams", () => {
        v011.normalizeSearchParams(fixtures.urls.query);
      });

      bench("Published v0.4.0 normalizeSearchParams", () => {
        v040.normalizeSearchParams(fixtures.urls.query);
      });

      bench("Current v0.5.0 normalizeSearchParams", () => {
        current.normalizeSearchParams(fixtures.urls.query);
      });

      bench("Candidate Isolate: normalizeSearchParamsNullProto", () => {
        isolates.normalizeSearchParamsNullProto(fixtures.urls.query);
      });

      bench("Ecosystem ufo.parseQuery", () => {
        ufo.parseQuery(fixtures.urls.query);
      });

      bench("Native Web URLSearchParams.entries()", () => {
        const sp = new URLSearchParams(fixtures.urls.query);
        const res: Record<string, unknown> = {};
        for (const [k, v] of sp.entries()) {
          const ex = res[k];
          if (ex !== undefined) {
            if (Array.isArray(ex)) {
              ex.push(v);
            } else {
              res[k] = [ex, v];
            }
          } else {
            res[k] = v;
          }
        }
        return res;
      });
    });
  });

  // Group 6: Full Middleware Pipeline
  const routesV011 = createMockRoutes(
    v011.defineRoute as unknown as Parameters<typeof createMockRoutes>[0],
  );
  const routesV040 = createMockRoutes(
    v040.defineRoute as unknown as Parameters<typeof createMockRoutes>[0],
  );
  const routesCur = createMockRoutes(
    current.defineRoute as unknown as Parameters<typeof createMockRoutes>[0],
  );

  const v011Middleware = v011.createMiddleware(
    routesV011 as unknown as Parameters<typeof v011.createMiddleware>[0],
  );
  const v040Middleware = v040.createMiddleware(routesV040);
  const currentMiddleware = current.createMiddleware(routesCur);
  const streamlinedMiddleware = isolates.createStreamlinedMiddleware(routesCur);
  const dummyNext = async () => new Response("fallback");

  forceGc();
  group("6. Full Middleware Request Pipeline", () => {
    summary(() => {
      bench("Published v0.1.1 createMiddleware", async () => {
        await v011Middleware(fixtures.urls.request, dummyNext);
      });

      bench("Published v0.4.0 createMiddleware", async () => {
        await v040Middleware(fixtures.urls.request, dummyNext);
      });

      bench("Current v0.5.0 createMiddleware", async () => {
        await currentMiddleware(fixtures.urls.request, dummyNext);
      });

      bench("Candidate Isolate: createStreamlinedMiddleware", async () => {
        await streamlinedMiddleware(fixtures.urls.request, dummyNext);
      });
    });
  });
}