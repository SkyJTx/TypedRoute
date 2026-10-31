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
import { coercePrimitive, coerceRecord } from "~/schema/coercion";
import { defineRoute } from "~/router/define-route";
import { RouteValidationError } from "~/types/route-definition";
import type {
  StandardSchemaV1,
  ZodLikeSchema,
  InferOutput,
  InferInput,
} from "~/types/type-validator";
import type {
  ExtractPathParams,
  RouteParamsFor,
  RouteSearchFor,
  NavigationArgs,
} from "~/types/route-inference";

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

    it("evaluates lazy context callback only when validation fails, skipping allocation on success", () => {
      const schema = v.object({ id: v.number() });
      const contextFactory = vi.fn(() => ({
        rawParams: { id: "bad" },
        rawSearch: { q: "search" },
      }));

      // Success path: contextFactory must NOT be called
      const [validData, validErr] = evaluateRouteTarget<{ id: number }>(
        "params",
        schema,
        { id: "123" },
        contextFactory,
      );
      expect(validErr).toBeUndefined();
      expect(validData).toEqual({ id: 123 });
      expect(contextFactory).not.toHaveBeenCalled();

      // Failure path: contextFactory MUST be called once
      const [invalidData, invalidErr] = evaluateRouteTarget<{ id: number }>(
        "params",
        schema,
        { id: "bad" },
        contextFactory,
      );
      expect(invalidData).toBeUndefined();
      expect(invalidErr).toBeInstanceOf(RouteValidationError);
      expect(invalidErr?.rawSearch).toEqual({ q: "search" });
      expect(contextFactory).toHaveBeenCalledTimes(1);
    });
  });

  describe("Finite Coercion & Async Standard Schema Rejection", () => {
    it("coerces finite numeric strings and booleans while keeping Infinity/-Infinity/whitespace as strings", () => {
      expect(coercePrimitive("42")).toBe(42);
      expect(coercePrimitive("-3.14")).toBe(-3.14);
      expect(coercePrimitive("0")).toBe(0);
      expect(coercePrimitive("true")).toBe(true);
      expect(coercePrimitive("false")).toBe(false);

      // Failure / boundary cases: non-finite numeric strings must NOT become Infinity or 0
      expect(coercePrimitive("Infinity")).toBe("Infinity");
      expect(coercePrimitive("-Infinity")).toBe("-Infinity");
      expect(coercePrimitive("NaN")).toBe("NaN");
      expect(coercePrimitive("")).toBe("");
      expect(coercePrimitive("   ")).toBe("   ");

      const coerced = coerceRecord({
        limit: "Infinity",
        offset: "10",
      });
      expect(coerced).toEqual({
        limit: "Infinity",
        offset: 10,
      });

      // Schema expecting a finite number must reject "Infinity"
      const numSchema = v.object({ limit: v.number() });
      const res = validateData(numSchema, { limit: "Infinity" });
      expect(res.success).toBe(false);
    });

    it("rejects asynchronous Standard Schema validators instead of silently passing rawInput", () => {
      const asyncDirectSchema: StandardSchemaV1<{ id: string }, { id: number }> = {
        "~standard": {
          version: 1,
          vendor: "async-test",
          validate: async (value) => ({
            value: { id: Number((value as { id: string }).id) },
          }),
        },
      };

      const directRes = validateData(asyncDirectSchema, { id: "not-validated" });
      expect(directRes.success).toBe(false);
      if (!directRes.success) {
        expect(directRes.issues[0].message).toContain(
          "Asynchronous Standard Schema validators are not supported",
        );
      }

      // Also test when first pass returns sync issues and second (coerced) pass returns a Promise
      let callCount = 0;
      const hybridAsyncSchema: StandardSchemaV1<{ id: number }, { id: number }> = {
        "~standard": {
          version: 1,
          vendor: "hybrid-async-test",
          validate: () => {
            callCount++;
            if (callCount === 1) {
              return { issues: [{ message: "Initial sync failure" }] };
            }
            return Promise.resolve({ value: { id: 1 } });
          },
        },
      };

      const hybridRes = validateData(hybridAsyncSchema, { id: "42" });
      expect(hybridRes.success).toBe(false);
      if (!hybridRes.success) {
        expect(hybridRes.issues[0].message).toContain(
          "Asynchronous Standard Schema validators are not supported",
        );
      }
    });
  });

  describe("Compile-Time & Runtime Route Type Inference", () => {
    it("infers output types across StandardSchemaV1, ZodLikeSchema, and FunctionValidator in core defineRoute", () => {
      const fnRoute = defineRoute({
        params: (raw: { id: string }) => ({ id: Number(raw.id) }),
        search: (raw: { page?: string }) => ({ page: Number(raw.page ?? 1) }),
      });

      const zodLikeValidator: ZodLikeSchema<{ slug: string }, { slug: string }> = {
        safeParse: (val) => ({ success: true as const, data: val as { slug: string } }),
      };

      const zodRoute = defineRoute({
        params: zodLikeValidator,
      });

      const valibotRoute = defineRoute({
        params: v.object({ userId: v.number() }),
        search: v.object({ active: v.boolean() }),
      });

      const manifest = [
        {
          path: "/fn/:id" as const,
          $route: { require: () => ({ route: fnRoute }) },
        },
        {
          path: "/zod/[slug]" as const,
          $route: { require: () => ({ route: zodRoute }) },
        },
        {
          path: "/valibot/:userId" as const,
          $route: { require: () => ({ route: valibotRoute }) },
        },
        {
          path: "/optional/:optId?" as const,
        },
        {
          path: "/docs/[...rest]" as const,
        },
      ] as const;

      type FnOutput = InferOutput<(raw: { a: string }) => { a: number }>;
      type ZodOutput = InferOutput<typeof zodLikeValidator>;
      type ZodInput = InferInput<typeof zodLikeValidator>;

      const _fnOut: FnOutput = { a: 1 };
      const _zodOut: ZodOutput = { slug: "hello" };
      const _zodIn: ZodInput = { slug: "hello" };

      type FnParams = RouteParamsFor<typeof manifest, "/fn/:id">;
      type FnSearch = RouteSearchFor<typeof manifest, "/fn/:id">;
      type ZodParams = RouteParamsFor<typeof manifest, "/zod/[slug]">;
      type ValibotParams = RouteParamsFor<typeof manifest, "/valibot/:userId">;
      type ValibotSearch = RouteSearchFor<typeof manifest, "/valibot/:userId">;
      type OptParams = ExtractPathParams<"/optional/:optId?">;
      type CatchAllParams = ExtractPathParams<"/docs/[...rest]">;

      const _p1: FnParams = { id: 123 };
      const _s1: FnSearch = { page: 2 };
      const _p2: ZodParams = { slug: "post-1" };
      const _p3: ValibotParams = { userId: 77 };
      const _s3: ValibotSearch = { active: true };
      const _pOptEmpty: OptParams = {};
      const _pOptProvided: OptParams = { optId: 10 };
      const _pCatchAll: CatchAllParams = { rest: "a/b/c" };

      // NavigationArgs for optional-only route "/optional/:optId?" must allow omitting params
      type OptNavArgs = NavigationArgs<OptParams, { q?: string }, unknown>;
      const _navWithoutParams: OptNavArgs = { search: { q: "test" } };
      const _navWithParams: OptNavArgs = { params: { optId: 5 } };

      expect(_fnOut.a).toBe(1);
      expect(_zodOut.slug).toBe(_zodIn.slug);
      expect(_p1.id).toBe(123);
      expect(_s1.page).toBe(2);
      expect(_p2.slug).toBe("post-1");
      expect(_p3.userId).toBe(77);
      expect(_s3.active).toBe(true);
      expect(_pOptEmpty).toEqual({});
      expect(_pOptProvided.optId).toBe(10);
      expect(_pCatchAll.rest).toBe("a/b/c");
      expect(_navWithoutParams.search?.q).toBe("test");
      expect(_navWithParams.params?.optId).toBe(5);
    });
  });
});
