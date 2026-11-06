/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export interface BenchmarkServer {
  readonly name: string;
  start(port: number): Promise<void>;
  stop(): Promise<void>;
  fetch?(request: Request): Promise<Response> | Response;
}

export type ServerFactory = () => Promise<BenchmarkServer> | BenchmarkServer;

export interface HttpScenarioResult {
  readonly scenario: string;
  readonly path: string;
  readonly requestsPerSec: number;
  readonly latencyAvgMs: number;
  readonly latencyP50Ms: number;
  readonly latencyP90Ms: number;
  readonly latencyP99Ms: number;
  readonly throughputMbSec: number;
  readonly errors: number;
  readonly timeouts: number;
  readonly non2xx: number;
}

export interface FrameworkHttpSummary {
  readonly name: string;
  readonly scenarios: HttpScenarioResult[];
  readonly avgRequestsPerSec: number;
  readonly p99LatencyMs: number;
  readonly peakChildRssMb: number;
  readonly baselineChildRssMb: number;
  readonly childRssDeltaMb: number;
  readonly childCpuPercent: number;
}
