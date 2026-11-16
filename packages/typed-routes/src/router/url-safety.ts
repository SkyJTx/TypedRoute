/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const DANGEROUS_PROTOCOL_REGEX = /^\s*(?:javascript|data|vbscript):/i;
const EXPLICIT_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Rejects client-executable URI schemes (javascript:, data:, vbscript:) before redirects or navigation.
 */
export function assertSafeUrlProtocol(url: string, context: string): void {
  if (DANGEROUS_PROTOCOL_REGEX.test(url)) {
    throw new TypeError(`Unsafe ${context} URL protocol rejected: "${url}"`);
  }
}

/**
 * Collapses protocol-relative leading slashes ("//host") on relative paths while preserving explicit-scheme URLs.
 */
export function normalizeRelativeUrlSlashes(url: string): string {
  return EXPLICIT_SCHEME_REGEX.test(url) ? url : url.replace(/^\/{2,}/, "/");
}
