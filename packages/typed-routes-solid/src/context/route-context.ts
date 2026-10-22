/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  createContext,
  createComponent,
  createMemo,
  useContext,
  type ParentProps,
} from "solid-js";
import type { JSX } from "@solidjs/web";
import { useParams, useLocation, useSearchParams } from "@solidjs/router";
import {
  RouteValidationError,
  evaluateRouteTarget,
  validateData,
  normalizeSearchParams,
  type RouteValidationTuple,
} from "@skyjt/typed-routes";
import type {
  RouteAccessorTuple,
  RouteValidationContextValue,
  SolidRouteConfig,
} from "~/types/solid-route";

const RouteValidationContext = createContext<
  RouteValidationContextValue<unknown, unknown, unknown, unknown> | null
>(null, {
  name: "RouteValidationContext",
});

/**
 * Creates a fine-grained [dataAccessor, errorAccessor] tuple from a validation tuple memo.
 */
export function createRouteAccessorTuple<T>(
  computeTuple: () => RouteValidationTuple<T>,
): RouteAccessorTuple<T> {
  const tupleMemo = createMemo(computeTuple);
  const data = createMemo<T | undefined>(function readValidatedData() {
    return tupleMemo()[0];
  });
  const error = createMemo<RouteValidationError | undefined>(function readValidationError() {
    return tupleMemo()[1];
  });
  return [data, error] as const;
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
  const location = useLocation();

  const params = createRouteAccessorTuple<TParams>(() => {
    const rawParamsSnapshot: Record<string, string | undefined> = { ...rawParams };
    const normalizedSearch = normalizeSearchParams(searchParams);
    return evaluateRouteTarget<TParams>(
      "params",
      props.config?.params,
      rawParamsSnapshot,
      { rawParams: rawParamsSnapshot, rawSearch: normalizedSearch },
      props.config?.onError,
    );
  });

  const search = createRouteAccessorTuple<TSearch>(() => {
    const rawParamsSnapshot: Record<string, string | undefined> = { ...rawParams };
    const normalizedSearch = normalizeSearchParams(searchParams);
    return evaluateRouteTarget<TSearch>(
      "search",
      props.config?.search,
      normalizedSearch,
      { rawParams: rawParamsSnapshot, rawSearch: normalizedSearch },
      props.config?.onError,
    );
  });

  const state = createMemo<TState | undefined>(() => {
    if (!props.config?.state) {
      return location.state as TState | undefined;
    }
    const res = validateData<TState>(props.config.state, location.state);
    return res.data;
  });

  const hash = createMemo<THash | undefined>(() => {
    if (!props.config?.hash) {
      return location.hash as unknown as THash | undefined;
    }
    const res = validateData<THash>(props.config.hash, location.hash);
    return res.data;
  });

  const contextValue: RouteValidationContextValue<TParams, TSearch, TState, THash> = {
    params,
    search,
    state,
    hash,
  };

  return createComponent(RouteValidationContext, {
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
  TState = unknown,
  THash = unknown,
>(): RouteValidationContextValue<TParams, TSearch, TState, THash> | undefined {
  const ctx = useContext(RouteValidationContext);
  return (ctx ?? undefined) as RouteValidationContextValue<TParams, TSearch, TState, THash> | undefined;
}
