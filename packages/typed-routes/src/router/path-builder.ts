const PARAM_PATTERN = /(?::([a-zA-Z0-9_]+)\?|:([a-zA-Z0-9_]+)|\*([a-zA-Z0-9_]+)|\[\.\.\.([a-zA-Z0-9_]+)\]|\[([a-zA-Z0-9_]+)\])/g;

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
  const params = options?.params ?? {};

  let pathname = pattern.replace(
    PARAM_PATTERN,
    (_match, optParam, reqParam, wildcardParam, catchAllParam, bracketParam) => {
      const key = optParam ?? reqParam ?? wildcardParam ?? catchAllParam ?? bracketParam;
      if (!key) {
        return "";
      }
      const val = params[key];
      if (val === undefined || val === null) {
        if (optParam) {
          return "";
        }
        throw new Error(`Missing required path parameter: "${key}" for route pattern "${pattern}"`);
      }
      return encodeURIComponent(String(val));
    },
  );

  pathname = pathname.replace(/\/+/g, "/");
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  let queryString = "";
  if (options?.search) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(options.search)) {
      if (v === undefined || v === null) {
        continue;
      }
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item !== undefined && item !== null) {
            searchParams.append(k, String(item));
          }
        }
      } else {
        searchParams.set(k, String(v));
      }
    }
    const serialized = searchParams.toString();
    if (serialized) {
      queryString = `?${serialized}`;
    }
  }

  let hashString = "";
  if (options?.hash) {
    hashString = options.hash.startsWith("#") ? options.hash : `#${options.hash}`;
  }

  return `${pathname}${queryString}${hashString}`;
}