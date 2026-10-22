/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { stripPathBase } from "filesystem-routing/api";

/**
 * Monomorphic URL scan result structure (`pathname`, `searchStr`).
 */
export interface ParsedUrl {
  readonly pathname: string;
  readonly searchStr: string;
}

/**
 * Fast ASCII URL scanner that extracts pathname and query string without C++ `new URL()` host allocations.
 * Always initializes `{ pathname, searchStr }` in a fixed 2-slot order for monomorphic Inline Caches
 * and JIT scalar replacement.
 */
export function parseFastUrl(urlStr: string, base: string = "/"): ParsedUrl {
  let pathStart = 0;

  if (urlStr.charCodeAt(0) === 47) {
    pathStart = 0;
  } else {
    const protoEnd = urlStr.indexOf("://");
    const hostStart = protoEnd === -1 ? 0 : protoEnd + 3;
    pathStart = urlStr.indexOf("/", hostStart);

    if (pathStart === -1) {
      const qIdx = urlStr.indexOf("?", hostStart);
      if (qIdx === -1) {
        return { pathname: base === "/" ? "/" : stripPathBase("/", base), searchStr: "" };
      }
      const hIdx = urlStr.indexOf("#", qIdx + 1);
      const searchStr = hIdx === -1 ? urlStr.slice(qIdx + 1) : urlStr.slice(qIdx + 1, hIdx);
      return { pathname: base === "/" ? "/" : stripPathBase("/", base), searchStr };
    }
  }

  const qIdx = urlStr.indexOf("?", pathStart);
  if (qIdx === -1) {
    const hIdx = urlStr.indexOf("#", pathStart);
    const rawPath = hIdx === -1 ? urlStr.slice(pathStart) : urlStr.slice(pathStart, hIdx);
    return { pathname: base === "/" ? rawPath : stripPathBase(rawPath, base), searchStr: "" };
  }

  const rawPath = urlStr.slice(pathStart, qIdx);
  const hIdx = urlStr.indexOf("#", qIdx + 1);
  const searchStr = hIdx === -1 ? urlStr.slice(qIdx + 1) : urlStr.slice(qIdx + 1, hIdx);

  return { pathname: base === "/" ? rawPath : stripPathBase(rawPath, base), searchStr };
}