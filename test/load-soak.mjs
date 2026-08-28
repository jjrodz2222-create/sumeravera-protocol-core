import { spawn } from "node:child_process";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..");

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [k, v] = arg.replace(/^--/, "").split("=");
      return [k, v ?? true];
    })
  );

  return {
    mode: args.mode || "burst",
    requests: Number(args.requests || 80),
    concurrency: Number(args.concurrency || 10),
    durationSec: Number(args.durationSec || 60),
    p95Ms: Number(args.p95Ms || 2000),
    maxErrorRate: Number(args.maxErrorRate || 0.02),
    baseUrl: args.baseUrl ? String(args.baseUrl) : null,
  };
}

async function waitForHealth(baseUrl, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      if (res.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Server health check timeout in load test");
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function runBurst(baseUrl, totalRequests, concurrency) {
  const latencies = [];
  let failures = 0;

  const workers = Array.from({ length: concurrency }, async (_, workerIndex) => {
    for (let id = workerIndex; id < totalRequests; id += concurrency) {
      const start = Date.now();
      try {
        const endpoint = id % 2 === 0 ? "/api/v1/health" : "/api/v1/ingress/stats";
        const res = await fetch(`${baseUrl}${endpoint}`);
        if (!res.ok) failures += 1;
      } catch (_) {
        failures += 1;
      } finally {
        latencies.push(Date.now() - start);
      }
    }
  });

  await Promise.all(workers);
  return { latencies, failures, total: totalRequests };
}

async function runSoak(baseUrl, durationSec, concurrency) {
  const latencies = [];
  let failures = 0;
  const endAt = Date.now() + durationSec * 1000;

  const workers = Array.from({ length: concurrency }, async () => {
    while (Date.now() < endAt) {
      const start = Date.now();
      try {
        const res = await fetch(`${baseUrl}/api/v1/health`);
        if (!res.ok) failures += 1;
      } catch (_) {
        failures += 1;
      } finally {
        latencies.push(Date.now() - start);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });

  await Promise.all(workers);
  return { latencies, failures, total: latencies.length };
}

async function main() {
  const cfg = parseArgs();
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "sumeravera-load-"));

  let managedServer = null;
  let baseUrl = cfg.baseUrl;

  try {
    if (!baseUrl) {
      const port = 3400 + Math.floor(Math.random() * 100);
      baseUrl = `http://127.0.0.1:${port}`;
      managedServer = spawn(path.join(repoRoot, "node_modules", ".bin", "tsx"), [path.join(repoRoot, "server.ts")], {
        cwd: repoRoot,
        env: {
          ...process.env,
          PORT: String(port),
          SETTLEMENT_STORE_PATH: path.join(tempDir, "settlement_store.json"),
          WAL_LOG_PATH: path.join(tempDir, "settlement_wal.log"),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      managedServer.stdout.on("data", () => {});
      managedServer.stderr.on("data", () => {});
    }

    await waitForHealth(baseUrl);

    const result =
      cfg.mode === "soak"
        ? await runSoak(baseUrl, cfg.durationSec, cfg.concurrency)
        : await runBurst(baseUrl, cfg.requests, cfg.concurrency);

    const p95 = percentile(result.latencies, 95);
    const errorRate = result.total === 0 ? 1 : result.failures / result.total;

    console.log(
      JSON.stringify(
        {
          mode: cfg.mode,
          total_requests: result.total,
          failures: result.failures,
          error_rate: Number(errorRate.toFixed(4)),
          p95_ms: p95,
          threshold_p95_ms: cfg.p95Ms,
          threshold_max_error_rate: cfg.maxErrorRate,
        },
        null,
        2
      )
    );

    if (errorRate > cfg.maxErrorRate || p95 > cfg.p95Ms) {
      process.exitCode = 1;
    }
  } finally {
    if (managedServer && !managedServer.killed) {
      managedServer.kill("SIGTERM");
      await Promise.race([once(managedServer, "exit"), new Promise((resolve) => setTimeout(resolve, 5000))]);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
