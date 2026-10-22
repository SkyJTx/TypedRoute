/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useParams, useSearchParams, useLocation, type Location } from "@solidjs/router";
import {
  CUSTOM_INSPECT_SYMBOL,
  EMPTY_RECORD,
  RouteValidationError,
  evaluateRouteTarget,
  inspectRoute,
  normalizeSearchParams,
  type RouteDebugSummary,
  type RouteValidationTuple,
  type TypeValidator,
  type InferOutput,
  type TypedAPIHandler,
} from "@skyjt/typed-routes";
import type {
  DefinedRouteObject,
  RouteAccessorTuple,
  SolidRouteConfig,
} from "~/types/solid-route";
import {
  createRouteAccessorTuple,
  useRouteValidationContext,
} from "~/context/route-context";

/**
 * Monomorphic prototype-shared SolidJS route definition class.
 *
 * Memory Layout:
 * - Stores a single in-object property (`config`), occupying 16 bytes in V8 and 24 bytes in JavaScriptCore.
 * - Shares `useParams`, `useSearch`, `useLocation`, `handler`, `toString`, and
 *   `[CUSTOM_INSPECT_SYMBOL]` on `SolidDefinedRoute.prototype`, eliminating per-route closure
 *   allocations.
 */
export class SolidDefinedRoute<
  TParams = unknown,
  TSearch = unknown,
  TState = unknown,
  THash = unknown,
  TData = unknown,
> implements DefinedRouteObject<TParams, TSearch, TState, THash, TData> {
  public readonly config: SolidRouteConfig<TParams, TSearch, TState, THash, TData>;

  public constructor(config: SolidRouteConfig<TParams, TSearch, TState, THash, TData>) {
    this.config = config;
  }

  public useParams(): RouteAccessorTuple<TParams> {
    const ctx = useRouteValidationContext<TParams, TSearch, TState, THash>();
    if (ctx) {
      return ctx.params;
    }
    const paramsSchema = this?.config?.params;
    const onError = this?.config?.onError;
    const raw = useParams();
    return createRouteAccessorTuple<TParams>(function computeValidatedParams() {
      const rawParamsSnapshot: Record<string, string | undefined> = { ...raw };
      return evaluateRouteTarget<TParams>(
        "params",
        paramsSchema,
        rawParamsSnapshot,
        { rawParams: rawParamsSnapshot, rawSearch: EMPTY_RECORD },
        onError,
      );
    });
  }

  public useSearch(): RouteAccessorTuple<TSearch> {
    const ctx = useRouteValidationContext<TParams, TSearch, TState, THash>();
    if (ctx) {
      return ctx.search;
    }
    const searchSchema = this?.config?.search;
    const onError = this?.config?.onError;
    const [search] = useSearchParams();
    return createRouteAccessorTuple<TSearch>(function computeValidatedSearch() {
      const normalizedSearch = normalizeSearchParams(search);
      return evaluateRouteTarget<TSearch>(
        "search",
        searchSchema,
        normalizedSearch,
        { rawParams: EMPTY_RECORD as Record<string, string | undefined>, rawSearch: normalizedSearch },
        onError,
      );
    });
  }

  public useLocation(): Location<TState> {
    return useLocation<TState>();
  }

  public handler<TResult = unknown>(
    fn: TypedAPIHandler<TParams, TSearch, TResult>,
  ): TypedAPIHandler<TParams, TSearch, TResult> {
    return fn;
  }

  public toString(): string {
    const summary = inspectRoute(this.config);
    return `SolidDefinedRoute(params=${summary.paramsValidator}, search=${summary.searchValidator})`;
  }

  public [CUSTOM_INSPECT_SYMBOL](): RouteDebugSummary & {
    readonly [Symbol.toStringTag]: string;
  } {
    return {
      [Symbol.toStringTag]: "SolidDefinedRoute",
      ...inspectRoute(this.config),
    };
  }
}

/**
 * Defines route parameter, search, state, and hash validation schemas with reactive SolidJS hooks and API handler helper.
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
    params: RouteValidationTuple<InferOutput<P>>;
    search: RouteValidationTuple<InferOutput<S>>;
    location: Location<InferOutput<St>>;
  }) => D;
  onError?: (args: {
    error: RouteValidationError;
    rawParams: Record<string, string | undefined>;
    rawSearch: Record<string, unknown>;
  }) => void;
  info?: Record<string, unknown>;
}): DefinedRouteObject<InferOutput<P>, InferOutput<S>, InferOutput<St>, InferOutput<H>, D> {
  type TParams = InferOutput<P>;
  type TSearch = InferOutput<S>;
  type TState = InferOutput<St>;
  type THash = InferOutput<H>;

  const routeConfig = config as unknown as SolidRouteConfig<
    TParams,
    TSearch,
    TState,
    THash,
    D
  >;

  return new SolidDefinedRoute<TParams, TSearch, TState, THash, D>(routeConfig);
}
