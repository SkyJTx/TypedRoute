/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  createContext,
  createComponent,
  createMemo,
  untrack,
  useContext,
  type ParentProps,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import { useParams, useSearchParams } from "@solidjs/router";
import {
  RouteValidationError,
  evaluateRouteTarget,
  normalizeSearchParams,
  type RouteValidationTuple,
} from "@skyjt/typed-routes";
import type {
  RouteAccessorTuple,
  RouteValidationContextValue,
  SolidRouteConfig,
} from "~/types/solid-route";

const RouteValidationContext = createContext<
  RouteValidationContextValue<unknown, unknown> | null
>(null, {
  name: "RouteValidationContext",
});

/**
 * Creates a fine-grained [dataAccessor, errorAccessor] tuple from a lazy validation tuple memo.
 */
export function createRouteAccessorTuple<T>(
  computeTuple: () => RouteValidationTuple<T>,
): RouteAccessorTuple<T> {
  const tupleMemo = createMemo(computeTuple, { lazy: true });
  const readValidatedData = (): T | undefined => {
    return tupleMemo()[0];
  };
  const errorMemo = createMemo<RouteValidationError | undefined>(
    function readValidationError() {
      return tupleMemo()[1];
    },
    { lazy: true },
  );
  return [readValidatedData, errorMemo] as const;
}

/**
 * Context provider supplying reactive [data, error] accessor tuples for route parameters and search queries.
 */
export function RouteValidationProvider<TParams, TSearch, TState, THash, TData>(
  props: ParentProps<{
    config?: SolidRouteConfig<TParams, TSearch, TState, THash, TData>;
  }>,
): JSX.Element {
  const rawParams = useParams();
  const [searchParams] = useSearchParams();

  const params = createRouteAccessorTuple<TParams>(() => {
    const rawParamsSnapshot: Record<string, string | undefined> = { ...rawParams };
    return evaluateRouteTarget<TParams>(
      "params",
      props.config?.params,
      rawParamsSnapshot,
      () => ({
        rawParams: rawParamsSnapshot,
        rawSearch: untrack(() => normalizeSearchParams(searchParams)),
      }),
      props.config?.onError,
    );
  });

  const search = createRouteAccessorTuple<TSearch>(() => {
    const normalizedSearch = normalizeSearchParams(searchParams);
    return evaluateRouteTarget<TSearch>(
      "search",
      props.config?.search,
      normalizedSearch,
      () => ({
        rawParams: untrack(() => ({ ...rawParams })),
        rawSearch: normalizedSearch,
      }),
      props.config?.onError,
    );
  });

  const contextValue: RouteValidationContextValue<TParams, TSearch> = {
    params,
    search,
  };

  const Provider =
    (RouteValidationContext as { Provider?: typeof RouteValidationContext }).Provider ??
    RouteValidationContext;

  return createComponent(Provider, {
    value: contextValue,
    get children() {
      return props.children;
    },
  });
}

/**
 * Returns the current route validation context.
 */
export function useRouteValidationContext<
  TParams = unknown,
  TSearch = unknown,
>(): RouteValidationContextValue<TParams, TSearch> | undefined {
  const ctx = useContext(RouteValidationContext);
  return (ctx ?? undefined) as RouteValidationContextValue<TParams, TSearch> | undefined;
}
