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
} from "../types/type-validator";
import { coerceRecord } from "./coercion";

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
 * Extracts validation issues from unknown error payloads.
 */
function extractIssues(err: unknown): ValidationIssue[] {
  if (
    typeof err === "object" &&
    err !== null &&
    "issues" in err &&
    Array.isArray((err as Record<string, unknown>).issues)
  ) {
    return (err as { issues: Array<{ message?: string; path?: unknown }> }).issues.map((i) => ({
      message: String(i.message ?? "Validation failed"),
      path: Array.isArray(i.path) ? i.path.join(".") : undefined,
    }));
  }
  if (err instanceof Error) {
    return [{ message: err.message }];
  }
  return [{ message: String(err) }];
}

/**
 * Executes validation for any supported schema or parser with lazy coercion fallback.
 */
export function validateData<T>(validator: TypeValidator<T> | undefined, rawInput: unknown): ValidationResult<T> {
  if (!validator) {
    return { success: true, data: rawInput as T };
  }

  if (isStandardSchema(validator)) {
    const direct = validator["~standard"].validate(rawInput);
    if (!(direct instanceof Promise)) {
      if (!direct.issues) {
        return { success: true, data: direct.value as T };
      }
      if (typeof rawInput === "object" && rawInput !== null) {
        const coercedInput = coerceRecord(rawInput as Record<string, unknown>);
        const coercedResult = validator["~standard"].validate(coercedInput);
        if (!(coercedResult instanceof Promise) && !coercedResult.issues) {
          return { success: true, data: coercedResult.value as T };
        }
      }
      return {
        success: false,
        issues: direct.issues.map((i) => ({
          message: i.message,
          path: i.path
            ? i.path.map((p) => (typeof p === "object" ? String(p.key) : String(p))).join(".")
            : undefined,
        })),
      };
    }
  }

  if (isZodSchema(validator)) {
    const direct = validator.safeParse(rawInput);
    if (direct.success) {
      return { success: true, data: direct.data as T };
    }
    if (typeof rawInput === "object" && rawInput !== null) {
      const coercedInput = coerceRecord(rawInput as Record<string, unknown>);
      const coercedResult = validator.safeParse(coercedInput);
      if (coercedResult.success) {
        return { success: true, data: coercedResult.data as T };
      }
    }
    return {
      success: false,
      issues: extractIssues(direct.error),
    };
  }

  if (typeof validator === "function") {
    try {
      const result = validator(rawInput as never);
      return { success: true, data: result as T };
    } catch (err) {
      if (typeof rawInput === "object" && rawInput !== null) {
        try {
          const coercedInput = coerceRecord(rawInput as Record<string, unknown>);
          const coercedResult = validator(coercedInput as never);
          return { success: true, data: coercedResult as T };
        } catch {
        }
      }
      return {
        success: false,
        issues: extractIssues(err),
      };
    }
  }

  return { success: true, data: rawInput as T };
}