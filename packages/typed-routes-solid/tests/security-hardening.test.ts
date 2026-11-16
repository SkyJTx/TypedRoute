/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createComponent } from "solid-js";
import { render } from "@solidjs/testing-library";
import { createBoundLink } from "~/components/link";
import { useNavigate } from "~/hooks/use-navigate";
import { interceptFileRoutes } from "~/interceptor/interceptor";

const mockNativeNavigate = vi.fn();

vi.mock("@solidjs/router", () => ({
  useNavigate: () => mockNativeNavigate,
  useParams: () => ({}),
  useSearchParams: () => [{}, vi.fn()],
  useLocation: () => ({
    pathname: "/",
    search: "",
    hash: "",
    query: {},
    state: null,
  }),
}));

describe("Solid Adapter Security Hardening: Link, useNavigate & Interceptor", () => {
  beforeEach(() => {
    mockNativeNavigate.mockClear();
  });

  it("sanitizes unsafe URI schemes and protocol-relative hrefs in Link", () => {
    const mockManifest = [{ path: "/", page: true }] as const;
    const BoundLink = createBoundLink<typeof mockManifest>();

    const { container: xssContainer } = render(() =>
      createComponent(BoundLink as unknown as (props: Record<string, unknown>) => never, {
        to: "javascript:alert(document.domain)",
        children: "XSS",
      }),
    );
    expect(xssContainer.querySelector("a")?.getAttribute("href")).toBe("about:blank");

    const { container: crossContainer } = render(() =>
      createComponent(BoundLink as unknown as (props: Record<string, unknown>) => never, {
        app: "evil",
        apps: { evil: { baseUrl: "javascript:" } },
        to: "/alert",
        children: "EvilCrossApp",
      }),
    );
    expect(crossContainer.querySelector("a")?.getAttribute("href")).toBe("about:blank");

    const { container: relContainer } = render(() =>
      createComponent(BoundLink as unknown as (props: Record<string, unknown>) => never, {
        to: "//attacker.com/phish",
        children: "Phish",
      }),
    );
    expect(relContainer.querySelector("a")?.getAttribute("href")).toBe("/attacker.com/phish");
  });

  it("enforces rel=noopener noreferrer when target=_blank on Link", () => {
    const mockManifest = [{ path: "/", page: true }] as const;
    const BoundLink = createBoundLink<typeof mockManifest>();

    const { container: defaultRel } = render(() =>
      createComponent(BoundLink as unknown as (props: Record<string, unknown>) => never, {
        to: "/",
        target: "_blank",
        children: "Open",
      }),
    );
    expect(defaultRel.querySelector("a")?.getAttribute("rel")).toBe("noopener noreferrer");

    const { container: customRel } = render(() =>
      createComponent(BoundLink as unknown as (props: Record<string, unknown>) => never, {
        to: "/",
        target: "_blank",
        rel: "external",
        children: "Open Custom",
      }),
    );
    expect(customRel.querySelector("a")?.getAttribute("rel")).toBe("external noopener noreferrer");
  });

  it("rejects unsafe protocols and collapses leading // in useNavigate", () => {
    const mockManifest = [{ path: "/", page: true }] as const;
    const navigate = useNavigate<typeof mockManifest>() as unknown as (to: string) => void;

    expect(() => navigate("javascript:alert(1)")).toThrow(TypeError);
    expect(() => navigate("data:text/html,<script>")).toThrow(TypeError);
    expect(() => navigate("vbscript:msgbox(1)")).toThrow(TypeError);
    expect(mockNativeNavigate).not.toHaveBeenCalled();

    navigate("//attacker.com/login");
    expect(mockNativeNavigate).toHaveBeenCalledWith("/attacker.com/login", {
      replace: undefined,
      scroll: undefined,
      state: undefined,
    });
  });

  it("handles frozen lazy refs and missing src without mutating or colliding in interceptFileRoutes", () => {
    const frozenRefA = Object.freeze({
      src: "\\routes\\a.tsx",
      import: () => Promise.resolve({ default: () => "A" }),
    });
    const missingSrcRef1 = {
      src: "",
      import: () => Promise.resolve({ default: () => "B" }),
    };
    const missingSrcRef2 = {
      src: "",
      import: () => Promise.resolve({ default: () => "C" }),
    };

    const intercepted = interceptFileRoutes([
      { path: "/a", page: true, $component: frozenRefA },
      { path: "/b", page: true, $component: missingSrcRef1 },
      { path: "/c", page: true, $component: missingSrcRef2 },
    ] as unknown as readonly unknown[]);

    expect(intercepted).toHaveLength(3);
    expect(intercepted[1]?.component).not.toBe(intercepted[2]?.component);
  });
});
