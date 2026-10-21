/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect, vi } from "vitest";
import * as v from "valibot";
import { interceptFileRoutes } from "~/interceptor/interceptor";
import { defineRoute } from "~/router/define-route";

describe("Route Manifest Interceptor (interceptFileRoutes)", () => {
  describe("Success Cases", () => {
    it("intercepts file route manifest and executes validated preload", async () => {
      const onErrorMock = vi.fn();
      const preloadMock = vi.fn((args: { params: { id: number }; search: { tab?: string } }) => {
        return { userId: args.params.id, tab: args.search.tab };
      });

      const userRoute = defineRoute({
        params: v.object({
          id: v.number(),
        }),
        search: v.object({
          tab: v.optional(v.string()),
        }),
        preload: preloadMock,
        onError: onErrorMock,
      });

      const manifest = [
        {
          path: "/users/:id",
          page: true,
          $component: {
            src: "/routes/users/[id].tsx",
            require: () => ({
              default: () => "User Component",
            }),
          },
          $$route: {
            require: () => ({
              route: userRoute,
            }),
          },
        },
      ] as const;

      const intercepted = interceptFileRoutes(manifest);

      expect(intercepted).toHaveLength(1);
      expect(intercepted[0].path).toBe("/users/:id");
      expect(intercepted[0].component).toBeDefined();
      expect(intercepted[0].preload).toBeDefined();

      const preloadResult = await (intercepted[0].preload as (args: unknown) => unknown)({
        params: { id: "42" },
        location: { query: { tab: "profile" } },
      });

      expect(preloadMock).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { id: 42 },
          search: { tab: "profile" },
        }),
      );
      expect(preloadResult).toEqual({ userId: 42, tab: "profile" });
      expect(onErrorMock).not.toHaveBeenCalled();
    });

    it("normalizes Windows backslashes in lazy component module paths to POSIX forward slashes", () => {
      const dummyComponent = () => "Dummy";
      const manifest = [
        {
          path: "/profile",
          page: true,
          $component: {
            src: "src\\routes\\(main)\\profile.tsx?pick=default&pick=$css&lang.tsx",
            import: () => Promise.resolve({ default: dummyComponent }),
          },
        },
      ] as const;

      const intercepted = interceptFileRoutes(manifest);
      expect(intercepted).toHaveLength(1);
      expect(intercepted[0].component).toBeDefined();
      expect(manifest[0].$component.src).toBe(
        "src/routes/(main)/profile.tsx?pick=default&pick=$css&lang.tsx",
      );
    });

    it("lazily resolves $$route.require() when circular SSR imports are still evaluating at intercept time", async () => {
      let isEvaluated = false;
      const preloadMock = vi.fn((args: { params: { id: number } }) => args.params.id);

      const userRoute = defineRoute({
        params: v.object({ id: v.number() }),
        preload: preloadMock,
      });

      const manifest = [
        {
          path: "/users/:id",
          page: true,
          $component: {
            src: "/routes/users/[id].tsx",
            require: () => ({
              default: () => "User Component",
            }),
          },
          $$route: {
            require: () => {
              if (!isEvaluated) {
                throw new ReferenceError("Cannot access 'routeData0' before initialization");
              }
              return { route: userRoute };
            },
          },
        },
      ] as const;

      // Should not throw during interceptFileRoutes even while routeData0 is in TDZ
      const intercepted = interceptFileRoutes(manifest);
      expect(intercepted).toHaveLength(1);

      // Once module evaluation completes, preload resolves userRoute lazily
      isEvaluated = true;
      const res = await (intercepted[0].preload as (args: unknown) => unknown)({
        params: { id: "77" },
        location: { query: {} },
      });
      expect(res).toBe(77);
      expect(preloadMock).toHaveBeenCalledWith(
        expect.objectContaining({ params: { id: 77 } }),
      );
    });
  });

  describe("Expected Failure & Validation Error Cases", () => {
    it("triggers onError callback with rawParams and rawSearch on invalid parameters during preload", async () => {
      const onErrorMock = vi.fn();

      const userRoute = defineRoute({
        params: v.object({
          id: v.number(),
        }),
        preload: () => "ok",
        onError: onErrorMock,
      });

      const manifest = [
        {
          path: "/users/:id",
          page: true,
          $component: {
            src: "/routes/users/[id].tsx",
            require: () => ({
              default: () => "User Component",
            }),
          },
          $$route: {
            require: () => ({
              route: userRoute,
            }),
          },
        },
      ] as const;

      const intercepted = interceptFileRoutes(manifest);

      await (intercepted[0].preload as (args: unknown) => unknown)({
        params: { id: "not-a-number" },
        location: { query: { filter: "active" } },
      });

      expect(onErrorMock).toHaveBeenCalledTimes(1);
      const callArg = onErrorMock.mock.calls[0][0];
      expect(callArg.error.target).toBe("params");
      expect(callArg.error.rawParams).toEqual({ id: "not-a-number" });
      expect(callArg.error.rawSearch).toEqual({ filter: "active" });
    });

    it("triggers onError callback on invalid search query during preload", async () => {
      const onErrorMock = vi.fn();

      const searchRoute = defineRoute({
        search: v.object({
          role: v.picklist(["admin", "operator"]),
        }),
        preload: () => "ok",
        onError: onErrorMock,
      });

      const manifest = [
        {
          path: "/users/",
          page: true,
          $component: {
            src: "/routes/users/index.tsx",
            require: () => ({
              default: () => "Users List",
            }),
          },
          $$route: {
            require: () => ({
              route: searchRoute,
            }),
          },
        },
      ] as const;

      const intercepted = interceptFileRoutes(manifest);

      await (intercepted[0].preload as (args: unknown) => unknown)({
        params: {},
        location: { query: { role: "invalid_role" } },
      });

      expect(onErrorMock).toHaveBeenCalledTimes(1);
      const callArg = onErrorMock.mock.calls[0][0];
      expect(callArg.error.target).toBe("search");
      expect(callArg.error.rawSearch).toEqual({ role: "invalid_role" });
    });
  });
});