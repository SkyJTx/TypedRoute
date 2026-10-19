import { createMemo, type Accessor } from "solid-js";
import { useParams, useSearchParams, useLocation, type Location } from "@solidjs/router";
import {
  validateData,
  normalizeSearchParams,
  type TypeValidator,
  type InferOutput,
  type RouteConfig,
  type RouteValidationError,
} from "@skyjt/typed-routes";
import type { DefinedRouteObject } from "../types/solid-route";
import { useRouteValidationContext } from "../context/route-context";

/**
 * Defines route parameter, search, state, and hash validation schemas with reactive SolidJS hooks.
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
  info?: Record<string, unknown>;
}): DefinedRouteObject<InferOutput<P>, InferOutput<S>, InferOutput<St>, InferOutput<H>, D> {
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
    Location<TState>
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
        return res.data as TParams;
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
        return res.data as TSearch;
      });
    },

    useLocation(): Location<TState> {
      return useLocation<TState>();
    },
  };
}