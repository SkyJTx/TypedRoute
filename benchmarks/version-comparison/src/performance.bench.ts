/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { bench, group, summary } from "mitata";
import { current, v011, v040, v061 } from "./targets";
import { fixtures, createMockRoutes } from "./fixtures";
import { forceGc } from "./memory.bench";

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

      bench("Published v0.6.1 defineRoute", () => {
        v061.defineRoute(sharedRouteConfig);
      });

      bench("Current defineRoute (Prototype Shared)", () => {
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

      bench("Published v0.6.1 buildUrl", () => {
        v061.buildUrl(fixtures.static.pattern);
      });

      bench("Current buildUrl", () => {
        current.buildUrl(fixtures.static.pattern);
      });
    });
  });

  // Group 2: Dynamic Single Parameter
  forceGc();
  group("2. URL Construction: Dynamic Single Parameter", () => {
    summary(() => {
      bench("Published v0.1.1 buildUrl", () => {
        v011.buildUrl(fixtures.singleParam.pattern, { params: fixtures.singleParam.params });
      });

      bench("Published v0.4.0 buildUrl", () => {
        v040.buildUrl(fixtures.singleParam.pattern, { params: fixtures.singleParam.params });
      });

      bench("Published v0.6.1 buildUrl", () => {
        v061.buildUrl(fixtures.singleParam.pattern, { params: fixtures.singleParam.params });
      });

      bench("Current buildUrl", () => {
        current.buildUrl(fixtures.singleParam.pattern, { params: fixtures.singleParam.params });
      });
    });
  });

  // Group 3: Complex Multi-Param + Array Search + Hash
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

      bench("Published v0.6.1 buildUrl", () => {
        v061.buildUrl(fixtures.complex.pattern, {
          params: fixtures.complex.params,
          search: fixtures.complex.search,
          hash: fixtures.complex.hash,
        });
      });

      bench("Current buildUrl", () => {
        current.buildUrl(fixtures.complex.pattern, {
          params: fixtures.complex.params,
          search: fixtures.complex.search,
          hash: fixtures.complex.hash,
        });
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

      bench("Published v0.6.1 parseFastUrl", () => {
        v061.parseFastUrl(fixtures.urls.full);
      });

      bench("Current parseFastUrl (Monomorphic ParsedUrl)", () => {
        current.parseFastUrl(fixtures.urls.full);
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

      bench("Published v0.6.1 normalizeSearchParams", () => {
        v061.normalizeSearchParams(fixtures.urls.query);
      });

      bench("Current normalizeSearchParams", () => {
        current.normalizeSearchParams(fixtures.urls.query);
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
  const routesV061 = createMockRoutes(
    v061.defineRoute as unknown as Parameters<typeof createMockRoutes>[0],
  );
  const routesCur = createMockRoutes(
    current.defineRoute as unknown as Parameters<typeof createMockRoutes>[0],
  );

  const v011Middleware = v011.createMiddleware(
    routesV011 as unknown as Parameters<typeof v011.createMiddleware>[0],
  );
  const v040Middleware = v040.createMiddleware(routesV040);
  const v061Middleware = v061.createMiddleware(routesV061);
  const currentMiddleware = current.createMiddleware(routesCur);
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

      bench("Published v0.6.1 createMiddleware", async () => {
        await v061Middleware(fixtures.urls.request, dummyNext);
      });

      bench("Current createMiddleware", async () => {
        await currentMiddleware(fixtures.urls.request, dummyNext);
      });
    });
  });
}