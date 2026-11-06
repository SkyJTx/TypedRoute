/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const BENCH_PORT = 3333;
export const BENCH_HOST = "127.0.0.1";
export const BASE_URL = `http://${BENCH_HOST}:${BENCH_PORT}`;

export const fixtures = {
  static: {
    path: "/",
    url: `${BASE_URL}/`,
    expected: { status: "ok" },
  },
  dynamic: {
    path: "/user/42",
    url: `${BASE_URL}/user/42`,
    expected: { id: "42", name: "User 42" },
  },
  query: {
    path: "/items?category=tools&limit=50",
    url: `${BASE_URL}/items?category=tools&limit=50`,
    expected: { category: "tools", limit: 50, items: [1, 2, 3] },
  },
  post: {
    path: "/user",
    url: `${BASE_URL}/user`,
    payload: { name: "Wriothesley", role: "Administrator" },
    expected: { id: "101", name: "Wriothesley", role: "Administrator" },
  },
} as const;
