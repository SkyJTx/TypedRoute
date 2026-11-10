/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect } from "vitest";
import { createRouter } from "~/router/create-router";
import { Link } from "~/components/link";

describe("Router, Link, and useNavigate API (Local & Cross-App)", () => {
  const mockManifest = [
    {
      path: "/",
      page: true,
    },
    {
      path: "/users/:id",
      page: true,
    },
  ] as const;

  const adminManifest = [
    {
      path: "/",
      page: true,
    },
    {
      path: "/audit/:reportId",
      page: true,
    },
  ] as const;

  type AppRegistry = {
    admin: typeof adminManifest;
  };

  it("creates router instance exposing Link, useNavigate, and unified local + cross-app paths.build", () => {
    const router = createRouter<typeof mockManifest, AppRegistry>({
      routes: [
        { path: "/", component: () => "Home" },
        { path: "/users/:id", component: () => "User" },
      ],
      apps: {
        admin: { baseUrl: "https://admin.example.com" },
      },
    });

    expect(router.Router).toBeDefined();
    expect(router.Link).toBeDefined();
    expect(router.useNavigate).toBeDefined();
    expect(router.paths.build("/users/:id", { params: { id: 42 } })).toBe("/users/42");
    expect(
      router.paths.build("admin", "/audit/:reportId", {
        params: { reportId: "rep-9" },
        search: { format: "pdf" },
      }),
    ).toBe("https://admin.example.com/audit/rep-9?format=pdf");
  });

  it("builds href with params and search options in Link without casts", () => {
    const element = Link<typeof mockManifest, "/users/:id">({
      to: "/users/:id",
      params: { id: "100" },
      search: { tab: "details" },
      class: "custom-class",
    });

    expect(element).toBeDefined();
  });
});
