/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const fixtures = {
  static: {
    pattern: "/dashboard/analytics/overview",
  },
  singleParam: {
    pattern: "/users/:id/profile",
    params: { id: 10482 },
  },
  complex: {
    pattern: "/orgs/:orgId/projects/:projectId/issues/:issueId?",
    params: { orgId: "fortress", projectId: "meropide-steambox", issueId: 4096 },
    search: {
      tab: "activity",
      filter: ["urgent", "structural", "tea-log"],
      page: 1,
      limit: 50,
    },
    hash: "history",
  },
  urls: {
    full: "https://meropide.fontaine.gov/orgs/fortress/projects/steambox/issues/4096?tab=activity&filter=urgent&filter=structural&page=1#history",
    query: "tab=activity&filter=urgent&filter=structural&page=1",
    request: new Request("https://localhost:3000/api/users/1234?tab=settings"),
  },
};

export function createMockRoutes(
  defineRouteFn: (cfg: {
    params: (raw: Record<string, unknown>) => { id: number };
    search: (raw: Record<string, unknown>) => Record<string, unknown>;
  }) => unknown,
) {
  const testRoute = defineRouteFn({
    params: (raw: Record<string, unknown>) => ({ id: Number(raw.id) }),
    search: (raw: Record<string, unknown>) => raw,
  });

  return [
    {
      path: "/api/users/:id",
      $GET: {
        require: () => ({
          GET: () => new Response("ok"),
        }),
      },
      $$route: {
        require: () => ({
          route: testRoute,
        }),
      },
    },
  ] as const;
}