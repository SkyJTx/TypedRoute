/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { InferOutput, TypeValidator } from "./type-validator";
import type { ConfiguredAPIHandler, TypedAPIEvent } from "./route-definition";
import type { TypedResponse } from "~/router/api-response";

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
  ? (Head extends `:${infer OptParam}?`
      ? { [K in OptParam]?: string | number | undefined }
      : Head extends `:${infer Param}`
        ? { [K in Param]: string | number }
        : Head extends `*${infer Wildcard}`
          ? { [K in Wildcard]: string | number }
          : Head extends `[...${infer CatchAll}]`
            ? { [K in CatchAll]: string | number }
            : Head extends `[${infer BracketParam}]`
              ? { [K in BracketParam]: string | number }
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
          ? [NonNullable<V>] extends [never]
            ? Simplify<ExtractPathParams<Path>>
            : [unknown] extends [InferOutput<NonNullable<V>>]
              ? Simplify<ExtractPathParams<Path>>
              : InferOutput<NonNullable<V>>
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
          ? [NonNullable<V>] extends [never]
            ? Record<string, string | number | boolean | string[] | undefined>
            : [unknown] extends [InferOutput<NonNullable<V>>]
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
    : {} extends NonNullable<TParams>
      ? { params?: NonNullable<TParams> }
      : { params: NonNullable<TParams> }) & {
    search?: TSearch;
    state?: TState;
    hash?: string;
    replace?: boolean;
    scroll?: boolean;
  };

/**
 * Infers the validated request input shape (`params`, `search`, `body`, `headers`, `cookies`)
 * expected by a `route.handler(...)` export.
 */
export type InferHandlerInput<THandler> =
  THandler extends {
    readonly _rpcMeta?: {
      readonly params: infer TParams;
      readonly search: infer TSearch;
      readonly body: infer TBody;
      readonly headers: infer THeaders;
      readonly cookies: infer TCookies;
    };
  }
    ? Simplify<{
        params: TParams;
        search: TSearch;
        body: TBody;
        headers: THeaders;
        cookies: TCookies;
      }>
    : THandler extends (
          event: TypedAPIEvent<
            infer TParams,
            infer TSearch,
            infer TBody,
            infer THeaders,
            infer TCookies,
            Record<string, unknown>
          >,
        ) => unknown
      ? Simplify<{
          params: TParams;
          search: TSearch;
          body: TBody;
          headers: THeaders;
          cookies: TCookies;
        }>
      : never;

type UnwrapHandlerResult<TResult> =
  Awaited<TResult> extends infer R
    ? R extends TypedResponse<infer TData, infer TStatus>
      ? { status: TStatus; data: TData }
      : R extends Response
        ? { status: number; data: unknown }
        : { status: 200; data: R }
    : never;

type InferDeclaredResponseUnion<TResponses> =
  TResponses extends Record<number, TypeValidator<unknown, unknown>>
    ? {
        [K in keyof TResponses & number]: {
          status: K;
          data: InferOutput<TResponses[K]>;
        };
      }[keyof TResponses & number]
    : never;

/**
 * Infers the discriminated `{ status, data }` response union produced by a `route.handler(...)` export.
 */
export type InferHandlerOutput<THandler> =
  THandler extends ConfiguredAPIHandler<
    unknown,
    unknown,
    infer TResult,
    unknown,
    unknown,
    unknown,
    Record<string, unknown>,
    infer TResponses
  >
    ? [TResponses] extends [Record<number, TypeValidator<unknown, unknown>>]
      ? UnwrapHandlerResult<TResult> | InferDeclaredResponseUnion<TResponses>
      : UnwrapHandlerResult<TResult>
    : THandler extends (...args: never[]) => infer TResult
      ? UnwrapHandlerResult<TResult>
      : never;

/**
 * Extracts the response payload data type for a handler (optionally narrowed by HTTP status code).
 */
export type InferHandlerData<
  THandler,
  TStatus extends number = InferHandlerOutput<THandler>["status"],
> = Extract<InferHandlerOutput<THandler>, { status: TStatus }>["data"];

/**
 * Resolves the exported API handler function for a given route path and HTTP method from a route manifest.
 */
export type RouteMethodHandlerFor<
  TManifest extends readonly unknown[],
  Path extends string,
  Method extends "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "QUERY",
> =
  FindRouteEntry<TManifest, Path> extends infer Entry
    ? Entry extends Record<`$${Method}`, infer Ref>
      ? Ref extends { require(): infer Mod }
        ? Mod extends Record<Method, infer Fn>
          ? Fn
          : never
        : Ref extends { import(): Promise<infer Mod> }
          ? Mod extends Record<Method, infer Fn>
            ? Fn
            : never
          : never
      : never
    : never;
