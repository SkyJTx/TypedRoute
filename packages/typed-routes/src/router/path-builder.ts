/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const SEGMENT_STATIC = 0;
export const SEGMENT_PARAM = 1;

/**
 * Monomorphic compiled path segment node.
 * All instances share the exact same 3-slot Hidden Class (`kind`, `text`, `optional`),
 * allowing V8 and JavaScriptCore to store segment arrays as homogeneous `PACKED_ELEMENTS`
 * without polymorphic shape branches.
 */
export class PathSegment {
  public readonly kind: 0 | 1;
  public readonly text: string;
  public readonly optional: boolean;

  public constructor(kind: 0 | 1, text: string, optional: boolean) {
    this.kind = kind;
    this.text = text;
    this.optional = optional;
  }
}

export interface PathBuilderDebugInfo {
  readonly pattern: string;
  readonly isStatic: boolean;
  readonly hasOptionalParam: boolean;
  readonly segments: ReadonlyArray<{
    readonly type: "static" | "param";
    readonly value: string;
    readonly optional: boolean;
  }>;
}

export type CompiledPathBuilder = (
  params?: Record<string, unknown>,
  search?: Record<string, unknown>,
  hash?: string,
) => string;

const PARAM_PATTERN_SOURCE =
  "(?::([a-zA-Z0-9_]+)\\?|:([a-zA-Z0-9_]+)|\\*([a-zA-Z0-9_]+)|\\[\\.\\.\\.([a-zA-Z0-9_]+)\\]|\\[([a-zA-Z0-9_]+)\\])";

const builderCache = new Map<string, CompiledPathBuilder>();

/**
 * Checks whether an ASCII string consists solely of RFC 3986 unreserved URI characters
 * (`A-Z`, `a-z`, `0-9`, `-`, `.`, `_`, `~`) and therefore requires zero percent-encoding.
 */
function isSimpleUriToken(str: string): boolean {
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const c = str.charCodeAt(i);
    const isAlnum =
      (c >= 97 && c <= 122) || // a-z
      (c >= 65 && c <= 90) || // A-Z
      (c >= 48 && c <= 57); // 0-9
    if (isAlnum || c === 45 || c === 95 || c === 46 || c === 126) {
      continue;
    }
    return false;
  }
  return true;
}

/**
 * Encodes a primitive value as a URI component, bypassing native C++ `encodeURIComponent`
 * when the value is an integer or an unreserved ASCII token.
 */
function encodeFastComponent(val: unknown): string {
  if (typeof val === "number") {
    const str = String(val);
    return str.indexOf("+") === -1 ? str : encodeURIComponent(str);
  }
  if (typeof val === "boolean") {
    return val ? "true" : "false";
  }
  const str = typeof val === "string" ? val : String(val);
  return isSimpleUriToken(str) ? str : encodeURIComponent(str);
}

/**
 * Collapses consecutive forward slashes and strips trailing slashes without RegExp allocation.
 */
function normalizePathnameSlashes(raw: string): string {
  const len = raw.length;
  if (len <= 1) {
    return raw;
  }

  let hasDoubleSlash = false;
  for (let i = 1; i < len; i++) {
    if (raw.charCodeAt(i) === 47 && raw.charCodeAt(i - 1) === 47) {
      hasDoubleSlash = true;
      break;
    }
  }

  let out = raw;
  if (hasDoubleSlash) {
    let buf = "";
    let prevSlash = false;
    for (let i = 0; i < len; i++) {
      const ch = raw.charCodeAt(i);
      if (ch === 47) {
        if (!prevSlash) {
          buf += "/";
          prevSlash = true;
        }
      } else {
        buf += raw[i];
        prevSlash = false;
      }
    }
    out = buf;
  }

  if (out.length > 1 && out.charCodeAt(out.length - 1) === 47) {
    return out.slice(0, -1);
  }
  return out;
}

/**
 * Tokenizes a route pattern into monomorphic `PathSegment` nodes with compile-time slash normalization.
 */
function tokenizePattern(pattern: string): {
  segments: PathSegment[];
  isAllStatic: boolean;
  hasOptionalParam: boolean;
} {
  const segments: PathSegment[] = [];
  const regex = new RegExp(PARAM_PATTERN_SOURCE, "g");
  let lastIndex = 0;
  let isAllStatic = true;
  let hasOptionalParam = false;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(pattern)) !== null) {
    if (match.index > lastIndex) {
      const staticSlice = pattern.slice(lastIndex, match.index).replace(/\/+/g, "/");
      segments.push(new PathSegment(SEGMENT_STATIC, staticSlice, false));
    }
    const optParam = match[1];
    const reqParam = match[2];
    const wildcardParam = match[3];
    const catchAllParam = match[4];
    const bracketParam = match[5];
    const key = optParam ?? reqParam ?? wildcardParam ?? catchAllParam ?? bracketParam;
    if (key) {
      const isOpt = Boolean(optParam);
      isAllStatic = false;
      if (isOpt) {
        hasOptionalParam = true;
      }
      segments.push(new PathSegment(SEGMENT_PARAM, key, isOpt));
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < pattern.length) {
    let tailSlice = pattern.slice(lastIndex).replace(/\/+/g, "/");
    if (
      (segments.length > 0 || tailSlice.length > 1) &&
      tailSlice.length > 0 &&
      tailSlice.charCodeAt(tailSlice.length - 1) === 47
    ) {
      tailSlice = tailSlice.slice(0, -1);
    }
    if (tailSlice.length > 0 || segments.length === 0) {
      segments.push(new PathSegment(SEGMENT_STATIC, tailSlice, false));
    }
  }

  return { segments, isAllStatic, hasOptionalParam };
}

/**
 * Fast search query serializer avoiding native URLSearchParams host allocations.
 */
export function serializeFastQuery(search: Record<string, unknown>): string {
  let q = "";
  for (const k in search) {
    const v = search[k];
    if (v === undefined || v === null) {
      continue;
    }
    const encodedKey = isSimpleUriToken(k) ? k : encodeURIComponent(k);
    if (Array.isArray(v)) {
      const len = v.length;
      for (let i = 0; i < len; i++) {
        const item = v[i];
        if (item !== undefined && item !== null) {
          q += (q ? "&" : "") + encodedKey + "=" + encodeFastComponent(item);
        }
      }
    } else {
      q += (q ? "&" : "") + encodedKey + "=" + encodeFastComponent(v);
    }
  }
  return q;
}

/**
 * Compiles a route pattern into a named, optimized builder closure with precomputed segments.
 */
export function compilePathBuilder(pattern: string): CompiledPathBuilder {
  const { segments, isAllStatic, hasOptionalParam } = tokenizePattern(pattern);

  if (isAllStatic) {
    let staticPath = "";
    for (let i = 0; i < segments.length; i++) {
      staticPath += segments[i].text;
    }
    staticPath = normalizePathnameSlashes(staticPath || "/");

    return function buildStaticUrl(
      _params?: Record<string, unknown>,
      search?: Record<string, unknown>,
      hash?: string,
    ): string {
      let result = staticPath;
      if (search) {
        const q = serializeFastQuery(search);
        if (q) {
          result += "?" + q;
        }
      }
      if (hash) {
        result += hash.charCodeAt(0) === 35 ? hash : "#" + hash;
      }
      return result;
    };
  }

  const segLen = segments.length;

  if (!hasOptionalParam) {
    return function buildRequiredParamUrl(
      params?: Record<string, unknown>,
      search?: Record<string, unknown>,
      hash?: string,
    ): string {
      let pathname = "";
      for (let i = 0; i < segLen; i++) {
        const seg = segments[i];
        if (seg.kind === SEGMENT_STATIC) {
          pathname += seg.text;
        } else {
          const val = params !== undefined ? params[seg.text] : undefined;
          if (val === undefined || val === null) {
            throw new Error(
              `Missing required path parameter: "${seg.text}" for route pattern "${pattern}"`,
            );
          }
          pathname += encodeFastComponent(val);
        }
      }

      if (search) {
        const q = serializeFastQuery(search);
        if (q) {
          pathname += "?" + q;
        }
      }

      if (hash) {
        pathname += hash.charCodeAt(0) === 35 ? hash : "#" + hash;
      }

      return pathname;
    };
  }

  return function buildOptionalParamUrl(
    params?: Record<string, unknown>,
    search?: Record<string, unknown>,
    hash?: string,
  ): string {
    let pathname = "";
    let omittedOptional = false;

    for (let i = 0; i < segLen; i++) {
      const seg = segments[i];
      if (seg.kind === SEGMENT_STATIC) {
        pathname += seg.text;
      } else {
        const val = params !== undefined ? params[seg.text] : undefined;
        if (val === undefined || val === null) {
          if (seg.optional) {
            omittedOptional = true;
            continue;
          }
          throw new Error(
            `Missing required path parameter: "${seg.text}" for route pattern "${pattern}"`,
          );
        }
        pathname += encodeFastComponent(val);
      }
    }

    if (omittedOptional) {
      pathname = normalizePathnameSlashes(pathname);
    } else if (pathname.length > 1 && pathname.charCodeAt(pathname.length - 1) === 47) {
      pathname = pathname.slice(0, -1);
    }

    if (search) {
      const q = serializeFastQuery(search);
      if (q) {
        pathname += "?" + q;
      }
    }

    if (hash) {
      pathname += hash.charCodeAt(0) === 35 ? hash : "#" + hash;
    }

    return pathname;
  };
}

/**
 * Returns a human-readable diagnostic breakdown of how a route pattern is tokenized and compiled.
 */
export function inspectPathBuilder(pattern: string): PathBuilderDebugInfo {
  const { segments, isAllStatic, hasOptionalParam } = tokenizePattern(pattern);
  return {
    pattern,
    isStatic: isAllStatic,
    hasOptionalParam,
    segments: segments.map((seg) => ({
      type: seg.kind === SEGMENT_STATIC ? "static" : "param",
      value: seg.text,
      optional: seg.optional,
    })),
  };
}

/**
 * Builds a URL pathname, search query, and hash from a route pattern and parameters.
 */
export function buildUrl(
  pattern: string,
  options?: {
    params?: Record<string, unknown>;
    search?: Record<string, unknown>;
    hash?: string;
  },
): string {
  let builder = builderCache.get(pattern);
  if (!builder) {
    builder = compilePathBuilder(pattern);
    builderCache.set(pattern, builder);
  }
  return builder(options?.params, options?.search, options?.hash);
}