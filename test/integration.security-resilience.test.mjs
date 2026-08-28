import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..");
const port = 3300 + Math.floor(Math.random() * 200);
const baseUrl = `http://127.0.0.1:${port}`;
const tempDir = mkdtempSync(path.join(os.tmpdir(), "sumeravera-integration-"));

let serverProc;

async function waitForHealth(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      if (res.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Server health check timeout");
}

async function startServer() {
  if (serverProc && !serverProc.killed) {
    return;
  }

  serverProc = spawn(
    path.join(repoRoot, "node_modules", ".bin", "tsx"),
    [path.join(repoRoot, "server.ts")],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(port),
        SETTLEMENT_STORE_PATH: path.join(tempDir, "settlement_store.json"),
        WAL_LOG_PATH: path.join(tempDir, "settlement_wal.log"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  serverProc.stdout.on("data", () => {});
  serverProc.stderr.on("data", () => {});
  await waitForHealth();
}

async function stopServer() {
  if (!serverProc || serverProc.killed) return;
  serverProc.kill("SIGTERM");
  await Promise.race([
    once(serverProc, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  serverProc = undefined;
}

function waitForWsMessage(ws, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for WS message")), timeoutMs);
    ws.once("message", (raw) => {
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(raw.toString()));
      } catch (err) {
        reject(err);
      }
    });
    ws.once("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

before(async () => {
  await startServer();
});

after(async () => {
  await stopServer();
});

test("health endpoint responds healthy", async () => {
  const res = await fetch(`${baseUrl}/api/v1/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "HEALTHY");
});

test("edge listener rejects malformed signature", async () => {
  const res = await fetch(`${baseUrl}/api/v1/edge/listener`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      payload: { claim_amount: 123.45, timestamp: Math.floor(Date.now() / 1000), node_id: "EDGE-A" },
      signature: "deadbeef",
    }),
  });

  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.status, "INVARIANT_REJECTED");
  assert.ok(Array.isArray(body.failed_invariants));
  assert.ok(body.failed_invariants.includes("signature_validity"));
});

test("settlement nonce replay is rejected across restart", async () => {
  const nonce = `NONCE-REPLAY-${Date.now()}`;
  const payload = {
    claim_id: `CLAIM-${Date.now()}`,
    claimed_amount: 5000,
    anomaly_index: 900,
    nonce,
  };

  const first = await fetch(`${baseUrl}/api/v1/settlement/process`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(first.status, 200);

  const second = await fetch(`${baseUrl}/api/v1/settlement/process`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(second.status, 409);
  const secondBody = await second.json();
  assert.equal(secondBody.error, "ERR_DUPLICATE_CLAIM_NONCE");

  await stopServer();
  await startServer();

  const afterRestart = await fetch(`${baseUrl}/api/v1/settlement/process`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(afterRestart.status, 409);
  const restartBody = await afterRestart.json();
  assert.equal(restartBody.error, "ERR_DUPLICATE_CLAIM_NONCE");
});

test("settlement batch rejects malformed payload", async () => {
  const res = await fetch(`${baseUrl}/api/v1/settlement/batch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ not_claims: true }),
  });
  assert.equal(res.status, 400);
});

test("unauthorized websocket token cannot escalate role", async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/ingress`);
  await once(ws, "open");

  const connected = await waitForWsMessage(ws);
  assert.equal(connected.type, "CONNECTED");
  assert.equal(connected.role, "public");

  ws.send(JSON.stringify({ action: "authenticate", token: "invalid-token" }));
  const auth = await waitForWsMessage(ws);
  assert.equal(auth.type, "AUTH_RESPONSE");
  assert.equal(auth.status, "UNAUTHORIZED");
  assert.equal(auth.role, "public");

  ws.close();
});
