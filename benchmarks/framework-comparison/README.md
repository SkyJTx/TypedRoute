# Framework Comparison Benchmark Suite (Nested Workspace Architecture)

Comprehensive performance, throughput, latency, and memory retention benchmarks comparing seven major Node/Bun web frameworks.

Each framework is architected as an **independent, isolated nested workspace ("workspace-in-workspace")** under `apps/*` with its own package dependencies, compiler configurations, and startup scripts:

1. **@skyjt/typed-routes** (`apps/typed-routes` / `@framework-benchmark/typed-routes`)
2. **Hono** (`apps/hono` / `@framework-benchmark/hono`)
3. **Elysia (AOT 2.0 RC)** (`apps/elysia` / `@framework-benchmark/elysia` compiled with `elysia/plugin/aot/bun`)
4. **Fastify** (`apps/fastify` / `@framework-benchmark/fastify`)
5. **H3 (v2)** (`apps/h3` / `@framework-benchmark/h3`)
6. **Express** (`apps/express` / `@framework-benchmark/express`)
7. **NestJS** (`apps/nest` / `@framework-benchmark/nest`)

---

## Architectural Highlights

### 1. Zero Dependency Contamination ("Workspace-in-Workspace")
- Every framework is completely encapsulated in its own sub-workspace package.
- NestJS decorators and `reflect-metadata` are strictly quarantined to `apps/nest/`.
- Elysia 2 RC Ahead-of-Time bundler scripts are quarantined to `apps/elysia/`.
- Fastify, Express, Hono, H3, and TypedRoute have clean, conflict-free dependency manifests.

### 2. Subprocess Process Isolation (Noisy Neighbor Elimination)
- In the live HTTP load test, the runner spawns each target server as an **isolated OS child process** via `Bun.spawn(["bun", "run", "start"], { cwd: apps/<target> })`.
- This ensures 0% JIT compilation tier pollution, 0% garbage collection cross-talk, and immediate 100% memory reclamation upon teardown.

### 3. Dual Execution Modes
- **Mode 1 (Subprocess Live HTTP)**: Evaluates real-world socket performance under heavy concurrent load (100 concurrent connections, pipelining, warm-up phase).
- **Mode 2 (In-Memory Microbenchmarks)**: Imports route handlers directly from workspace packages into Mitata to evaluate raw nanosecond dispatch latency.

---

## Running the Benchmarks

```bash
# Build Elysia AOT bundle
bun --filter @framework-benchmark/elysia build:aot

# Run the complete 3-phase benchmark suite
bun --filter @benchmarks/framework-comparison bench

# Run individual phases
bun --filter @benchmarks/framework-comparison bench:http    # Subprocess-isolated live HTTP server load tests
bun --filter @benchmarks/framework-comparison bench:micro   # In-memory Mitata JIT dispatch microbenchmarks
bun --filter @benchmarks/framework-comparison bench:memory  # 50,000-iteration heap retention audit

# Run any individual framework standalone
bun --filter @framework-benchmark/typed-routes start
bun --filter @framework-benchmark/elysia start
bun --filter @framework-benchmark/nest start
```
