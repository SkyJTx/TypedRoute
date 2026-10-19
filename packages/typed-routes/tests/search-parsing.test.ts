import { describe, it, expect } from "vitest";
import * as v from "valibot";
import { normalizeSearchParams } from "~/schema/coercion";
import { buildUrl } from "~/router/path-builder";
import { validateData } from "~/schema/validator-adapter";

describe("Search Parameter Normalization and Parsing", () => {
  it("normalizes single scalar search keys", () => {
    const raw = "?tab=settings&mode=dark";
    const result = normalizeSearchParams(raw);
    expect(result).toEqual({
      tab: "settings",
      mode: "dark",
    });
  });

  it("normalizes repeated search keys into arrays", () => {
    const raw = "?tag=solid&tag=router&tag=typed";
    const result = normalizeSearchParams(raw);
    expect(result).toEqual({
      tag: ["solid", "router", "typed"],
    });
  });

  it("validates array search parameters through schema", () => {
    const searchSchema = v.object({
      tab: v.string(),
      tag: v.array(v.string()),
    });

    const normalized = normalizeSearchParams("?tab=overview&tag=fontaine&tag=meropide");
    const result = validateData(searchSchema, normalized);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      tab: "overview",
      tag: ["fontaine", "meropide"],
    });
  });

  it("serializes search arrays correctly in buildUrl", () => {
    const url = buildUrl("/users/:id", {
      params: { id: 42 },
      search: {
        tab: "profile",
        tag: ["alpha", "beta"],
      },
      hash: "section-1",
    });

    expect(url).toBe("/users/42?tab=profile&tag=alpha&tag=beta#section-1");
  });
});