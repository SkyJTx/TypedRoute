import type { TypeValidator, InferOutput } from "../types/type-validator";
import type {
  DefinedRouteConfig,
  RouteConfig,
  RouteLocation,
  RouteValidationError,
} from "../types/route-definition";

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

  return {
    config: routeConfig,
  };
}