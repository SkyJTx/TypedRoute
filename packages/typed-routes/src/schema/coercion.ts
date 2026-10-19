/**
 * Detects whether a string represents a boolean value.
 */
function isBooleanString(value: string): boolean {
  return value === "true" || value === "false";
}

/**
 * Detects whether a string represents a valid numeric value.
 */
function isNumericString(value: string): boolean {
  if (value.trim() === "") {
    return false;
  }
  return !Number.isNaN(Number(value));
}

/**
 * Coerces a single string token into its primitive equivalent when applicable.
 */
export function coercePrimitive(value: unknown): unknown {
  if (typeof value === "string") {
    if (isBooleanString(value)) {
      return value === "true";
    }
    if (isNumericString(value)) {
      return Number(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(coercePrimitive);
  }
  return value;
}

/**
 * Recursively coerces string values in a shallow record to primitives.
 */
export function coerceRecord(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = coercePrimitive(value);
  }
  return result;
}

/**
 * Parses raw search query strings or URLSearchParams into a structured object,
 * properly aggregating duplicate keys into arrays.
 */
export function normalizeSearchParams(
  input: string | URLSearchParams | Record<string, string | string[] | undefined>,
): Record<string, unknown> {
  if (typeof input === "string" || input instanceof URLSearchParams) {
    const params = typeof input === "string" ? new URLSearchParams(input.replace(/^\?/, "")) : input;
    const result: Record<string, unknown> = {};

    for (const [key, value] of params.entries()) {
      if (key in result) {
        const existing = result[key];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          result[key] = [existing, value];
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}