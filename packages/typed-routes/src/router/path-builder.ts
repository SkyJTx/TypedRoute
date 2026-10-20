const PARAM_PATTERN = /(?::([a-zA-Z0-9_]+)\?|:([a-zA-Z0-9_]+)|\*([a-zA-Z0-9_]+)|\[\.\.\.([a-zA-Z0-9_]+)\]|\[([a-zA-Z0-9_]+)\])/g;

type CompiledSegment =
  | { readonly type: "static"; readonly value: string }
  | { readonly type: "param"; readonly key: string; readonly optional: boolean };

export type CompiledPathBuilder = (
  params?: Record<string, unknown>,
  search?: Record<string, unknown>,
  hash?: string,
) => string;

const builderCache = new Map<string, CompiledPathBuilder>();

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
    const encodedKey = encodeURIComponent(k);
    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) {
        const item = v[i];
        if (item !== undefined && item !== null) {
          q += (q ? "&" : "") + encodedKey + "=" + encodeURIComponent(String(item));
        }
      }
    } else {
      q += (q ? "&" : "") + encodedKey + "=" + encodeURIComponent(String(v));
    }
  }
  return q;
}

/**
 * Compiles a route pattern into an optimized builder closure with precomputed segments.
 */
export function compilePathBuilder(pattern: string): CompiledPathBuilder {
  const segments: CompiledSegment[] = [];
  let lastIndex = 0;
  PARAM_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = PARAM_PATTERN.exec(pattern)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "static", value: pattern.slice(lastIndex, match.index) });
    }
    const optParam = match[1];
    const reqParam = match[2];
    const wildcardParam = match[3];
    const catchAllParam = match[4];
    const bracketParam = match[5];
    const key = optParam ?? reqParam ?? wildcardParam ?? catchAllParam ?? bracketParam;
    if (key) {
      segments.push({
        type: "param",
        key,
        optional: Boolean(optParam),
      });
    }
    lastIndex = PARAM_PATTERN.lastIndex;
  }
  if (lastIndex < pattern.length) {
    segments.push({ type: "static", value: pattern.slice(lastIndex) });
  }

  const isAllStatic = segments.every((s) => s.type === "static");
  if (isAllStatic) {
    let staticPath = segments.map((s) => s.value).join("").replace(/\/+/g, "/");
    if (staticPath.length > 1 && staticPath.endsWith("/")) {
      staticPath = staticPath.slice(0, -1);
    }
    return (_params, search, hash) => {
      let result = staticPath;
      if (search) {
        const q = serializeFastQuery(search);
        if (q) result += "?" + q;
      }
      if (hash) {
        result += hash.charCodeAt(0) === 35 ? hash : "#" + hash;
      }
      return result;
    };
  }

  return (params, search, hash) => {
    let pathname = "";
    const p = params ?? {};
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === "static") {
        pathname += seg.value;
      } else {
        const val = p[seg.key];
        if (val === undefined || val === null) {
          if (seg.optional) {
            continue;
          }
          throw new Error(`Missing required path parameter: "${seg.key}" for route pattern "${pattern}"`);
        }
        pathname += encodeURIComponent(String(val));
      }
    }

    pathname = pathname.replace(/\/+/g, "/");
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    if (search) {
      const q = serializeFastQuery(search);
      if (q) pathname += "?" + q;
    }

    if (hash) {
      pathname += hash.charCodeAt(0) === 35 ? hash : "#" + hash;
    }

    return pathname;
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
