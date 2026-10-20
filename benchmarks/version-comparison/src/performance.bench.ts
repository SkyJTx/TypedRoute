import { bench, group, summary } from "mitata";
import { current, published } from "./targets";
import { fixtures, createMockRoutes } from "./fixtures";

export function registerPerformanceBenchmarks() {
  group("1. URL Construction: Static Route", () => {
    summary(() => {
      bench("Published v0.1.1 buildUrl", () => {
        published.buildUrl(fixtures.static.pattern);
      });

      bench("Current (Optimized Branch) buildUrl", () => {
        current.buildUrl(fixtures.static.pattern);
      });
    });
  });

  group("2. URL Construction: Dynamic Single Parameter", () => {
    summary(() => {
      bench("Published v0.1.1 buildUrl", () => {
        published.buildUrl(fixtures.singleParam.pattern, { params: fixtures.singleParam.params });
      });

      bench("Current (Optimized Branch) buildUrl", () => {
        current.buildUrl(fixtures.singleParam.pattern, { params: fixtures.singleParam.params });
      });
    });
  });

  group("3. URL Construction: Complex Multi-Param + Array Search + Hash", () => {
    summary(() => {
      bench("Published v0.1.1 buildUrl", () => {
        published.buildUrl(fixtures.complex.pattern, {
          params: fixtures.complex.params,
          search: fixtures.complex.search,
          hash: fixtures.complex.hash,
        });
      });

      bench("Current (Optimized Branch) buildUrl", () => {
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
      bench("Native new URL(url) (C++ Host Allocation)", () => {
        const url = new URL(fixtures.urls.full);
        return url.pathname;
      });

      bench("Current parseFastUrl (ASCII Scanner)", () => {
        current.parseFastUrl(fixtures.urls.full);
      });
    });
  });

  group("5. Query Parameter Parsing: Multi-key & Arrays", () => {
    summary(() => {
      bench("Published v0.1.1 normalizeSearchParams", () => {
        published.normalizeSearchParams(fixtures.urls.query);
      });

      bench("Current normalizeSearchParams", () => {
        current.normalizeSearchParams(fixtures.urls.query);
      });
    });
  });

  const routes = createMockRoutes(current.defineRoute);
  const publishedMiddleware = published.createMiddleware(routes as any);
  const currentMiddleware = current.createMiddleware(routes as any);
  const dummyNext = async () => new Response("fallback");

  group("6. Full Middleware Request Pipeline", () => {
    summary(() => {
      bench("Published v0.1.1 createMiddleware", async () => {
        await publishedMiddleware(fixtures.urls.request, dummyNext);
      });

      bench("Current createMiddleware", async () => {
        await currentMiddleware(fixtures.urls.request, dummyNext);
      });
    });
  });
}
