/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { EMPTY_RECORD, parseFastQueryString } from "~/schema/coercion";
import { ValidationOutcome } from "~/schema/validator-adapter";
import type { ValidationResult } from "~/types/type-validator";

function isForbiddenKey(key: string): boolean {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

function safeDecodeComponent(str: string): string {
  if (str.indexOf("%") === -1) {
    return str;
  }
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * Extracts HTTP request headers into a normalized lowercase key-value record.
 */
export function parseRequestHeaders(headers: Headers): Record<string, string | undefined> {
  const out = Object.create(null) as Record<string, string | undefined>;
  headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (!isForbiddenKey(normalizedKey)) {
      out[normalizedKey] = value;
    }
  });
  return out;
}

/**
 * Fast single-pass ASCII cookie header parser.
 * Avoids RegExp and split() array allocations while guarding against prototype pollution.
 */
export function parseRequestCookies(
  cookieHeader: string | null,
): Record<string, string | undefined> {
  if (!cookieHeader) {
    return EMPTY_RECORD as Record<string, string | undefined>;
  }
  const len = cookieHeader.length;
  if (len === 0) {
    return EMPTY_RECORD as Record<string, string | undefined>;
  }

  const out = Object.create(null) as Record<string, string | undefined>;
  let i = 0;

  while (i < len) {
    while (i < len && (cookieHeader.charCodeAt(i) === 32 || cookieHeader.charCodeAt(i) === 9)) {
      i++;
    }
    if (i >= len) {
      break;
    }

    let semiIdx = cookieHeader.indexOf(";", i);
    if (semiIdx === -1) {
      semiIdx = len;
    }

    const eqIdx = cookieHeader.indexOf("=", i);
    if (eqIdx !== -1 && eqIdx < semiIdx) {
      let keyEnd = eqIdx;
      while (
        keyEnd > i &&
        (cookieHeader.charCodeAt(keyEnd - 1) === 32 || cookieHeader.charCodeAt(keyEnd - 1) === 9)
      ) {
        keyEnd--;
      }
      const rawKey = cookieHeader.slice(i, keyEnd);
      if (rawKey.length > 0 && !isForbiddenKey(rawKey)) {
        let valStart = eqIdx + 1;
        let valEnd = semiIdx;
        while (
          valStart < valEnd &&
          (cookieHeader.charCodeAt(valStart) === 32 || cookieHeader.charCodeAt(valStart) === 9)
        ) {
          valStart++;
        }
        while (
          valEnd > valStart &&
          (cookieHeader.charCodeAt(valEnd - 1) === 32 ||
            cookieHeader.charCodeAt(valEnd - 1) === 9)
        ) {
          valEnd--;
        }
        if (
          valEnd - valStart >= 2 &&
          cookieHeader.charCodeAt(valStart) === 34 &&
          cookieHeader.charCodeAt(valEnd - 1) === 34
        ) {
          valStart++;
          valEnd--;
        }
        out[safeDecodeComponent(rawKey)] = safeDecodeComponent(
          cookieHeader.slice(valStart, valEnd),
        );
      }
    }

    i = semiIdx + 1;
  }

  return out;
}

/**
 * Decodes a `Request` payload according to its `Content-Type` header:
 * - `application/json` or `*+json`: parsed JSON (malformed JSON returns a clean validation failure)
 * - `application/x-www-form-urlencoded`: parsed query record with primitive coercion
 * - `multipart/form-data`: plain object of form fields and `File` entries
 * - `text/*`: raw string
 * - fallback: `ArrayBuffer`
 */
export async function parseRequestBody(request: Request): Promise<ValidationResult<unknown>> {
  const contentTypeHeader = request.headers.get("content-type");
  const contentType = contentTypeHeader ? contentTypeHeader.toLowerCase() : "";

  try {
    if (
      contentType === "" ||
      contentType.includes("application/json") ||
      contentType.includes("+json")
    ) {
      const rawText = await request.text();
      if (rawText.length === 0) {
        return ValidationOutcome.ok<unknown>(undefined);
      }
      try {
        return ValidationOutcome.ok<unknown>(JSON.parse(rawText));
      } catch {
        return ValidationOutcome.fail<unknown>([
          { message: "Invalid JSON payload in request body" },
        ]);
      }
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const rawText = await request.text();
      return ValidationOutcome.ok<unknown>(
        rawText.length > 0 ? parseFastQueryString(rawText) : EMPTY_RECORD,
      );
    }

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const out = Object.create(null) as Record<string, unknown>;
      formData.forEach((value, key) => {
        if (isForbiddenKey(key)) {
          return;
        }
        if (key in out) {
          const existing = out[key];
          if (Array.isArray(existing)) {
            existing.push(value);
          } else {
            out[key] = [existing, value];
          }
        } else {
          out[key] = value;
        }
      });
      return ValidationOutcome.ok<unknown>(out);
    }

    if (contentType.startsWith("text/")) {
      const rawText = await request.text();
      return ValidationOutcome.ok<unknown>(rawText);
    }

    const buffer = await request.arrayBuffer();
    return ValidationOutcome.ok<unknown>(buffer);
  } catch (err) {
    return ValidationOutcome.fail<unknown>([
      {
        message:
          err instanceof Error ? err.message : "Failed to read request body stream",
      },
    ]);
  }
}
