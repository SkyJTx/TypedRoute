import type { InferOutput } from "./type-validator";

/**
 * Normalizes trailing slashes for route paths.
 */
export type NormalizePath<P extends string> = P extends `${infer Head}/`
  ? Head extends ""
    ? "/"
    : Head
  : P;

/**
 * Splits a path string into individual segment elements.
 */
export type PathSegments<P extends string> =
  NormalizePath<P> extends `/${infer Rest}`
    ? SegmentSplit<Rest>
    : SegmentSplit<P>;

type SegmentSplit<P extends string> = P extends `${infer A}/${infer B}`
  ? [A, ...SegmentSplit<B>]
  : P extends ""
    ? []
    : [P];

/**
 * Type-level parser extracting path parameters from route patterns.
 * Supports `:param`, `:param?`, `*param`, `[param]`, and `[...param]`.
 */
export type ExtractPathParams<P extends string> = SegmentsToParams<PathSegments<P>>;

type SegmentsToParams<Segments extends readonly string[]> =
  Segments extends readonly [infer Head extends string, ...infer Tail extends readonly string[]]
    ? (Head extends `:${infer Param}?`
        ? { [K in Param]?: string }
        : Head extends `:${infer Param}`
          ? { [K in Param]: string }
          : Head extends `*${infer Param}`
            ? { [K in Param]: string }
            : Head extends `[...${infer Param}]`
              ? { [K in Param]: string }
              : Head extends `[${infer Param}]`
                ? { [K in Param]: string }
                : {}) & SegmentsToParams<Tail>
    : {};

/**
 * Flattens intersection types into readable object shapes.
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Recursively extracts all string literal route paths from a manifest tuple.
 */
export type ExtractRoutePaths<TManifest extends readonly unknown[]> =
  TManifest extends readonly [infer Head, ...infer Tail]
    ? (Head extends { path: infer P extends string }
        ? P | (Head extends { children: readonly unknown[] } ? ExtractRoutePaths<Head["children"]> : never)
        : never) | ExtractRoutePaths<Tail>
    : never;

/**
 * Locates a route entry within a manifest tuple matching the target path.
 */
export type FindRouteEntry<TManifest extends readonly unknown[], TargetPath extends string> =
  TManifest extends readonly [infer Head, ...infer Tail]
    ? Head extends { path: TargetPath }
      ? Head
      : Head extends { children: readonly unknown[] }
        ? FindRouteEntry<Head["children"], TargetPath> extends never
          ? FindRouteEntry<Tail, TargetPath>
          : FindRouteEntry<Head["children"], TargetPath>
        : FindRouteEntry<Tail, TargetPath>
    : never;

/**
 * Infers parameter types for a specified route path in the manifest.
 */
export type RouteParamsFor<TManifest extends readonly unknown[], Path extends string> =
  FindRouteEntry<TManifest, Path> extends infer Entry
    ? Entry extends { $$route?: { require(): { route: infer R } } }
      ? R extends { useParams(): () => infer P }
        ? [P] extends [never]
          ? Simplify<ExtractPathParams<Path>>
          : P
        : R extends { config: { params?: infer V } }
          ? [V] extends [undefined]
            ? Simplify<ExtractPathParams<Path>>
            : InferOutput<V>
          : Simplify<ExtractPathParams<Path>>
      : Simplify<ExtractPathParams<Path>>
    : Simplify<ExtractPathParams<Path>>;

/**
 * Infers search query types for a specified route path in the manifest.
 */
export type RouteSearchFor<TManifest extends readonly unknown[], Path extends string> =
  FindRouteEntry<TManifest, Path> extends infer Entry
    ? Entry extends { $$route?: { require(): { route: infer R } } }
      ? R extends { useSearch(): () => infer S }
        ? [S] extends [never]
          ? Record<string, string | string[] | undefined>
          : S
        : R extends { config: { search?: infer V } }
          ? [V] extends [undefined]
            ? Record<string, string | string[] | undefined>
            : InferOutput<V>
          : Record<string, string | string[] | undefined>
      : Record<string, string | string[] | undefined>
    : Record<string, string | string[] | undefined>;

/**
 * Navigation options contract bound to route parameters and search schema.
 */
export type NavigationArgs<TParams, TSearch, TState> =
  ([keyof TParams] extends [never]
    ? { params?: never }
    : { params: TParams }) &
  ([keyof TSearch] extends [never]
    ? { search?: TSearch }
    : { search?: TSearch }) & {
    state?: TState;
    hash?: string;
    replace?: boolean;
    scroll?: boolean;
  };