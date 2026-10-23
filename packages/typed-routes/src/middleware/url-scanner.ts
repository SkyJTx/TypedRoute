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
 * Collapses consecutive leading slashes and neutralizes backslashes to ensure the pathname
 * is strictly origin-relative and immune to protocol-relative Open Redirect attacks (e.g. "//evil.com").
 */
function sanitizePathname(raw: string): string {
  const len = raw.length;
  if (len <= 1) {
    return len === 0 || raw.charCodeAt(0) === 92 ? "/" : raw;
  }

  let needsSanitization = false;
  if (raw.charCodeAt(0) === 47 && (raw.charCodeAt(1) === 47 || raw.charCodeAt(1) === 92)) {
    needsSanitization = true;
  } else if (raw.charCodeAt(0) === 92) {
    needsSanitization = true;
  } else {
    for (let i = 0; i < len; i++) {
      if (raw.charCodeAt(i) === 92) {
        needsSanitization = true;
        break;
      }
    }
  }

  if (!needsSanitization) {
    return raw;
  }

  let normalized = "";
  for (let i = 0; i < len; i++) {
    const code = raw.charCodeAt(i);
    normalized += code === 92 ? "/" : raw[i];
  }

  let start = 0;
  const nLen = normalized.length;
  while (start < nLen - 1 && normalized.charCodeAt(start) === 47 && normalized.charCodeAt(start + 1) === 47) {
    start++;
  }

  const clean = start > 0 ? normalized.slice(start) : normalized;
  return clean.length === 0 ? "/" : clean;
}

/**
 * Fast ASCII URL scanner that extracts pathname and query string without C++ `new URL()` host allocations.
 * Always initializes `{ pathname, searchStr }` in a fixed 2-slot order for monomorphic Inline Caches
 * and JIT scalar replacement.
 */
export function parseFastUrl(urlStr: string, base: string = "/"): ParsedUrl {
  let pathStart = 0;

  if (urlStr.charCodeAt(0) === 47 || urlStr.charCodeAt(0) === 92) {
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
    const unescapedPath = hIdx === -1 ? urlStr.slice(pathStart) : urlStr.slice(pathStart, hIdx);
    const rawPath = sanitizePathname(unescapedPath);
    return { pathname: base === "/" ? rawPath : stripPathBase(rawPath, base), searchStr: "" };
  }

  const rawPath = sanitizePathname(urlStr.slice(pathStart, qIdx));
  const hIdx = urlStr.indexOf("#", qIdx + 1);
  const searchStr = hIdx === -1 ? urlStr.slice(qIdx + 1) : urlStr.slice(qIdx + 1, hIdx);

  return { pathname: base === "/" ? rawPath : stripPathBase(rawPath, base), searchStr };
}