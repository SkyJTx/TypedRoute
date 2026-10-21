/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createMemo, type Accessor, type Component } from "solid-js";
import { useParams, useSearchParams, useLocation, type Location } from "@solidjs/router";
import {
  RouteValidationError,
  validateData,
  normalizeSearchParams,
  type TypeValidator,
  type InferOutput,
  type TypedAPIHandler,
} from "@skyjt/typed-routes";
import type {
  DefinedRouteObject,
  RouteValidationErrorProps,
  SolidRouteConfig,
} from "../types/solid-route";
import { useRouteValidationContext } from "../context/route-context";

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
    params: InferOutput<P>;
    search: InferOutput<S>;
    location: Location<InferOutput<St>>;
  }) => D;
  onError?: (args: {
    error: RouteValidationError;
    rawParams: Record<string, string | undefined>;
    rawSearch: Record<string, unknown>;
  }) => void;
  errorComponent?: Component<RouteValidationErrorProps>;
  passThroughError?: boolean;
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

  return {
    config: routeConfig,

    useParams(): Accessor<TParams> {
      const ctx = useRouteValidationContext<TParams, TSearch, TState, THash>();
      if (ctx) {
        return ctx.params;
      }
      const raw = useParams();
      return createMemo(() => {
        const res = validateData(routeConfig.params, raw);
        return (res.data ?? ({} as TParams)) as TParams;
      });
    },

    useSearch(): Accessor<TSearch> {
      const ctx = useRouteValidationContext<TParams, TSearch, TState, THash>();
      if (ctx) {
        return ctx.search;
      }
      const [search] = useSearchParams();
      return createMemo(() => {
        const res = validateData(routeConfig.search, normalizeSearchParams(search));
        return (res.data ?? ({} as TSearch)) as TSearch;
      });
    },

    useError(): Accessor<RouteValidationError | undefined> {
      const ctx = useRouteValidationContext<TParams, TSearch, TState, THash>();
      if (ctx) {
        return ctx.error;
      }
      const raw = useParams();
      const [search] = useSearchParams();
      return createMemo(() => {
        const rawParamsSnapshot: Record<string, string | undefined> = { ...raw };
        const normalizedSearch = normalizeSearchParams(search);
        const paramsRes = validateData(routeConfig.params, rawParamsSnapshot);
        if (!paramsRes.success) {
          return new RouteValidationError("params", paramsRes.issues ?? [], {
            rawParams: rawParamsSnapshot,
            rawSearch: normalizedSearch,
          });
        }
        const searchRes = validateData(routeConfig.search, normalizedSearch);
        if (!searchRes.success) {
          return new RouteValidationError("search", searchRes.issues ?? [], {
            rawParams: rawParamsSnapshot,
            rawSearch: normalizedSearch,
          });
        }
        return undefined;
      });
    },

    useLocation(): Location<TState> {
      return useLocation<TState>();
    },

    handler<TResult = unknown>(
      fn: TypedAPIHandler<TParams, TSearch, TResult>,
    ): TypedAPIHandler<TParams, TSearch, TResult> {
      return fn;
    },
  };
}