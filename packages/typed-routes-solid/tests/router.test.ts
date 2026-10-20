/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect } from "vitest";
import { createRouter } from "~/router/create-router";
import { Link } from "~/components/link";

describe("Router, Link, and useNavigate API", () => {
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

  it("creates router instance exposing Link and useNavigate", () => {
    const router = createRouter<typeof mockManifest>({
      routes: [
        { path: "/", component: () => "Home" },
        { path: "/users/:id", component: () => "User" },
      ],
    });

    expect(router.Router).toBeDefined();
    expect(router.Link).toBeDefined();
    expect(router.useNavigate).toBeDefined();
    expect(router.paths.build("/users/:id", { params: { id: "42" as never } })).toBe("/users/42");
  });

  it("builds href with params and search options in Link", () => {
    const element = Link<typeof mockManifest, "/users/:id">({
      to: "/users/:id",
      params: { id: "100" as never },
      search: { tab: "details" } as never,
      class: "custom-class",
    });

    expect(element).toBeDefined();
  });
});