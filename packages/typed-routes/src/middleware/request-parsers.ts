/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  EMPTY_RECORD,
  isForbiddenKey,
  parseFastQueryString,
  safeDecodeComponent,
} from "~/schema/coercion";
import { ValidationOutcome } from "~/schema/validator-adapter";
import type { ValidationResult } from "~/types/type-validator";
import type { RuntimeAdapter } from "~/adapters/types";

export const DEFAULT_MAX_BODY_SIZE = 1_048_576; // 1 MiB
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const BODY_TOO_LARGE_ERROR = Symbol("BODY_TOO_LARGE");

function bodySizeLimitFailure(maxBodySize: number): ValidationResult<unknown> {
  return ValidationOutcome.fail<unknown>([
    { message: `Request body exceeds maximum allowed size of ${maxBodySize} bytes` },
  ]);
}

async function readBoundedStreamBytes(
  body: ReadableStream<Uint8Array>,
  maxBodySize: number,
): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBodySize) {
          await reader.cancel().catch(() => {});
          return null;
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (chunks.length === 0) return new Uint8Array(0);
  if (chunks.length === 1) return chunks[0];
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    merged.set(chunks[i], offset);
    offset += chunks[i].byteLength;
  }
  return merged;
}

function createBoundedStream(
  body: ReadableStream<Uint8Array>,
  maxBodySize: number,
): ReadableStream<Uint8Array> {
  let totalBytes = 0;
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBodySize) {
          await reader.cancel().catch(() => {});
          controller.error(BODY_TOO_LARGE_ERROR);
          return;
        }
        controller.enqueue(value);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

async function readBoundedText(
  request: Request,
  adapter: RuntimeAdapter | undefined,
  maxBodySize: number,
  useAdapterText: boolean,
): Promise<{ ok: true; text: string } | { ok: false; failure: ValidationResult<unknown> }> {
  if (request.body != null && Number.isFinite(maxBodySize)) {
    const bytes = await readBoundedStreamBytes(request.body, maxBodySize);
    if (bytes === null) {
      return { ok: false, failure: bodySizeLimitFailure(maxBodySize) };
    }
    return { ok: true, text: bytes.byteLength === 0 ? "" : TEXT_DECODER.decode(bytes) };
  }
  const rawText =
    useAdapterText && adapter?.readText ? await adapter.readText(request) : await request.text();
  if (rawText.length > 0 && TEXT_ENCODER.encode(rawText).byteLength > maxBodySize) {
    return { ok: false, failure: bodySizeLimitFailure(maxBodySize) };
  }
  return { ok: true, text: rawText };
}

/**
 * Extracts HTTP request headers into a normalized lowercase key-value record.
 */
export function parseRequestHeaders(
  headers: Headers,
  adapter?: RuntimeAdapter,
): Record<string, string | undefined> {
  if (adapter?.parseHeaders) {
    return adapter.parseHeaders(headers);
  }
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
      const decodedKey = safeDecodeComponent(rawKey);
      if (decodedKey.length > 0 && !isForbiddenKey(decodedKey)) {
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
        out[decodedKey] = safeDecodeComponent(cookieHeader.slice(valStart, valEnd));
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
export async function parseRequestBody(
  request: Request,
  adapter?: RuntimeAdapter,
  maxBodySize: number = DEFAULT_MAX_BODY_SIZE,
): Promise<ValidationResult<unknown>> {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isNaN(contentLength) && contentLength > maxBodySize) {
      return bodySizeLimitFailure(maxBodySize);
    }
  }
  const contentTypeHeader = request.headers.get("content-type");
  const contentType = contentTypeHeader ? contentTypeHeader.toLowerCase() : "";

  try {
    if (
      contentType === "" ||
      contentType.includes("application/json") ||
      contentType.includes("+json")
    ) {
      if (adapter?.readJson && (request.body == null || !Number.isFinite(maxBodySize))) {
        try {
          const data = await adapter.readJson(request);
          return ValidationOutcome.ok<unknown>(data);
        } catch {
          return ValidationOutcome.fail<unknown>([
            { message: "Invalid JSON payload in request body" },
          ]);
        }
      }
      const textRes = await readBoundedText(request, adapter, maxBodySize, true);
      if (!textRes.ok) return textRes.failure;
      if (textRes.text.length === 0) {
        return ValidationOutcome.ok<unknown>(undefined);
      }
      try {
        return ValidationOutcome.ok<unknown>(JSON.parse(textRes.text));
      } catch {
        return ValidationOutcome.fail<unknown>([
          { message: "Invalid JSON payload in request body" },
        ]);
      }
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const textRes = await readBoundedText(request, adapter, maxBodySize, true);
      if (!textRes.ok) return textRes.failure;
      const parseQuery = adapter ? adapter.parseQuery.bind(adapter) : parseFastQueryString;
      return ValidationOutcome.ok<unknown>(
        textRes.text.length > 0 ? parseQuery(textRes.text) : EMPTY_RECORD,
      );
    }

    if (contentType.includes("multipart/form-data")) {
      const formData =
        request.body != null && Number.isFinite(maxBodySize)
          ? await new Response(createBoundedStream(request.body, maxBodySize), {
              headers: request.headers,
            }).formData()
          : await request.formData();
      const out = Object.create(null) as Record<string, unknown>;
      formData.forEach((value, key) => {
        if (isForbiddenKey(key)) return;
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
      const textRes = await readBoundedText(request, adapter, maxBodySize, false);
      if (!textRes.ok) return textRes.failure;
      return ValidationOutcome.ok<unknown>(textRes.text);
    }

    if (request.body != null && Number.isFinite(maxBodySize)) {
      const bytes = await readBoundedStreamBytes(request.body, maxBodySize);
      if (bytes === null) return bodySizeLimitFailure(maxBodySize);
      return ValidationOutcome.ok<unknown>(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      );
    }

    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > maxBodySize) {
      return bodySizeLimitFailure(maxBodySize);
    }
    return ValidationOutcome.ok<unknown>(buffer);
  } catch (err) {
    if (err === BODY_TOO_LARGE_ERROR) {
      return bodySizeLimitFailure(maxBodySize);
    }
    return ValidationOutcome.fail<unknown>([
      { message: "Failed to read request body stream" },
    ]);
  }
}
