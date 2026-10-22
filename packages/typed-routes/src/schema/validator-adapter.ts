/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {
  TypeValidator,
  ValidationResult,
  ValidationIssue,
  StandardSchemaV1,
  ZodLikeSchema,
  FunctionValidator,
} from "~/types/type-validator";
import {
  RouteValidationError,
  type RouteValidationTuple,
} from "~/types/route-definition";
import { EMPTY_RECORD, coerceRecord } from "./coercion";

/**
 * Monomorphic validation outcome structure.
 * Initializes `success`, `data`, and `issues` in a fixed constructor order so V8 Maps,
 * JavaScriptCore Structures, and SpiderMonkey Shapes remain 100% monomorphic across
 * both passing and failing validations.
 */
export class ValidationOutcome<T> {
  public readonly success: boolean;
  public readonly data: T | undefined;
  public readonly issues: ReadonlyArray<ValidationIssue> | undefined;

  public constructor(
    success: boolean,
    data: T | undefined,
    issues: ReadonlyArray<ValidationIssue> | undefined,
  ) {
    this.success = success;
    this.data = data;
    this.issues = issues;
  }
}

export type CompiledValidator<T = unknown> = (rawInput: unknown) => ValidationResult<T>;

const compiledValidatorCache = new WeakMap<object, CompiledValidator<unknown>>();

/**
 * Type guard for Standard Schema V1.
 */
export function isStandardSchema(v: unknown): v is StandardSchemaV1 {
  return typeof v === "object" && v !== null && "~standard" in v;
}

/**
 * Type guard for legacy Zod-like schemas lacking ~standard.
 */
export function isZodSchema(v: unknown): v is ZodLikeSchema {
  return (
    typeof v === "object" &&
    v !== null &&
    "safeParse" in v &&
    typeof (v as Record<string, unknown>).safeParse === "function"
  );
}

/**
 * Formats Standard Schema issues into normalized ValidationIssue objects.
 */
function formatStandardIssues(
  rawIssues: ReadonlyArray<{
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
  }>,
): ValidationIssue[] {
  const len = rawIssues.length;
  const out: ValidationIssue[] = [];
  for (let i = 0; i < len; i++) {
    const issue = rawIssues[i];
    let pathStr: string | undefined;
    if (issue.path && issue.path.length > 0) {
      const pLen = issue.path.length;
      const parts: string[] = [];
      for (let j = 0; j < pLen; j++) {
        const seg = issue.path[j];
        parts.push(typeof seg === "object" && seg !== null ? String(seg.key) : String(seg));
      }
      pathStr = parts.join(".");
    }
    out.push({
      message: issue.message,
      path: pathStr,
    });
  }
  return out;
}

/**
 * Extracts validation issues from unknown error payloads.
 */
function extractIssues(err: unknown): ValidationIssue[] {
  if (
    typeof err === "object" &&
    err !== null &&
    "issues" in err &&
    Array.isArray((err as Record<string, unknown>).issues)
  ) {
    const rawIssues = (err as { issues: Array<{ message?: string; path?: unknown }> }).issues;
    const len = rawIssues.length;
    const out: ValidationIssue[] = [];
    for (let i = 0; i < len; i++) {
      const item = rawIssues[i];
      out.push({
        message: String(item.message ?? "Validation failed"),
        path: Array.isArray(item.path) ? item.path.join(".") : undefined,
      });
    }
    return out;
  }
  if (err instanceof Error) {
    return [{ message: err.message }];
  }
  return [{ message: String(err) }];
}

/**
 * Pre-classifies a validator into a specialized, monomorphic execution closure.
 * Cached in a WeakMap so schema shape inspection ("~standard" in v / "safeParse" in v)
 * runs only once per validator lifetime.
 */
export function compileValidator<T>(validator: TypeValidator<T>): CompiledValidator<T> {
  const key = validator as unknown as object;
  const cached = compiledValidatorCache.get(key);
  if (cached) {
    return cached as CompiledValidator<T>;
  }

  let compiled: CompiledValidator<T>;

  if (isStandardSchema(validator)) {
    const standardValidate = validator["~standard"].validate;
    compiled = function validateStandardSchema(rawInput: unknown): ValidationResult<T> {
      const direct = standardValidate(rawInput);
      if (!(direct instanceof Promise)) {
        if (!direct.issues) {
          return new ValidationOutcome<T>(true, direct.value as T, undefined) as unknown as ValidationResult<T>;
        }
        if (typeof rawInput === "object" && rawInput !== null) {
          const coercedInput = coerceRecord(rawInput as Record<string, unknown>);
          const coercedResult = standardValidate(coercedInput);
          if (!(coercedResult instanceof Promise) && !coercedResult.issues) {
            return new ValidationOutcome<T>(
              true,
              coercedResult.value as T,
              undefined,
            ) as unknown as ValidationResult<T>;
          }
        }
        return new ValidationOutcome<T>(
          false,
          undefined,
          formatStandardIssues(direct.issues),
        ) as unknown as ValidationResult<T>;
      }
      return new ValidationOutcome<T>(true, rawInput as T, undefined) as unknown as ValidationResult<T>;
    };
  } else if (isZodSchema(validator)) {
    compiled = function validateZodSchema(rawInput: unknown): ValidationResult<T> {
      const direct = validator.safeParse(rawInput);
      if (direct.success) {
        return new ValidationOutcome<T>(true, direct.data as T, undefined) as unknown as ValidationResult<T>;
      }
      if (typeof rawInput === "object" && rawInput !== null) {
        const coercedInput = coerceRecord(rawInput as Record<string, unknown>);
        const coercedResult = validator.safeParse(coercedInput);
        if (coercedResult.success) {
          return new ValidationOutcome<T>(
            true,
            coercedResult.data as T,
            undefined,
          ) as unknown as ValidationResult<T>;
        }
      }
      return new ValidationOutcome<T>(
        false,
        undefined,
        extractIssues(direct.error),
      ) as unknown as ValidationResult<T>;
    };
  } else if (typeof validator === "function") {
    const fnValidator = validator as FunctionValidator<T>;
    compiled = function validateFunctionParser(rawInput: unknown): ValidationResult<T> {
      try {
        const result = fnValidator(rawInput as never);
        return new ValidationOutcome<T>(true, result, undefined) as unknown as ValidationResult<T>;
      } catch (err) {
        if (typeof rawInput === "object" && rawInput !== null) {
          try {
            const coercedInput = coerceRecord(rawInput as Record<string, unknown>);
            const coercedResult = fnValidator(coercedInput as never);
            return new ValidationOutcome<T>(true, coercedResult, undefined) as unknown as ValidationResult<T>;
          } catch {
            // Fall through to report initial error
          }
        }
        return new ValidationOutcome<T>(
          false,
          undefined,
          extractIssues(err),
        ) as unknown as ValidationResult<T>;
      }
    };
  } else {
    compiled = function validatePassthrough(rawInput: unknown): ValidationResult<T> {
      return new ValidationOutcome<T>(true, rawInput as T, undefined) as unknown as ValidationResult<T>;
    };
  }

  if ((typeof validator === "object" && validator !== null) || typeof validator === "function") {
    compiledValidatorCache.set(key, compiled as CompiledValidator<unknown>);
  }

  return compiled;
}

/**
 * Executes validation for any supported schema or parser with lazy coercion fallback.
 */
export function validateData<T>(
  validator: TypeValidator<T> | undefined,
  rawInput: unknown,
): ValidationResult<T> {
  if (!validator) {
    return new ValidationOutcome<T>(true, rawInput as T, undefined) as unknown as ValidationResult<T>;
  }
  const runValidator = compileValidator(validator);
  return runValidator(rawInput);
}

/**
 * Validates a route target ("params" | "search" | "state" | "hash") and returns a discriminated
 * [data, error] tuple, invoking `onError` when validation fails.
 */
export function evaluateRouteTarget<T>(
  target: "params" | "search" | "state" | "hash",
  schema: TypeValidator<T, unknown> | undefined,
  rawInput: unknown,
  context: {
    rawParams: Record<string, string | undefined>;
    rawSearch: Record<string, unknown>;
  },
  onError?: (args: {
    error: RouteValidationError;
    rawParams: Record<string, string | undefined>;
    rawSearch: Record<string, unknown>;
  }) => void,
): RouteValidationTuple<T> {
  if (!schema) {
    return [(rawInput ?? EMPTY_RECORD) as T, undefined];
  }
  const res = validateData<T>(schema, rawInput);
  if (res.success) {
    return [res.data, undefined];
  }
  const error = new RouteValidationError(target, res.issues ?? [], context);
  if (onError) {
    onError({
      error,
      rawParams: context.rawParams,
      rawSearch: context.rawSearch,
    });
  }
  return [undefined, error];
}