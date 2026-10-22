/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { bench, group, summary } from "mitata";
import { current, v011, v040 } from "./targets";
import { fixtures, createMockRoutes } from "./fixtures";

export function registerPerformanceBenchmarks() {
  const sharedRouteConfig = {
    params: (raw: never) => ({ id: Number((raw as Record<string, unknown>).id) }),
    search: (raw: never) => raw as Record<string, unknown>,
  };

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
    });
  });

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
    });
  });

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
    });
  });

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
    });
  });

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
    });
  });

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
  const dummyNext = async () => new Response("fallback");

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
    });
  });
}