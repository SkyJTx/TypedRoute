# Benchmark Topic: Version Comparison (@benchmarks/version-comparison)

Evaluates latency distributions, operations per second, and heap memory allocations across published releases (`@skyjt/typed-routes@0.1.1`, `@skyjt/typed-routes@0.4.0`, `@skyjt/typed-routes@0.6.1`) and the current optimized workspace branch (`@skyjt/typed-routes`).

---

## Running This Topic

From the monorepo root:
```bash
# Run all benchmark topics
bun run bench

# Run specifically this topic
bun --filter @benchmarks/version-comparison bench
```

From inside this directory:
```bash
# Run both performance and memory benchmarks
bun run bench

# Run only performance benchmarks
bun run bench:perf

# Run only memory benchmarks
bun run bench:memory
```
