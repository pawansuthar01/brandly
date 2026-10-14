import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

const endpoint = new URL(process.env.THEME_LOAD_URL ?? "http://127.0.0.1:3000/v1/app-themes/active");
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
assert.notEqual(process.env.NODE_ENV, "production", "local theme load check is disabled in production");
assert(localHosts.has(endpoint.hostname), "THEME_LOAD_URL must point to loopback");
const database = new URL(process.env.DATABASE_URL ?? "");
assert(localHosts.has(database.hostname), "theme load check requires a confirmed local database");

const requested = Number.parseInt(process.env.THEME_LOAD_REQUESTS ?? "200", 10);
const concurrency = Number.parseInt(process.env.THEME_LOAD_CONCURRENCY ?? "4", 10);
const requestCount = Math.min(500, Math.max(1, Number.isFinite(requested) ? requested : 200));
const workers = Math.min(8, Math.max(1, Number.isFinite(concurrency) ? concurrency : 4));
const warmup = await fetch(endpoint);
assert.equal(warmup.status, 200, "active theme warmup must return 200");
const etag = warmup.headers.get("etag");
assert(etag, "active theme endpoint must return an ETag");
await warmup.arrayBuffer();

const durations: number[] = [];
const statuses = new Map<number, number>();
let next = 0;
let errors = 0;
let rateLimited = 0;
const started = performance.now();
await Promise.all(Array.from({ length: workers }, async () => {
  while (true) {
    const index = next++;
    if (index >= requestCount) return;
    const before = performance.now();
    try {
      const response = await fetch(endpoint, { headers: { "if-none-match": etag } });
      await response.arrayBuffer();
      durations.push(performance.now() - before);
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
      if (response.status === 429) rateLimited++;
      else if (!response.ok && response.status !== 304) errors++;
    } catch {
      errors++;
    }
  }
}));
const elapsed = performance.now() - started;
const sorted = durations.sort((a, b) => a - b);
const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0;
console.log(JSON.stringify({ environment: "local loopback API + local PostgreSQL", requests: requestCount, concurrency: workers, elapsedMs: Number(elapsed.toFixed(1)), statuses: Object.fromEntries(statuses), errors, rateLimited, latencyMs: { p50: Number(percentile(0.5).toFixed(2)), p95: Number(percentile(0.95).toFixed(2)), p99: Number(percentile(0.99).toFixed(2)), max: Number((sorted.at(-1) ?? 0).toFixed(2)) }, bytesPerConditionalResponse: 0, note: "Conditional ETag reads; this script does not inspect database connection-pool metrics." }, null, 2));
assert.equal(errors, 0, "conditional active-theme reads must not produce server or network errors");
