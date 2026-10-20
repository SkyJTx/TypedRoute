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

export function createMockRoutes(defineRouteFn: any) {
  const testRoute = defineRouteFn({
    params: (raw: any) => ({ id: Number(raw.id) }),
    search: (raw: any) => raw,
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
