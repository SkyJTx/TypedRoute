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
  type Component,
  type ParentProps,
} from "solid-js";
import { Dynamic, type JSX } from "@solidjs/web";
import { useParams, useLocation, useSearchParams } from "@solidjs/router";
import {
  RouteValidationError,
  validateData,
  normalizeSearchParams,
} from "@skyjt/typed-routes";
import type {
  RouteValidationContextValue,
  RouteValidationErrorProps,
  SolidRouteConfig,
} from "../types/solid-route";

const RouteValidationContext = createContext<
  RouteValidationContextValue<unknown, unknown, unknown, unknown> | null
>(null, {
  name: "RouteValidationContext",
});

function DefaultRouteErrorFallback(props: RouteValidationErrorProps): JSX.Element {
  return createComponent(Dynamic, {
    component: "div",
    role: "alert",
    "data-route-validation-error": props.error.target,
    get children() {
      return props.error.message;
    },
  });
}

/**
 * Context provider supplying validated route parameters, search queries, and error fallback boundary.
 */
export function RouteValidationProvider<TParams, TSearch, TState, THash, TData>(
  props: ParentProps<{
    config?: SolidRouteConfig<TParams, TSearch, TState, THash, TData>;
    defaultErrorComponent?: Component<RouteValidationErrorProps>;
  }>,
): JSX.Element {
  const rawParams = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const validationState = createMemo(() => {
    const rawParamsSnapshot: Record<string, string | undefined> = { ...rawParams };
    const normalizedSearch = normalizeSearchParams(searchParams);

    const paramsRes = validateData<TParams>(props.config?.params, rawParamsSnapshot);
    if (!paramsRes.success) {
      const err = new RouteValidationError("params", paramsRes.issues ?? [], {
        rawParams: rawParamsSnapshot,
        rawSearch: normalizedSearch,
      });
      if (props.config?.onError) {
        props.config.onError({
          error: err,
          rawParams: rawParamsSnapshot,
          rawSearch: normalizedSearch,
        });
      }
      return {
        ok: false as const,
        error: err,
        params: undefined as unknown as TParams,
        search: undefined as unknown as TSearch,
        rawParams: rawParamsSnapshot,
        rawSearch: normalizedSearch,
      };
    }

    const searchRes = validateData<TSearch>(props.config?.search, normalizedSearch);
    if (!searchRes.success) {
      const err = new RouteValidationError("search", searchRes.issues ?? [], {
        rawParams: rawParamsSnapshot,
        rawSearch: normalizedSearch,
      });
      if (props.config?.onError) {
        props.config.onError({
          error: err,
          rawParams: rawParamsSnapshot,
          rawSearch: normalizedSearch,
        });
      }
      return {
        ok: false as const,
        error: err,
        params: paramsRes.data as TParams,
        search: undefined as unknown as TSearch,
        rawParams: rawParamsSnapshot,
        rawSearch: normalizedSearch,
      };
    }

    return {
      ok: true as const,
      error: undefined,
      params: paramsRes.data as TParams,
      search: searchRes.data as TSearch,
      rawParams: rawParamsSnapshot,
      rawSearch: normalizedSearch,
    };
  });

  const params = createMemo<TParams>((prev) => {
    const state = validationState();
    if (state.ok) {
      return state.params;
    }
    return prev !== undefined ? prev : ({} as TParams);
  });

  const search = createMemo<TSearch>((prev) => {
    const state = validationState();
    if (state.ok) {
      return state.search;
    }
    return prev !== undefined ? prev : ({} as TSearch);
  });

  const error = createMemo<RouteValidationError | undefined>(() => validationState().error);
  const rawParamsAccessor = createMemo<Record<string, string | undefined>>(
    () => validationState().rawParams,
  );
  const rawSearchAccessor = createMemo<Record<string, unknown>>(() => validationState().rawSearch);

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
    error,
    rawParams: rawParamsAccessor,
    rawSearch: rawSearchAccessor,
  };

  return createComponent(RouteValidationContext, {
    value: contextValue,
    get children() {
      const currentError = error();
      if (currentError !== undefined && !props.config?.passThroughError) {
        const ErrorComp =
          props.config?.errorComponent ??
          props.defaultErrorComponent ??
          DefaultRouteErrorFallback;
        return createComponent(ErrorComp, {
          get error() {
            return currentError;
          },
          get rawParams() {
            return rawParamsAccessor();
          },
          get rawSearch() {
            return rawSearchAccessor();
          },
        });
      }
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