/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { TypeValidator, InferOutput } from "../types/type-validator";
import type {
  DefinedRouteConfig,
  RouteConfig,
  RouteLocation,
  RouteValidationError,
  TypedAPIHandler,
} from "../types/route-definition";
import { CUSTOM_INSPECT_SYMBOL, inspectRoute, type RouteDebugSummary } from "../debug/inspect";

/**
 * Monomorphic prototype-shared route definition class.
 *
 * Memory Layout:
 * - Holds a single in-object slot (`config`), occupying 16 bytes in V8 (pointer-compressed)
 *   and 24 bytes in JavaScriptCore (Bun).
 * - Attaches `handler`, `toString`, and `[CUSTOM_INSPECT_SYMBOL]` to `DefinedRoute.prototype`
 *   so zero closure objects (`JSFunction` + `Context`) are allocated per route definition.
 */
export class DefinedRoute<
  TParams = unknown,
  TSearch = unknown,
  TState = unknown,
  THash = unknown,
  TData = unknown,
> implements DefinedRouteConfig<TParams, TSearch, TState, THash, TData, RouteLocation<TState>> {
  public readonly config: RouteConfig<
    TParams,
    TSearch,
    TState,
    THash,
    TData,
    RouteLocation<TState>
  >;

  public constructor(
    config: RouteConfig<TParams, TSearch, TState, THash, TData, RouteLocation<TState>>,
  ) {
    this.config = config;
  }

  public handler<TResult = unknown>(
    fn: TypedAPIHandler<TParams, TSearch, TResult>,
  ): TypedAPIHandler<TParams, TSearch, TResult> {
    return fn;
  }

  public toString(): string {
    const summary = inspectRoute(this.config);
    return `DefinedRoute(params=${summary.paramsValidator}, search=${summary.searchValidator})`;
  }

  public [CUSTOM_INSPECT_SYMBOL](): RouteDebugSummary & { readonly [Symbol.toStringTag]: string } {
    return {
      [Symbol.toStringTag]: "DefinedRoute",
      ...inspectRoute(this.config),
    };
  }
}

/**
 * Defines framework-agnostic route parameter, search, state, and hash validation schemas.
 */
export function defineRoute<
  P extends TypeValidator<unknown, unknown> | undefined = undefined,
  S extends TypeValidator<unknown, unknown> | undefined = undefined,
  St extends TypeValidator<unknown, unknown> | undefined = undefined,
  H extends TypeValidator<unknown, unknown> | undefined = undefined,
  D = unknown,
>(config: {
  params?: P;
  search?: S;
  state?: St;
  hash?: H;
  preload?: (args: {
    params: InferOutput<P>;
    search: InferOutput<S>;
    location: RouteLocation<InferOutput<St>>;
  }) => D;
  onError?: (args: {
    error: RouteValidationError;
    rawParams: Record<string, string | undefined>;
    rawSearch: Record<string, unknown>;
  }) => void;
  info?: Record<string, unknown>;
}): DefinedRouteConfig<InferOutput<P>, InferOutput<S>, InferOutput<St>, InferOutput<H>, D> {
  type TParams = InferOutput<P>;
  type TSearch = InferOutput<S>;
  type TState = InferOutput<St>;
  type THash = InferOutput<H>;

  const routeConfig = config as unknown as RouteConfig<
    TParams,
    TSearch,
    TState,
    THash,
    D,
    RouteLocation<TState>
  >;

  return new DefinedRoute<TParams, TSearch, TState, THash, D>(routeConfig);
}