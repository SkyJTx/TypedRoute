/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { RuntimeAdapter, RuntimeAdapterPreset } from "./types";
import { presetStandard, standardAdapter } from "./standard";
import { presetBun, bunAdapter } from "./bun";
import { presetNode, nodeAdapter } from "./node";

export type { RuntimeAdapter, RuntimeAdapterPreset };
export { presetStandard, standardAdapter };
export { presetBun, bunAdapter };
export { presetNode, nodeAdapter };

export function createRuntimeAdapter(definition: RuntimeAdapter): RuntimeAdapter {
  return Object.freeze({ ...definition });
}

export function resolveRuntimeAdapter(
  adapter?: RuntimeAdapter | RuntimeAdapterPreset,
): RuntimeAdapter {
  if (typeof adapter === "object" && adapter !== null) {
    return adapter;
  }
  if (adapter === "bun") {
    return bunAdapter;
  }
  if (adapter === "node") {
    return nodeAdapter;
  }
  if (adapter === "standard") {
    return standardAdapter;
  }
  if (
    typeof (globalThis as { Bun?: { fastQuery?: unknown } }).Bun?.fastQuery === "function"
  ) {
    return bunAdapter;
  }
  if (typeof process !== "undefined" && process.versions?.node) {
    return nodeAdapter;
  }
  return standardAdapter;
}
