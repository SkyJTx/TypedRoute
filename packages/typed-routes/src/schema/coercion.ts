/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Shared frozen empty record singleton used for zero-allocation read-only fallbacks.
 */
export const EMPTY_RECORD: Readonly<Record<string, never>> = Object.freeze({});

/**
 * Detects whether a string represents a boolean literal ("true" or "false").
 */
function isBooleanString(value: string): boolean {
  return value === "true" || value === "false";
}

/**
 * Detects whether a string represents a valid finite number without allocating trimmed substrings.
 */
function isNumericString(value: string): boolean {
  const len = value.length;
  if (len === 0) {
    return false;
  }
  let i = 0;
  while (i < len) {
    const code = value.charCodeAt(i);
    if (code !== 32 && code !== 9) {
      break;
    }
    i++;
  }
  if (i === len) {
    return false;
  }
  const num = Number(value);
  return !Number.isNaN(num);
}

/**
 * Coerces a single string token or array of tokens into its primitive equivalent when applicable.
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
    const len = value.length;
    const out: unknown[] = [];
    for (let i = 0; i < len; i++) {
      out.push(coercePrimitive(value[i]));
    }
    return out;
  }
  return value;
}

/**
 * Coerces string values in a shallow record to primitives without intermediate Object.entries allocations.
 */
export function coerceRecord(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in record) {
    result[key] = coercePrimitive(record[key]);
  }
  return result;
}

/**
 * Appends a decoded query parameter into the target record, promoting duplicate keys into arrays.
 */
function appendParam(result: Record<string, unknown>, key: string, value: string): void {
  const existing = result[key];
  if (existing !== undefined && Object.prototype.hasOwnProperty.call(result, key)) {
    if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  } else {
    result[key] = value;
  }
}

/**
 * Fast ASCII search query string parser that avoids native URLSearchParams host allocations.
 */
export function parseFastQueryString(searchStr: string): Record<string, unknown> {
  if (!searchStr) {
    return {};
  }
  const startOffset = searchStr.charCodeAt(0) === 63 ? 1 : 0;
  const len = searchStr.length;
  if (startOffset >= len) {
    return {};
  }

  const result: Record<string, unknown> = {};
  let start = startOffset;

  while (start < len) {
    let ampIdx = searchStr.indexOf("&", start);
    if (ampIdx === -1) {
      ampIdx = len;
    }

    const eqIdx = searchStr.indexOf("=", start);
    if (eqIdx === -1 || eqIdx > ampIdx) {
      if (ampIdx > start) {
        const rawKey = searchStr.slice(start, ampIdx);
        const key = rawKey.indexOf("%") === -1 ? rawKey : decodeURIComponent(rawKey);
        appendParam(result, key, "");
      }
    } else {
      if (eqIdx > start) {
        const rawKey = searchStr.slice(start, eqIdx);
        const rawVal = searchStr.slice(eqIdx + 1, ampIdx);
        const key = rawKey.indexOf("%") === -1 ? rawKey : decodeURIComponent(rawKey);
        const val =
          rawVal.indexOf("%") === -1 && rawVal.indexOf("+") === -1
            ? rawVal
            : decodeURIComponent(rawVal.replace(/\+/g, " "));
        appendParam(result, key, val);
      }
    }

    start = ampIdx + 1;
  }

  return result;
}

/**
 * Parses raw search query strings or URLSearchParams into a structured object,
 * properly aggregating duplicate keys into arrays with zero unnecessary host allocations.
 */
export function normalizeSearchParams(
  input: string | URLSearchParams | Record<string, string | string[] | undefined>,
): Record<string, unknown> {
  if (typeof input === "string") {
    return parseFastQueryString(input);
  }

  if (input instanceof URLSearchParams) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of input.entries()) {
      appendParam(result, key, value);
    }
    return result;
  }

  const result: Record<string, unknown> = {};
  for (const key in input) {
    const value = input[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}