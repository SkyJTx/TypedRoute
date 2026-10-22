/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { isStandardSchema, isZodSchema } from "../schema/validator-adapter";

/**
 * Standard symbol recognized by Node.js, Bun (JavaScriptCore), and Deno for custom object inspection.
 */
export const CUSTOM_INSPECT_SYMBOL = Symbol.for("nodejs.util.inspect.custom");

/**
 * Smi (31-bit Small Integer) bitflag constants for compact, zero-allocation route state representation.
 * Stored as immediate tagged integers in V8, JavaScriptCore, and SpiderMonkey without heap allocation.
 */
export const ROUTE_FLAG_NONE = 0;
export const ROUTE_FLAG_IS_PAGE = 1 << 0;
export const ROUTE_FLAG_VALIDATION_ONLY = 1 << 1;
export const ROUTE_FLAG_CONFIG_RESOLVED = 1 << 2;
export const ROUTE_FLAG_HAS_PARAMS_SCHEMA = 1 << 3;
export const ROUTE_FLAG_HAS_SEARCH_SCHEMA = 1 << 4;

/**
 * Structural covariant view of a route configuration for diagnostic inspection.
 */
export interface InspectableRouteConfig {
  readonly params?: unknown;
  readonly search?: unknown;
  readonly state?: unknown;
  readonly hash?: unknown;
  readonly preload?: unknown;
  readonly onError?: unknown;
  readonly info?: Record<string, unknown>;
}

/**
 * Human-readable diagnostic summary of a route definition.
 */
export interface RouteDebugSummary {
  readonly paramsValidator: string;
  readonly searchValidator: string;
  readonly stateValidator: string;
  readonly hashValidator: string;
  readonly hasPreload: boolean;
  readonly hasOnError: boolean;
  readonly infoKeys: readonly string[];
}

/**
 * Returns a human-readable label describing a validator's runtime classification and vendor.
 */
export function describeValidator(validator: unknown): string {
  if (!validator) {
    return "none";
  }
  if (isStandardSchema(validator)) {
    return `StandardSchema(${validator["~standard"].vendor})`;
  }
  if (isZodSchema(validator)) {
    return "ZodSchema";
  }
  if (typeof validator === "function") {
    return `Function(${validator.name || "anonymous"})`;
  }
  return "UnknownValidator";
}

/**
 * Decodes a Smi bitmask of route flags into an array of human-readable flag names for debugging.
 */
export function formatRouteFlags(flags: number): string[] {
  const names: string[] = [];
  if ((flags & ROUTE_FLAG_IS_PAGE) !== 0) {
    names.push("IS_PAGE");
  }
  if ((flags & ROUTE_FLAG_VALIDATION_ONLY) !== 0) {
    names.push("VALIDATION_ONLY");
  }
  if ((flags & ROUTE_FLAG_CONFIG_RESOLVED) !== 0) {
    names.push("CONFIG_RESOLVED");
  }
  if ((flags & ROUTE_FLAG_HAS_PARAMS_SCHEMA) !== 0) {
    names.push("HAS_PARAMS_SCHEMA");
  }
  if ((flags & ROUTE_FLAG_HAS_SEARCH_SCHEMA) !== 0) {
    names.push("HAS_SEARCH_SCHEMA");
  }
  return names;
}

/**
 * Extracts a structured, human-readable diagnostic summary from a `defineRoute` instance or `RouteConfig`.
 */
export function inspectRoute(
  routeOrConfig:
    | { readonly config?: InspectableRouteConfig }
    | InspectableRouteConfig
    | undefined,
): RouteDebugSummary {
  const cfg =
    routeOrConfig && typeof routeOrConfig === "object" && "config" in routeOrConfig && routeOrConfig.config
      ? routeOrConfig.config
      : (routeOrConfig as InspectableRouteConfig | undefined);

  return {
    paramsValidator: describeValidator(cfg?.params),
    searchValidator: describeValidator(cfg?.search),
    stateValidator: describeValidator(cfg?.state),
    hashValidator: describeValidator(cfg?.hash),
    hasPreload: typeof cfg?.preload === "function",
    hasOnError: typeof cfg?.onError === "function",
    infoKeys: cfg?.info ? Object.keys(cfg.info) : [],
  };
}