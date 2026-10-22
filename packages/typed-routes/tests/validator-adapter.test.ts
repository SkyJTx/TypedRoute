/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import * as v from "valibot";
import {
  validateData,
  isStandardSchema,
  isZodSchema,
  evaluateRouteTarget,
} from "~/schema/validator-adapter";
import { RouteValidationError } from "~/types/route-definition";

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

  describe("evaluateRouteTarget", () => {
    it("returns [coercedData, undefined] on success, does not call onError, and narrowing promotes data to T", () => {
      const onError = vi.fn();
      const schema = v.object({
        id: v.number(),
        active: v.boolean(),
      });
      const context = {
        rawParams: { id: "42", active: "true" },
        rawSearch: { tab: "overview" },
      };

      const tuple = evaluateRouteTarget<{ id: number; active: boolean }>(
        "params",
        schema,
        { id: "42", active: "true" },
        context,
        onError,
      );

      const [data, error] = tuple;

      expect(error).toBeUndefined();
      expect(data).toEqual({ id: 42, active: true });
      expect(onError).not.toHaveBeenCalled();

      if (error) {
        const _unreachable: undefined = data;
        expect(_unreachable).toBeUndefined();
      } else {
        const id: number = data.id;
        const active: boolean = data.active;
        expect(id).toBe(42);
        expect(active).toBe(true);
      }
    });

    it("returns [undefined, RouteValidationError] on failure and calls onError with { error, rawParams, rawSearch }", () => {
      const onError = vi.fn();
      const schema = v.object({
        id: v.number(),
      });
      const context = {
        rawParams: { id: "invalid-id" },
        rawSearch: { filter: "all" },
      };

      const tuple = evaluateRouteTarget<{ id: number }>(
        "params",
        schema,
        { id: "invalid-id" },
        context,
        onError,
      );

      const [data, error] = tuple;

      expect(data).toBeUndefined();
      expect(error).toBeInstanceOf(RouteValidationError);
      expect(error?.target).toBe("params");
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith({
        error,
        rawParams: context.rawParams,
        rawSearch: context.rawSearch,
      });

      if (error) {
        const target: "params" | "search" | "state" | "hash" = error.target;
        expect(target).toBe("params");
      } else {
        const _unreachable: { id: number } = data;
        expect(_unreachable).toBeUndefined();
      }
    });

    it("returns [rawInput, undefined] for schema-less passthrough", () => {
      const raw = { foo: "bar", count: 10 };
      const context = {
        rawParams: {},
        rawSearch: {},
      };

      const [data, error] = evaluateRouteTarget<typeof raw>(
        "params",
        undefined,
        raw,
        context,
      );

      expect(error).toBeUndefined();
      expect(data).toBe(raw);
    });
  });
});
