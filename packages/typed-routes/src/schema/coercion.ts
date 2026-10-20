/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Detects whether a string represents a boolean value.
 */
function isBooleanString(value: string): boolean {
  return value === "true" || value === "false";
}

/**
 * Detects whether a string represents a valid numeric value without allocating whitespace trimmed strings.
 */
function isNumericString(value: string): boolean {
  const len = value.length;
  if (len === 0) {
    return false;
  }
  let i = 0;
  while (i < len && (value.charCodeAt(i) === 32 || value.charCodeAt(i) === 9)) {
    i++;
  }
  if (i === len) {
    return false;
  }
  const num = Number(value);
  return !Number.isNaN(num);
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
 * Fast search query string parser that avoids native URLSearchParams host allocations.
 */
export function parseFastQueryString(searchStr: string): Record<string, unknown> {
  if (!searchStr) {
    return {};
  }
  const clean = searchStr.charCodeAt(0) === 63 ? searchStr.slice(1) : searchStr;
  if (!clean) {
    return {};
  }
  const result: Record<string, unknown> = {};
  const len = clean.length;
  let start = 0;

  while (start < len) {
    let eqIdx = clean.indexOf("=", start);
    let ampIdx = clean.indexOf("&", start);

    if (ampIdx === -1) {
      ampIdx = len;
    }

    if (eqIdx === -1 || eqIdx > ampIdx) {
      const rawKey = clean.slice(start, ampIdx);
      if (rawKey) {
        const key = rawKey.indexOf("%") === -1 ? rawKey : decodeURIComponent(rawKey);
        appendParam(result, key, "");
      }
    } else {
      const rawKey = clean.slice(start, eqIdx);
      const rawVal = clean.slice(eqIdx + 1, ampIdx);
      if (rawKey) {
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

function appendParam(result: Record<string, unknown>, key: string, value: string): void {
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
