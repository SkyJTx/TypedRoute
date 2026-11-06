/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { parse as parseNodeQuery } from "node:querystring";
import { json as streamJson, text as streamText } from "node:stream/consumers";
import { EMPTY_RECORD } from "~/schema/coercion";
import { parseRequestHeaders } from "~/middleware/request-parsers";
import type { RuntimeAdapter } from "./types";

function isForbiddenKey(key: string): boolean {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

export function presetNode(): RuntimeAdapter {
  return {
    name: "node",
    parseQuery(searchStr: string): Record<string, unknown> {
      if (!searchStr) {
        return EMPTY_RECORD;
      }
      const start = searchStr.charCodeAt(0) === 63 ? 1 : 0;
      if (start >= searchStr.length) {
        return EMPTY_RECORD;
      }
      const clean = start === 0 ? searchStr : searchStr.slice(1);

      const parsed = parseNodeQuery(clean);
      if ("__proto__" in parsed || "constructor" in parsed || "prototype" in parsed) {
        const safe: Record<string, unknown> = {};
        for (const k in parsed) {
          if (!isForbiddenKey(k)) {
            safe[k] = parsed[k];
          }
        }
        return safe;
      }
      return parsed as Record<string, unknown>;
    },
    async readJson(request: Request): Promise<unknown> {
      if (!request.body) {
        return undefined;
      }
      return streamJson(request.body as never);
    },
    async readText(request: Request): Promise<string> {
      if (!request.body) {
        return "";
      }
      return streamText(request.body as never);
    },
    parseHeaders: parseRequestHeaders,
  };
}

export const nodeAdapter: RuntimeAdapter = presetNode();
