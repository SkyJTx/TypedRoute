import { aot } from "elysia/plugin/aot/bun";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export async function buildElysiaAot(): Promise<void> {
  const root = resolve(import.meta.dir, "..");
  const outdir = resolve(root, "dist");

  if (!existsSync(outdir)) {
    mkdirSync(outdir, { recursive: true });
  }

  const rawEntry = resolve(root, "src/index-raw.ts");
  const valEntry = resolve(root, "src/index-validated.ts");

  const [rawRes, valRes] = await Promise.all([
    Bun.build({
      entrypoints: [rawEntry],
      outdir,
      target: "bun",
      naming: "server-raw.js",
      plugins: [aot(rawEntry)],
    }),
    Bun.build({
      entrypoints: [valEntry],
      outdir,
      target: "bun",
      naming: "server-validated.js",
      plugins: [aot(valEntry)],
    }),
  ]);

  if (!rawRes.success || !valRes.success) {
    console.error("[AOT] Elysia build failed:", rawRes.logs, valRes.logs);
    throw new Error("Elysia AOT compilation failed");
  }

  // Also write default dist/server.js as server-validated.js for backwards compatibility
  const serverJs = resolve(outdir, "server.js");
  const valFile = resolve(outdir, "server-validated.js");
  await Bun.write(serverJs, await Bun.file(valFile).text());
}

if (import.meta.main) {
  buildElysiaAot().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
