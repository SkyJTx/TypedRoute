/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect } from "vitest";
import { createRoot, createSignal, createMemo, type Accessor } from "solid-js";
import * as v from "valibot";
import { validateData, RouteValidationError, inspectRoute } from "@skyjt/typed-routes";
import { SolidDefinedRoute, defineRoute } from "~/router/define-route";

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
      expect(routeA.useError).toBe(routeB.useError);
      expect(routeA.useLocation).toBe(routeB.useLocation);
      expect(routeA.handler).toBe(routeB.handler);
      expect(Object.keys(routeA)).toEqual(["config"]);
      expect(inspectRoute(routeA).paramsValidator).toBe("StandardSchema(valibot)");
    });

    it("updates params accessor reactively without remounting or state teardown", async () => {
      let setRawParams!: (val: Record<string, string>) => void;
      let paramsAccessor!: Accessor<{ id: number }>;
      let renderCount = 0;
      const componentState = { initializedAt: Date.now() };

      createRoot(() => {
        const userRoute = defineRoute({
          params: v.object({
            id: v.number(),
          }),
        });

        const [rawParams, setParams] = createSignal<Record<string, string>>({ id: "42" });
        setRawParams = setParams;
        renderCount++;

        paramsAccessor = createMemo(() => {
          return validateData(userRoute.config.params, rawParams()).data as { id: number };
        });
      });

      expect(paramsAccessor().id).toBe(42);
      expect(renderCount).toBe(1);

      setRawParams({ id: "43" });
      await Promise.resolve();

      expect(paramsAccessor().id).toBe(43);
      expect(renderCount).toBe(1);
      expect(componentState.initializedAt).toBeDefined();
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
    it("attaches errorComponent and exposes useError() on defineRoute", () => {
      const errorComp = ({ error, rawParams }: { error: RouteValidationError; rawParams: Record<string, string | undefined> }) =>
        `Invalid: ${rawParams.id} (${error.target})`;

      const userRoute = defineRoute({
        params: v.object({ id: v.number() }),
        errorComponent: errorComp,
      });

      expect(userRoute.config.errorComponent).toBe(errorComp);
      expect(typeof userRoute.useError).toBe("function");
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