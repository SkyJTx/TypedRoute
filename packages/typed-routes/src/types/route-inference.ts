/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { InferOutput } from "./type-validator";

/**
 * Normalizes leading and trailing slashes for route path matching.
 */
export type NormalizePath<T extends string> = T extends `/${infer Rest}`
  ? Rest extends `${infer Middle}/`
    ? Middle
    : Rest
  : T extends `${infer Middle}/`
    ? Middle
    : T;

/**
 * Splits path into distinct segment tuples.
 */
export type PathSegments<T extends string> = T extends ""
  ? []
  : NormalizePath<T> extends `${infer Head}/${infer Tail}`
    ? [Head, ...PathSegments<Tail>]
    : [NormalizePath<T>];

type ExtractSegmentsParams<T extends readonly string[]> = T extends readonly [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? (Head extends `:${infer Param}`
      ? { [K in Param]: string | number }
      : Head extends `*${infer Wildcard}`
        ? { [K in Wildcard]: string | number }
        : {}) &
      ExtractSegmentsParams<Tail>
  : {};

/**
 * Extracts param names from path segments as a structural object.
 */
export type ExtractPathParams<T extends string> = Simplify<
  ExtractSegmentsParams<PathSegments<T>>
>;

/**
 * Flattens intersection types for clean IntelliSense and type display.
 */
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Recursively extracts all valid target paths from a manifest.
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
    ? Entry extends { $$route: { require(): { route: infer R } } }
      ? R extends { useParams(): readonly [() => infer P, unknown] }
        ? [unknown] extends [P]
          ? Simplify<ExtractPathParams<Path>>
          : [NonNullable<P>] extends [never]
            ? Simplify<ExtractPathParams<Path>>
            : NonNullable<P>
        : R extends { config: { params?: infer V } }
          ? [V] extends [undefined]
            ? Simplify<ExtractPathParams<Path>>
            : [unknown] extends [InferOutput<V>]
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
    ? Entry extends { $$route: { require(): { route: infer R } } }
      ? R extends { useSearch(): readonly [() => infer S, unknown] }
        ? [unknown] extends [S]
          ? Record<string, string | number | boolean | string[] | undefined>
          : [NonNullable<S>] extends [never]
            ? Record<string, string | number | boolean | string[] | undefined>
            : Partial<NonNullable<S>>
        : R extends { config: { search?: infer V } }
          ? [V] extends [undefined]
            ? Record<string, string | number | boolean | string[] | undefined>
            : [unknown] extends [InferOutput<V>]
              ? Record<string, string | number | boolean | string[] | undefined>
              : Partial<NonNullable<InferOutput<V>>>
          : Record<string, string | number | boolean | string[] | undefined>
      : Record<string, string | number | boolean | string[] | undefined>
    : Record<string, string | number | boolean | string[] | undefined>;

/**
 * Navigation options contract bound to route parameters and search schema.
 */
export type NavigationArgs<TParams, TSearch, TState> =
  ([keyof NonNullable<TParams>] extends [never]
    ? { params?: never }
    : { params: NonNullable<TParams> }) &
  ([keyof NonNullable<TSearch>] extends [never]
    ? { search?: TSearch }
    : { search?: TSearch }) & {
    state?: TState;
    hash?: string;
    replace?: boolean;
    scroll?: boolean;
  };