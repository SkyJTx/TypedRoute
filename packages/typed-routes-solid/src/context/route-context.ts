/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createContext, createComponent, createMemo, useContext, type ParentProps } from "solid-js";
import type { JSX } from "@solidjs/web";
import { useParams, useLocation, useSearchParams, type Location } from "@solidjs/router";
import {
  RouteValidationError,
  validateData,
  normalizeSearchParams,
  type RouteConfig,
} from "@skyjt/typed-routes";
import type { RouteValidationContextValue } from "../types/solid-route";

const RouteValidationContext = createContext<
  RouteValidationContextValue<unknown, unknown, unknown, unknown> | null
>(null, {
  name: "RouteValidationContext",
});

/**
 * Context provider supplying validated route parameters and search queries.
 */
export function RouteValidationProvider<TParams, TSearch, TState, THash, TData>(
  props: ParentProps<{ config?: RouteConfig<TParams, TSearch, TState, THash, TData, Location<TState>> }>,
): JSX.Element {
  const rawParams = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const params = createMemo<TParams>(() => {
    const res = validateData<TParams>(props.config?.params, rawParams);
    if (!res.success && props.config?.onError) {
      props.config.onError({
        error: new RouteValidationError("params", res.issues ?? []),
        rawParams,
        rawSearch: searchParams,
      });
    }
    return res.data as TParams;
  });

  const search = createMemo<TSearch>(() => {
    const normalized = normalizeSearchParams(searchParams);
    const res = validateData<TSearch>(props.config?.search, normalized);
    if (!res.success && props.config?.onError) {
      props.config.onError({
        error: new RouteValidationError("search", res.issues ?? []),
        rawParams,
        rawSearch: searchParams,
      });
    }
    return res.data as TSearch;
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