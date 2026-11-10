/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { parseFastQueryString } from "~/schema/coercion";
import { parseRequestHeaders } from "~/middleware/request-parsers";
import type { RuntimeAdapter } from "./types";

export function presetStandard(): RuntimeAdapter {
  return {
    name: "standard",
    parseQuery: parseFastQueryString,
    async readJson(request: Request): Promise<unknown> {
      if (!request.body) {
        return undefined;
      }
      return request.json();
    },
    async readText(request: Request): Promise<string> {
      if (!request.body) {
        return "";
      }
      return request.text();
    },
    parseHeaders: parseRequestHeaders,
  };
}

export const standardAdapter: RuntimeAdapter = /* @__PURE__ */ presetStandard();
