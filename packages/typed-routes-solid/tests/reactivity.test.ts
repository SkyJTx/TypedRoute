import { describe, it, expect } from "vitest";
import { createRoot, createSignal, createMemo, type Accessor } from "solid-js";
import * as v from "valibot";
import { validateData } from "@skyjt/typed-routes";
import { defineRoute } from "~/router/define-route";

describe("Fine-Grained Reactive Unwrapping", () => {
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
});