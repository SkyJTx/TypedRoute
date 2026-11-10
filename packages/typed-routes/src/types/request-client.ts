/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { ProblemDetails } from "./problem-details";
import type {
  ExtractPathParams,
  InferHandlerData,
  InferHandlerInput,
  PathsForMethod,
  RouteMethodHandlerFor,
  RouteParamsFor,
  RouteSearchFor,
  Simplify,
} from "./route-inference";

/**
 * Supported HTTP methods on the end-to-end typed request client.
 */
export type ClientHttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "QUERY";

/**
 * Discriminated `[data, error]` tuple returned by every request client call.
 *
 * - Checking `if (error)` narrows `error` to `TError` (defaults to RFC 9457 `ProblemDetails`) and `data` to `undefined`.
 * - In the continuation branch, `data` is narrowed to `TData`.
 */
export type ClientResultTuple<TData, TError = ProblemDetails> =
  | [data: TData, error: undefined]
  | [data: undefined, error: TError];

/**
 * Configuration options for `createClient`.
 */
export interface RequestClientOptions {
  /**
   * Base URL prepended to all relative route paths (e.g., `"http://localhost:3000"`).
   */
  baseUrl?: string;
  /**
   * Default HTTP headers sent with every request.
   */
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  /**
   * Custom `fetch` implementation (defaults to `globalThis.fetch`).
   */
  fetch?: typeof fetch;
  /**
   * Default `RequestInit` options merged into each request.
   */
  init?: Omit<RequestInit, "method" | "body" | "headers">;
  /**
   * Optional lifecycle hook invoked right before executing each fetch request.
   */
  onRequest?: (context: {
    url: string;
    method: ClientHttpMethod;
    init: RequestInit;
  }) => void | Promise<void>;
  /**
   * Optional lifecycle hook invoked immediately after receiving a fetch response.
   */
  onResponse?: (context: {
    url: string;
    method: ClientHttpMethod;
    response: Response;
  }) => void | Promise<void>;
}

type ResolveClientParams<
  TManifest extends readonly unknown[],
  TPath extends string,
  THandlerInput,
> = THandlerInput extends { params: infer P }
  ? [unknown] extends [P]
    ? RouteParamsFor<TManifest, TPath>
    : [NonNullable<P>] extends [never]
      ? Simplify<ExtractPathParams<TPath>>
      : P
  : RouteParamsFor<TManifest, TPath>;

type ResolveClientSearch<
  TManifest extends readonly unknown[],
  TPath extends string,
  THandlerInput,
> = THandlerInput extends { search: infer S }
  ? [unknown] extends [S]
    ? RouteSearchFor<TManifest, TPath>
    : [NonNullable<S>] extends [never]
      ? RouteSearchFor<TManifest, TPath>
      : Partial<NonNullable<S>>
  : RouteSearchFor<TManifest, TPath>;

type ResolveClientBody<THandlerInput> = THandlerInput extends { body: infer B }
  ? [B] extends [undefined]
    ? undefined
    : [unknown] extends [B]
      ? undefined
      : B
  : undefined;

type ParamsPart<TParams> = [keyof NonNullable<TParams>] extends [never]
  ? { params?: Record<string, string | number | undefined> }
  : {} extends NonNullable<TParams>
    ? { params?: NonNullable<TParams> }
    : { params: NonNullable<TParams> };

type BodyPart<TBody> = [TBody] extends [undefined]
  ? { body?: unknown }
  : undefined extends TBody
    ? { body?: TBody }
    : { body: TBody };

/**
 * Strongly-typed request options for a specific manifest route and HTTP method.
 */
export type ClientRequestOptions<
  TManifest extends readonly unknown[],
  TPath extends string,
  TMethod extends ClientHttpMethod,
> = Simplify<
  ParamsPart<
    ResolveClientParams<
      TManifest,
      TPath,
      InferHandlerInput<RouteMethodHandlerFor<TManifest, TPath, TMethod>>
    >
  > &
    BodyPart<
      ResolveClientBody<
        InferHandlerInput<RouteMethodHandlerFor<TManifest, TPath, TMethod>>
      >
    > & {
      search?: ResolveClientSearch<
        TManifest,
        TPath,
        InferHandlerInput<RouteMethodHandlerFor<TManifest, TPath, TMethod>>
      >;
      query?: ResolveClientSearch<
        TManifest,
        TPath,
        InferHandlerInput<RouteMethodHandlerFor<TManifest, TPath, TMethod>>
      >;
      headers?: Record<string, string>;
      init?: Omit<RequestInit, "method" | "body">;
    }
>;

type HasRequiredKeys<T> = {} extends T ? false : true;

/**
 * Tuple of trailing arguments for `client.<method>(path, options?)`:
 * makes `options` required when `params` or `body` has required keys, and optional otherwise.
 */
export type ClientMethodArgs<
  TManifest extends readonly unknown[],
  TPath extends string,
  TMethod extends ClientHttpMethod,
> =
  HasRequiredKeys<ClientRequestOptions<TManifest, TPath, TMethod>> extends true
    ? [options: ClientRequestOptions<TManifest, TPath, TMethod>]
    : [options?: ClientRequestOptions<TManifest, TPath, TMethod>];

/**
 * Infers the success payload type returned by a manifest route handler for `TMethod`.
 */
export type ClientMethodData<
  TManifest extends readonly unknown[],
  TPath extends string,
  TMethod extends ClientHttpMethod,
> = [RouteMethodHandlerFor<TManifest, TPath, TMethod>] extends [never]
  ? unknown
  : InferHandlerData<RouteMethodHandlerFor<TManifest, TPath, TMethod>>;

/**
 * Method-first End-to-End Type Safety Request Client bound to a route manifest.
 */
export interface TypedRequestClient<
  TManifest extends readonly unknown[],
  TError = ProblemDetails,
> {
  get<TPath extends PathsForMethod<TManifest, "GET">>(
    path: TPath,
    ...args: ClientMethodArgs<TManifest, TPath, "GET">
  ): Promise<ClientResultTuple<ClientMethodData<TManifest, TPath, "GET">, TError>>;

  post<TPath extends PathsForMethod<TManifest, "POST">>(
    path: TPath,
    ...args: ClientMethodArgs<TManifest, TPath, "POST">
  ): Promise<ClientResultTuple<ClientMethodData<TManifest, TPath, "POST">, TError>>;

  put<TPath extends PathsForMethod<TManifest, "PUT">>(
    path: TPath,
    ...args: ClientMethodArgs<TManifest, TPath, "PUT">
  ): Promise<ClientResultTuple<ClientMethodData<TManifest, TPath, "PUT">, TError>>;

  patch<TPath extends PathsForMethod<TManifest, "PATCH">>(
    path: TPath,
    ...args: ClientMethodArgs<TManifest, TPath, "PATCH">
  ): Promise<ClientResultTuple<ClientMethodData<TManifest, TPath, "PATCH">, TError>>;

  delete<TPath extends PathsForMethod<TManifest, "DELETE">>(
    path: TPath,
    ...args: ClientMethodArgs<TManifest, TPath, "DELETE">
  ): Promise<ClientResultTuple<ClientMethodData<TManifest, TPath, "DELETE">, TError>>;

  head<TPath extends PathsForMethod<TManifest, "HEAD">>(
    path: TPath,
    ...args: ClientMethodArgs<TManifest, TPath, "HEAD">
  ): Promise<ClientResultTuple<ClientMethodData<TManifest, TPath, "HEAD">, TError>>;

  options<TPath extends PathsForMethod<TManifest, "OPTIONS">>(
    path: TPath,
    ...args: ClientMethodArgs<TManifest, TPath, "OPTIONS">
  ): Promise<ClientResultTuple<ClientMethodData<TManifest, TPath, "OPTIONS">, TError>>;

  query<TPath extends PathsForMethod<TManifest, "QUERY">>(
    path: TPath,
    ...args: ClientMethodArgs<TManifest, TPath, "QUERY">
  ): Promise<ClientResultTuple<ClientMethodData<TManifest, TPath, "QUERY">, TError>>;

  request<
    TMethod extends ClientHttpMethod,
    TPath extends PathsForMethod<TManifest, TMethod>,
  >(
    method: TMethod,
    path: TPath,
    ...args: ClientMethodArgs<TManifest, TPath, TMethod>
  ): Promise<ClientResultTuple<ClientMethodData<TManifest, TPath, TMethod>, TError>>;
}
