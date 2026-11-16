/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const UNSAFE_PROTOCOL_REGEX = /^\s*(?:javascript|data|vbscript):/i;

/**
 * Returns true if the URL begins with a client-executable URI scheme.
 */
export function isUnsafeUrlProtocol(url: string): boolean {
  return UNSAFE_PROTOCOL_REGEX.test(url);
}

/**
 * Neutralizes unsafe anchor href protocols and collapses leading protocol-relative slashes.
 */
export function sanitizeLinkHref(url: string): string {
  if (isUnsafeUrlProtocol(url)) {
    return "about:blank";
  }
  return url.startsWith("//") ? url.replace(/^\/{2,}/, "/") : url;
}

/**
 * Throws a TypeError for unsafe navigation schemes and collapses leading protocol-relative slashes.
 */
export function assertSafeNavigateHref(url: string): string {
  if (isUnsafeUrlProtocol(url)) {
    throw new TypeError(`Unsafe navigation URL protocol rejected: "${url}"`);
  }
  return url.startsWith("//") ? url.replace(/^\/{2,}/, "/") : url;
}
