/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { resolve } from "node:path";
import { createServer } from "node:net";
import { execSync } from "node:child_process";
import { BENCH_HOST } from "./fixtures";
import type { Subprocess } from "bun";

export interface RunningServer {
  readonly name: string;
  readonly appName: string;
  readonly port: number;
  readonly url: string;
  readonly proc: Subprocess;
  stop: () => Promise<void>;
}

export async function getEphemeralPort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, BENCH_HOST, () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") {
        srv.close(() => rej(new Error("Failed to allocate ephemeral port")));
        return;
      }
      const port = addr.port;
      srv.close((err) => {
        if (err) rej(err);
        else res(port);
      });
    });
    srv.on("error", rej);
  });
}

export function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
    } catch {
      // Process already terminated
    }
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Ignored
      }
    }
  }
}

export async function spawnFrameworkServer(
  name: string,
  appName: string,
  port?: number,
  mode: "raw" | "validated" = "raw",
): Promise<RunningServer> {
  const assignedPort = port ?? (await getEphemeralPort());
  const appDir = resolve(import.meta.dir, `../apps/${appName}`);
  const url = `http://${BENCH_HOST}:${assignedPort}`;

  // Direct binary execution to prevent shell wrapper orphans
  const entrypoint = appName === "elysia" ? (mode === "raw" ? "dist/server-raw.js" : "dist/server-validated.js") : "src/index.ts";
  const proc = Bun.spawn(["bun", "run", entrypoint], {
    cwd: appDir,
    env: {
      ...process.env,
      PORT: String(assignedPort),
      BENCH_MODE: mode,
    },
    stdout: "ignore",
    stderr: "inherit",
  });

  const healthUrl = `${url}/`;
  const timeoutMs = 15000;
  const start = Date.now();
  let ready = false;

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(healthUrl);
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch {
      // Server warming up
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!ready) {
    killProcessTree(proc.pid);
    try {
      proc.kill();
    } catch {}
    throw new Error(`Failed to start [${name}] on ${healthUrl} within ${timeoutMs}ms`);
  }

  return {
    name,
    appName,
    port: assignedPort,
    url,
    proc,
    async stop() {
      killProcessTree(proc.pid);
      try {
        proc.kill();
        await proc.exited;
      } catch {
        // Ignored
      }
      await new Promise((r) => setTimeout(r, 300));
    },
  };
}
