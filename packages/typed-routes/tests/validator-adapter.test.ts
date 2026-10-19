import { describe, it, expect } from "vitest";
import { z } from "zod";
import * as v from "valibot";
import { validateData, isStandardSchema, isZodSchema } from "~/schema/validator-adapter";

describe("Universal Validator Adapter", () => {
  it("detects Standard Schema and Zod schema type guards", () => {
    const valibotSchema = v.object({ id: v.number() });
    const zodSchema = z.object({ id: z.number() });

    expect(isStandardSchema(valibotSchema)).toBe(true);
    expect(isStandardSchema(zodSchema)).toBe(true);
    expect(isZodSchema(zodSchema)).toBe(true);
    expect(isStandardSchema({})).toBe(false);
  });

  it("validates and coerces using Valibot via Standard Schema", () => {
    const valibotSchema = v.object({
      id: v.number(),
      enabled: v.boolean(),
      tag: v.optional(v.string()),
    });

    const result = validateData(valibotSchema, {
      id: "99",
      enabled: "false",
      tag: "test",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      id: 99,
      enabled: false,
      tag: "test",
    });
  });

  it("validates and coerces using Zod with auto-coercion fallback", () => {
    const zodSchema = z.object({
      id: z.number(),
      count: z.number(),
    });

    const result = validateData(zodSchema, {
      id: "42",
      count: 10,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      id: 42,
      count: 10,
    });
  });

  it("returns formatted issues on validation failure", () => {
    const valibotSchema = v.object({
      id: v.number(),
    });

    const result = validateData(valibotSchema, {
      id: "not-a-number",
    });

    expect(result.success).toBe(false);
    expect(result.issues).toBeDefined();
    expect(result.issues!.length).toBeGreaterThan(0);
  });

  it("validates using custom parser function", () => {
    const customParser = (raw: Record<string, unknown>) => {
      const num = Number(raw.id);
      if (Number.isNaN(num)) {
        throw new Error("Invalid id");
      }
      return { id: num };
    };

    const successRes = validateData(customParser, { id: "50" });
    expect(successRes.success).toBe(true);
    expect(successRes.data).toEqual({ id: 50 });

    const failRes = validateData(customParser, { id: "not-a-number" });
    expect(failRes.success).toBe(false);
    expect(failRes.issues![0].message).toBe("Invalid id");
  });

  it("passes data directly when no validator is provided", () => {
    const raw = { foo: "bar" };
    const result = validateData(undefined, raw);
    expect(result.success).toBe(true);
    expect(result.data).toBe(raw);
  });
});