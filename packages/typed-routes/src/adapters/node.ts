/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { EMPTY_RECORD, parseFastQueryString } from "~/schema/coercion";
import { parseRequestHeaders } from "~/middleware/request-parsers";
import type { RuntimeAdapter } from "./types";

type NodeQueryParser = (str: string) => Record<string, unknown>;
type NodeStreamJsonReader = (stream: unknown) => Promise<unknown>;
type NodeStreamTextReader = (stream: unknown) => Promise<string>;

interface NodeProcessWithBuiltin {
  getBuiltinModule?: (id: string) => unknown;
}

function resolveNodeBuiltins(): {
  parseNodeQuery: NodeQueryParser | undefined;
  streamJson: NodeStreamJsonReader | undefined;
  streamText: NodeStreamTextReader | undefined;
} {
  const proc = (globalThis as { process?: NodeProcessWithBuiltin }).process;
  if (typeof proc?.getBuiltinModule !== "function") {
    return {
      parseNodeQuery: undefined,
      streamJson: undefined,
      streamText: undefined,
    };
  }

  const qs = proc.getBuiltinModule("node:querystring") as
    | { parse?: NodeQueryParser }
    | undefined;
  const consumers = proc.getBuiltinModule("node:stream/consumers") as
    | { json?: NodeStreamJsonReader; text?: NodeStreamTextReader }
    | undefined;

  return {
    parseNodeQuery: typeof qs?.parse === "function" ? qs.parse : undefined,
    streamJson: typeof consumers?.json === "function" ? consumers.json : undefined,
    streamText: typeof consumers?.text === "function" ? consumers.text : undefined,
  };
}

function isForbiddenKey(key: string): boolean {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

export function presetNode(): RuntimeAdapter {
  const { parseNodeQuery, streamJson, streamText } = resolveNodeBuiltins();

  return {
    name: "node",
    parseQuery(searchStr: string): Record<string, unknown> {
      if (!parseNodeQuery) {
        return parseFastQueryString(searchStr);
      }
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
      if (streamJson) {
        return streamJson(request.body);
      }
      return request.json();
    },
    async readText(request: Request): Promise<string> {
      if (!request.body) {
        return "";
      }
      if (streamText) {
        return streamText(request.body);
      }
      return request.text();
    },
    parseHeaders: parseRequestHeaders,
  };
}

export const nodeAdapter: RuntimeAdapter = /* @__PURE__ */ presetNode();
