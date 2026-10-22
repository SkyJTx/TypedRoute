/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect, vi } from "vitest";
import { createRoot, createSignal, createComponent } from "solid-js";
import { render } from "@solidjs/testing-library";
import * as v from "valibot";
import { RouteValidationError, inspectRoute } from "@skyjt/typed-routes";
import { SolidDefinedRoute, defineRoute } from "~/router/define-route";
import { RouteValidationProvider } from "~/context/route-context";
import type { RouteAccessorTuple } from "~/types/solid-route";

let currentParamsSignal: (() => Record<string, string | undefined>) | null = null;
let currentSearchSignal: (() => Record<string, string | undefined>) | null = null;

const paramsProxy = new Proxy({} as Record<string, string | undefined>, {
  get(_target, prop) {
    const val = currentParamsSignal ? currentParamsSignal() : undefined;
    return val ? val[prop as string] : undefined;
  },
  ownKeys(_target) {
    const val = currentParamsSignal ? currentParamsSignal() : undefined;
    return val ? Reflect.ownKeys(val) : [];
  },
  getOwnPropertyDescriptor(_target, prop) {
    const val = currentParamsSignal ? currentParamsSignal() : undefined;
    return val ? Reflect.getOwnPropertyDescriptor(val, prop) : undefined;
  },
});

const searchProxy = new Proxy({} as Record<string, string | undefined>, {
  get(_target, prop) {
    const val = currentSearchSignal ? currentSearchSignal() : undefined;
    return val ? val[prop as string] : undefined;
  },
  ownKeys(_target) {
    const val = currentSearchSignal ? currentSearchSignal() : undefined;
    return val ? Reflect.ownKeys(val) : [];
  },
  getOwnPropertyDescriptor(_target, prop) {
    const val = currentSearchSignal ? currentSearchSignal() : undefined;
    return val ? Reflect.getOwnPropertyDescriptor(val, prop) : undefined;
  },
});

vi.mock("@solidjs/router", () => ({
  useParams: () => paramsProxy,
  useSearchParams: () => [searchProxy, vi.fn()],
  useLocation: () => ({
    pathname: "/users/42",
    search: "",
    hash: "",
    query: {},
    state: null,
  }),
}));

describe("Fine-Grained Reactive Unwrapping & Route Definition", () => {
  describe("Success Cases", () => {
    it("shares all hook and handler methods on SolidDefinedRoute.prototype with a single in-object slot", () => {
      const routeA = defineRoute({
        params: v.object({ id: v.number() }),
      });
      const routeB = defineRoute({
        search: v.object({ tab: v.string() }),
      });

      expect(routeA).toBeInstanceOf(SolidDefinedRoute);
      expect(routeB).toBeInstanceOf(SolidDefinedRoute);
      expect(routeA.useParams).toBe(routeB.useParams);
      expect(routeA.useSearch).toBe(routeB.useSearch);
      expect(routeA.useLocation).toBe(routeB.useLocation);
      expect(routeA.handler).toBe(routeB.handler);
      expect(Object.keys(routeA)).toEqual(["config"]);
      expect(inspectRoute(routeA).paramsValidator).toBe("StandardSchema(valibot)");
    });

    it("returns [params, error] accessors like createSignal and yields [{ id: 42 }, undefined] on valid input", async () => {
      const onErrorMock = vi.fn();
      const userRoute = defineRoute({
        params: v.object({ id: v.number() }),
        search: v.object({ tab: v.optional(v.string(), "profile") }),
        onError: onErrorMock,
      });

      const [rawParams, setRawParams] = createSignal<Record<string, string | undefined>>({ id: "42" });
      const [rawSearch] = createSignal<Record<string, string | undefined>>({ tab: "settings" });
      currentParamsSignal = rawParams;
      currentSearchSignal = rawSearch;

      let paramsTuple!: RouteAccessorTuple<{ id: number }>;
      let searchTuple!: RouteAccessorTuple<{ tab: string }>;

      createRoot(() => {
        paramsTuple = userRoute.useParams();
        searchTuple = userRoute.useSearch();
      });

      const [params, paramsError] = paramsTuple;
      const [search, searchError] = searchTuple;

      expect(paramsError()).toBeUndefined();
      expect(params()).toEqual({ id: 42 });
      expect(searchError()).toBeUndefined();
      expect(search()).toEqual({ tab: "settings" });
      expect(onErrorMock).not.toHaveBeenCalled();

      setRawParams({ id: "43" });
      await Promise.resolve();
      expect(paramsError()).toBeUndefined();
      expect(params()?.id).toBe(43);
    });

    it("reactively transitions from valid -> invalid -> valid without remounting", async () => {
      const onErrorMock = vi.fn();
      const userRoute = defineRoute({
        params: v.object({ id: v.number() }),
        onError: onErrorMock,
      });

      const [rawParams, setRawParams] = createSignal<Record<string, string | undefined>>({ id: "42" });
      currentParamsSignal = rawParams;
      currentSearchSignal = () => ({});

      let mountCount = 0;
      let paramsTuple!: RouteAccessorTuple<{ id: number }>;

      createRoot(() => {
        mountCount++;
        paramsTuple = userRoute.useParams();
      });

      const [params, paramsError] = paramsTuple;

      expect(mountCount).toBe(1);
      expect(paramsError()).toBeUndefined();
      expect(params()).toEqual({ id: 42 });

      // Transition to invalid ("abc")
      setRawParams({ id: "abc" });
      await Promise.resolve();
      expect(mountCount).toBe(1);
      expect(params()).toBeUndefined();
      expect(paramsError()).toBeInstanceOf(RouteValidationError);
      expect(paramsError()?.target).toBe("params");
      expect(paramsError()?.rawParams).toEqual({ id: "abc" });
      expect(onErrorMock).toHaveBeenCalledTimes(1);

      // Transition back to valid ("99")
      setRawParams({ id: "99" });
      await Promise.resolve();
      expect(mountCount).toBe(1);
      expect(paramsError()).toBeUndefined();
      expect(params()).toEqual({ id: 99 });
    });

    it("operates identically inside RouteValidationProvider context", async () => {
      const userRoute = defineRoute({
        params: v.object({ id: v.number() }),
        search: v.object({ page: v.number() }),
      });

      const [rawParams, setRawParams] = createSignal<Record<string, string | undefined>>({ id: "10" });
      const [rawSearch, setRawSearch] = createSignal<Record<string, string | undefined>>({ page: "2" });
      currentParamsSignal = rawParams;
      currentSearchSignal = rawSearch;

      let paramsTuple!: RouteAccessorTuple<{ id: number }>;
      let searchTuple!: RouteAccessorTuple<{ page: number }>;

      function TestChild() {
        paramsTuple = userRoute.useParams();
        searchTuple = userRoute.useSearch();
        return document.createElement("div");
      }

      const { unmount } = render(() =>
        createComponent(RouteValidationProvider, {
          config: userRoute.config,
          get children() {
            return createComponent(TestChild, {});
          },
        }),
      );

      const [params, paramsError] = paramsTuple;
      const [search, searchError] = searchTuple;

      expect(paramsError()).toBeUndefined();
      expect(params()).toEqual({ id: 10 });
      expect(searchError()).toBeUndefined();
      expect(search()).toEqual({ page: 2 });

      setRawParams({ id: "invalid" });
      await Promise.resolve();
      expect(params()).toBeUndefined();
      expect(paramsError()).toBeInstanceOf(RouteValidationError);

      setRawSearch({ page: "bad" });
      await Promise.resolve();
      expect(search()).toBeUndefined();
      expect(searchError()).toBeInstanceOf(RouteValidationError);

      unmount();
    });

    it("binds typed API handler via route.handler() with inferred params and search", async () => {
      const apiRoute = defineRoute({
        params: v.object({ id: v.number() }),
        search: v.object({ verbose: v.optional(v.boolean(), false) }),
      });

      const handler = apiRoute.handler((event) => {
        return {
          id: event.params.id,
          verbose: event.search.verbose,
        };
      });

      const result = await handler({
        request: new Request("http://localhost/api/users/10?verbose=true"),
        params: { id: 10 },
        search: { verbose: true },
      });

      expect(result).toEqual({ id: 10, verbose: true });
    });
  });

  describe("Expected Failure & Error Boundary Cases", () => {
    it("returns [() => undefined, () => RouteValidationError] on failure and triggers onError with rawParams and rawSearch", () => {
      const onErrorMock = vi.fn();
      const userRoute = defineRoute({
        params: v.object({ id: v.number() }),
        search: v.object({ role: v.picklist(["admin", "operator"]) }),
        onError: onErrorMock,
      });

      currentParamsSignal = () => ({ id: "not-a-number" });
      currentSearchSignal = () => ({ role: "guest" });

      let paramsTuple!: RouteAccessorTuple<{ id: number }>;
      let searchTuple!: RouteAccessorTuple<{ role: "admin" | "operator" }>;

      createRoot(() => {
        paramsTuple = userRoute.useParams();
        searchTuple = userRoute.useSearch();
      });

      const [params, paramsError] = paramsTuple;
      const [search, searchError] = searchTuple;

      expect(params()).toBeUndefined();
      expect(paramsError()).toBeInstanceOf(RouteValidationError);
      expect(paramsError()?.target).toBe("params");
      expect(paramsError()?.rawParams).toEqual({ id: "not-a-number" });

      expect(search()).toBeUndefined();
      expect(searchError()).toBeInstanceOf(RouteValidationError);
      expect(searchError()?.target).toBe("search");
      expect(searchError()?.rawSearch).toEqual({ role: "guest" });

      expect(onErrorMock).toHaveBeenCalledTimes(2);
    });

    it("constructs RouteValidationError with rawParams and rawSearch context", () => {
      const err = new RouteValidationError(
        "params",
        [{ message: "Expected number, received nan", path: "id" }],
        {
          rawParams: { id: "d" },
          rawSearch: { tab: "info" },
        },
      );

      expect(err.name).toBe("RouteValidationError");
      expect(err.target).toBe("params");
      expect(err.rawParams).toEqual({ id: "d" });
      expect(err.rawSearch).toEqual({ tab: "info" });
      expect(err.message).toContain("Expected number, received nan");
    });
  });
});
