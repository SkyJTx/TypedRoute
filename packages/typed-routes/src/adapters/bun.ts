/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { EMPTY_RECORD, parseFastQueryString } from "~/schema/coercion";
import { parseRequestHeaders } from "~/middleware/request-parsers";
import type { RuntimeAdapter } from "./types";

function isForbiddenKey(key: string): boolean {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

export function presetBun(): RuntimeAdapter {
  const bun = (
    globalThis as {
      Bun?: {
        fastQuery?: (s: string) => Record<string, string>;
        readableStreamToJSON?: (stream: ReadableStream) => Promise<unknown>;
        readableStreamToText?: (stream: ReadableStream) => Promise<string>;
      };
    }
  ).Bun;

  const fastQuery = bun?.fastQuery;
  const toJSON = bun?.readableStreamToJSON;
  const toText = bun?.readableStreamToText;

  return {
    name: "bun",
    parseQuery(searchStr: string): Record<string, unknown> {
      if (!searchStr) {
        return EMPTY_RECORD;
      }
      const start = searchStr.charCodeAt(0) === 63 ? 1 : 0;
      if (start >= searchStr.length) {
        return EMPTY_RECORD;
      }
      const clean = start === 0 ? searchStr : searchStr.slice(1);

      if (fastQuery && clean.indexOf("%") === -1 && clean.indexOf("+") === -1) {
        const raw = fastQuery(clean);
        if ("__proto__" in raw || "constructor" in raw || "prototype" in raw) {
          const safe: Record<string, unknown> = {};
          for (const k in raw) {
            if (!isForbiddenKey(k)) {
              safe[k] = raw[k];
            }
          }
          return safe;
        }
        return raw;
      }
      return parseFastQueryString(clean);
    },
    async readJson(request: Request): Promise<unknown> {
      if (typeof request.json === "function") {
        return request.json();
      }
      if (request.body && toJSON) {
        return toJSON(request.body);
      }
      return undefined;
    },
    async readText(request: Request): Promise<string> {
      if (typeof request.text === "function") {
        return request.text();
      }
      if (request.body && toText) {
        return toText(request.body);
      }
      return "";
    },
    parseHeaders(headers: Headers): Record<string, string | undefined> {
      if (typeof (headers as { toJSON?: unknown }).toJSON === "function") {
        const raw = (headers as unknown as { toJSON: () => Record<string, string | undefined> }).toJSON();
        if ("__proto__" in raw || "constructor" in raw || "prototype" in raw) {
          const safe: Record<string, string | undefined> = {};
          for (const k in raw) {
            if (!isForbiddenKey(k)) {
              safe[k] = raw[k];
            }
          }
          return safe;
        }
        return raw;
      }
      return parseRequestHeaders(headers);
    },
  };
}

export const bunAdapter: RuntimeAdapter = presetBun();
