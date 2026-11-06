/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Runtime adapter contract for leveraging runtime-specific C++ APIs.
 */
export interface RuntimeAdapter {
  readonly name: string;
  parseQuery(searchStr: string): Record<string, unknown>;
  readJson?(request: Request): Promise<unknown>;
  readText?(request: Request): Promise<string>;
  parseHeaders?(headers: Headers): Record<string, string | undefined>;
}

export type RuntimeAdapterPreset = "auto" | "bun" | "node" | "standard";
