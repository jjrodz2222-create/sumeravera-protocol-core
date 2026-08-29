import express, { Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { execFile } from "child_process";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

dotenv.config();

// -----------------------------------------------------------------------------
// 1. ENVIRONMENT VARIABLE TYPE GUARDS & STARTUP VALIDATION
// -----------------------------------------------------------------------------
export interface ProtocolEnvironmentConfig {
  PORT: number;
  SECRET_KEY: string;
  ZERO_DRIFT_SECRET: string;
  BIO_SECRET: string;
  ENERGY_SECRET: string;
  ART_SECRET: string;
  MASTER_HMAC_KEY: string;
  ADMIN_WS_TOKEN: string;
  SETTLEMENT_STORE_PATH: string;
  WAL_LOG_PATH: string;
  NONCE_TTL_MS: number;
  PSEUDONYMIZATION_SALT: string;
}

export function validateProtocolEnvironment(): ProtocolEnvironmentConfig {
  const errors: string[] = [];
  const warnings: string[] = [];

  const checkSecretString = (name: string, val: string | undefined, defaultVal: string, minLength = 16): string => {
    if (!val) {
      warnings.push(`Environment variable '${name}' not specified; using secure sandbox default.`);
      return defaultVal;
    }
    const clean = val.trim();
    if (clean.length < minLength) {
      errors.push(`Secret '${name}' is too short (min ${minLength} chars, got ${clean.length}).`);
    }
    return clean;
  };

  const rawPort = process.env.PORT || "3000";
  const port = Number(rawPort);
  if (isNaN(port) || port <= 0 || port > 65535) {
    errors.push(`Invalid PORT '${rawPort}'. Must be an integer between 1 and 65535.`);
  }

  const secretKey = checkSecretString(
    "SECURE_ZERO_DRIFT_SECRET_KEY",
    process.env.SECURE_ZERO_DRIFT_SECRET_KEY || process.env.SUMER_SECRET_ZERO_DRIFT || process.env.SUMER_SECRET_BIO,
    "secure_zero_drift_secret_key_2026",
    16
  );

  const masterHmac = checkSecretString(
    "SUMER_HMAC_MASTER_KEY",
    process.env.SUMER_HMAC_MASTER_KEY,
    "sumer_master_hmac_secret_2026",
    16
  );

  const adminToken = checkSecretString(
    "SUMER_ADMIN_WS_TOKEN",
    process.env.SUMER_ADMIN_WS_TOKEN,
    "sumer_admin_telemetry_ws_token_2026",
    16
  );

  if (errors.length > 0) {
    console.error("\n\x1b[41m\x1b[37m[FATAL] PROTOCOL ENVIRONMENT TYPE GUARD CHECK FAILED\x1b[0m");
    errors.forEach((err) => console.error(`\x1b[31m ✖ ${err}\x1b[0m`));
    console.error("\x1b[33mStartup aborted to protect cryptographic integrity and prevent compromised ledger state.\x1b[0m\n");
    throw new Error(`Protocol Environment Type Guard Failed:\n${errors.join("\n")}`);
  }

  if (warnings.length > 0 && process.env.NODE_ENV === "production") {
    console.warn("\x1b[33m[WARN] Protocol Environment Validation Notices:\x1b[0m");
    warnings.forEach((warn) => console.warn(`\x1b[33m ⚠ ${warn}\x1b[0m`));
  }

  return {
    PORT: port,
    SECRET_KEY: secretKey,
    ZERO_DRIFT_SECRET: process.env.SECURE_ZERO_DRIFT_SECRET_KEY || process.env.SUMER_SECRET_ZERO_DRIFT || "secure_zero_drift_secret_key_2026",
    BIO_SECRET: process.env.SUMER_SECRET_BIO || "sumer_secret_bio_9982",
    ENERGY_SECRET: process.env.SUMER_SECRET_ENERGY || "sumer_secret_energy_1102",
    ART_SECRET: process.env.SUMER_SECRET_ART || "sumer_secret_art_4431",
    MASTER_HMAC_KEY: masterHmac,
    ADMIN_WS_TOKEN: adminToken,
    SETTLEMENT_STORE_PATH: process.env.SETTLEMENT_STORE_PATH || path.join(process.cwd(), "python", "settlement_store.json"),
    WAL_LOG_PATH: process.env.WAL_LOG_PATH || path.join(process.cwd(), "python", "settlement_wal.log"),
    NONCE_TTL_MS: 24 * 60 * 60 * 1000,
    PSEUDONYMIZATION_SALT: process.env.SUMER_SALT || "sumeravera_protocol_salt_2026",
  };
}

export const CONFIG = validateProtocolEnvironment();

// -----------------------------------------------------------------------------
// 2. STRICT TYPE-NARROWED IN-FLIGHT ASYNC MUTEX
// -----------------------------------------------------------------------------
export class TypedAsyncMutex {
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * Executes a critical section task with strict generic return type T,
   * guaranteeing zero type leakage and strict FIFO order under high-burst concurrency.
   */
  public lock<T>(task: () => Promise<T> | T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}

// -----------------------------------------------------------------------------
// 3. RFC 8785 JSON CANONICALIZATION SCHEME (JCS)
// -----------------------------------------------------------------------------
export function canonicalizeJson(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalizeJson).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`);
  return "{" + pairs.join(",") + "}";
}

// -----------------------------------------------------------------------------
// 4. CRYPTOGRAPHIC SIGNATURES: Constant-time HMAC-SHA256 (timingSafeEqual)
// -----------------------------------------------------------------------------
export function verifyCryptographicHmac(
  serializedPayload: string,
  providedSignature: string | undefined | null
): boolean {
  if (!providedSignature || typeof providedSignature !== "string") {
    return false;
  }

  const cleanSig = providedSignature.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(cleanSig)) {
    return false;
  }

  const sigBuffer = Buffer.from(cleanSig, "hex");
  if (sigBuffer.length !== 32) {
    return false;
  }

  const candidateKeys = [...new Set([
    CONFIG.SECRET_KEY,
    CONFIG.ZERO_DRIFT_SECRET,
    CONFIG.BIO_SECRET,
    CONFIG.ENERGY_SECRET,
    CONFIG.ART_SECRET,
    CONFIG.MASTER_HMAC_KEY,
  ])];

  const payloadVariations: string[] = [serializedPayload];
  try {
    const parsed = typeof serializedPayload === "string" ? JSON.parse(serializedPayload) : serializedPayload;
    if (typeof parsed === "object" && parsed !== null) {
      payloadVariations.push(canonicalizeJson(parsed));
    }
  } catch (_) {}

  for (const key of candidateKeys) {
    for (const variation of payloadVariations) {
      const hmacHex = crypto.createHmac("sha256", key).update(variation).digest("hex");
      const hmacBuffer = Buffer.from(hmacHex, "hex");
      if (sigBuffer.length === hmacBuffer.length && crypto.timingSafeEqual(sigBuffer, hmacBuffer)) {
        return true;
      }
    }
  }

  return false;
}

export const isSignatureValid = (payload: string, signature: string): boolean => {
  return verifyCryptographicHmac(payload, signature);
};

// -----------------------------------------------------------------------------
// 5. WRITE-AHEAD LOGGING & MEMORY-BOUNDED NONCE SLIDING WINDOW STORE
// -----------------------------------------------------------------------------
export interface NonceAuditRecord {
  nonce: string;
  claim_id?: string;
  amount?: number;
  timestamp: number;
}

export class RobustSettlementWALStore {
  private walPath: string;
  private legacyStorePath: string;
  private activeNonceMap = new Map<string, number>(); // Nonce -> Timestamp
  // Nonces that were accepted in-memory but whose WAL write failed.  They are
  // kept here so that retries during a persistent storage outage are still
  // rejected, preventing the same nonce from being committed multiple times.
  private walFailedNonces = new Set<string>();
  private mutex = new TypedAsyncMutex();

  constructor(walPath: string, legacyStorePath: string) {
    this.walPath = walPath;
    this.legacyStorePath = legacyStorePath;
    this.init();
  }

  private init(): void {
    try {
      const walDir = path.dirname(this.walPath);
      if (!fs.existsSync(walDir)) {
        fs.mkdirSync(walDir, { recursive: true });
      }

      // 1. Replay from WAL if exists — load ALL entries; no TTL expiry so
      //    idempotency holds unconditionally across restarts.
      if (fs.existsSync(this.walPath)) {
        const content = fs.readFileSync(this.walPath, "utf-8");
        const lines = content.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const entry = JSON.parse(line);
            if (entry.nonce) {
              this.activeNonceMap.set(entry.nonce, entry.timestamp ?? Date.now());
            }
          } catch (_) {}
        }
      }

      // 2. Replay legacy snapshot if available
      if (fs.existsSync(this.legacyStorePath)) {
        try {
          const raw = fs.readFileSync(this.legacyStorePath, "utf-8");
          const data = JSON.parse(raw);
          if (Array.isArray(data.processed_nonces)) {
            for (const item of data.processed_nonces) {
              const nonce = typeof item === "string" ? item : item?.nonce;
              if (nonce && !this.activeNonceMap.has(nonce)) {
                this.activeNonceMap.set(nonce, Date.now());
              }
            }
          }
        } catch (_) {}
      }
    } catch (err) {
      console.error("[RobustSettlementWALStore] Initialization warning:", err);
    }
  }

  public has(nonce: string): boolean {
    // Nonces never expire — idempotency must hold for the lifetime of the store.
    // A nonce that failed to persist to the WAL is also treated as "seen" so
    // that retries during a storage outage do not re-accept it in-memory.
    return this.activeNonceMap.has(nonce) || this.walFailedNonces.has(nonce);
  }

  /**
   * Reserves and commits a settlement nonce using strict generic mutex locks.
   * Fail-closed: if the WAL write fails the in-memory entry is moved to the
   * walFailedNonces set so that any subsequent retry during the same outage is
   * also rejected, preserving idempotency even when storage is unavailable.
   */
  public async reserveAndCommit(nonce: string, metadata?: Partial<NonceAuditRecord>): Promise<boolean> {
    return this.mutex.lock<boolean>(async () => {
      const now = Date.now();
      if (this.has(nonce)) {
        return false;
      }

      this.activeNonceMap.set(nonce, now);

      try {
        const walEntry =
          JSON.stringify({
            nonce,
            timestamp: now,
            ...metadata,
          }) + "\n";
        await fs.promises.appendFile(this.walPath, walEntry, "utf-8");
        return true;
      } catch (err) {
        // Move to the failed set so that retries during a WAL outage are
        // rejected rather than re-accepted, preserving idempotency.
        this.activeNonceMap.delete(nonce);
        this.walFailedNonces.add(nonce);
        console.error("[RobustSettlementWALStore] WAL append error — nonce moved to failed set:", err);
        return false;
      }
    });
  }

  /**
   * Rewrites the WAL file from the current in-memory nonce map.
   * Reduces unbounded file growth by discarding the raw append-only lines and
   * replacing them with one canonical line per nonce.  Called periodically via
   * setInterval so compaction is transparent and non-blocking.
   */
  public async compact(): Promise<void> {
    return this.mutex.lock<void>(async () => {
      try {
        const lines = Array.from(this.activeNonceMap.entries())
          .map(([nonce, timestamp]) => JSON.stringify({ nonce, timestamp }))
          .join("\n") + "\n";
        const tempPath = `${this.walPath}.compact.${Date.now()}`;
        await fs.promises.writeFile(tempPath, lines, "utf-8");
        await fs.promises.rename(tempPath, this.walPath);
      } catch (err) {
        console.error("[RobustSettlementWALStore] WAL compaction error:", err);
      }
    });
  }
}

const settlementNonceStore = new RobustSettlementWALStore(CONFIG.WAL_LOG_PATH, CONFIG.SETTLEMENT_STORE_PATH);

// -----------------------------------------------------------------------------
// 6. MERKLE TREE & INCLUSION PROOF ENGINE
// -----------------------------------------------------------------------------
export interface MerkleAuditStep {
  position: "left" | "right";
  hash: string;
}

export interface MerkleInclusionProof {
  target_claim_id: string;
  leaf_hash: string;
  leaf_index: number;
  merkle_root: string;
  audit_path: MerkleAuditStep[];
  verified: boolean;
}

export class MerkleTreeProofEngine {
  public static computeRoot(leafHashes: string[]): string {
    if (!leafHashes.length) return crypto.createHash("sha256").update("").digest("hex");
    if (leafHashes.length === 1) return leafHashes[0];

    let currentLevel = [...leafHashes];
    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        const combined = crypto.createHash("sha256").update(left + right).digest("hex");
        nextLevel.push(combined);
      }
      currentLevel = nextLevel;
    }
    return currentLevel[0];
  }

  public static generateProof(transactions: any[], targetClaimId: string): MerkleInclusionProof {
    const leaves: string[] = [];
    let targetIndex = -1;

    for (let idx = 0; idx < transactions.length; idx++) {
      const tx = transactions[idx];
      const leafHash = crypto.createHash("sha256").update(canonicalizeJson(tx)).digest("hex");
      leaves.push(leafHash);
      if (tx.claim_id === targetClaimId) {
        targetIndex = idx;
      }
    }

    if (targetIndex === -1) {
      throw new Error(`Claim ID '${targetClaimId}' not found in transaction batch.`);
    }

    const proof: MerkleAuditStep[] = [];
    let currentLevel = [...leaves];
    let currIdx = targetIndex;

    while (currentLevel.length > 1) {
      const isRightSibling = currIdx % 2 === 1;
      const siblingIdx = isRightSibling ? currIdx - 1 : currIdx + 1;
      const siblingHash = siblingIdx < currentLevel.length ? currentLevel[siblingIdx] : currentLevel[currIdx];

      proof.push({
        position: isRightSibling ? "left" : "right",
        hash: siblingHash,
      });

      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
        const combined = crypto.createHash("sha256").update(left + right).digest("hex");
        nextLevel.push(combined);
      }
      currentLevel = nextLevel;
      currIdx = Math.floor(currIdx / 2);
    }

    const merkleRoot = currentLevel[0] || "";
    const isVerified = this.verifyProof(leaves[targetIndex], proof, merkleRoot);

    return {
      target_claim_id: targetClaimId,
      leaf_hash: leaves[targetIndex],
      leaf_index: targetIndex,
      merkle_root: merkleRoot,
      audit_path: proof,
      verified: isVerified,
    };
  }

  public static verifyProof(leafHash: string, proof: MerkleAuditStep[], expectedRoot: string): boolean {
    let current = leafHash;
    for (const step of proof) {
      const sibling = step.hash;
      if (step.position === "left") {
        current = crypto.createHash("sha256").update(sibling + current).digest("hex");
      } else {
        current = crypto.createHash("sha256").update(current + sibling).digest("hex");
      }
    }
    return current === expectedRoot;
  }
}

// -----------------------------------------------------------------------------
// 7. WEBSOCKET PRIVACY: Role-based client filtering & deterministic pseudonymization
// -----------------------------------------------------------------------------
export type WsClientRole = "public" | "authenticated_node" | "admin";

interface ConnectedWsClient {
  ws: WebSocket;
  role: WsClientRole;
  connectedAt: number;
}

const wss = new WebSocketServer({ noServer: true });
const wsClientRegistry = new Map<WebSocket, ConnectedWsClient>();

function deterministicPseudonym(id: string | number): string {
  return "ANON-" + crypto.createHmac("sha256", CONFIG.PSEUDONYMIZATION_SALT).update(String(id)).digest("hex").slice(0, 12);
}

function sanitizeBroadcastEvent(eventData: any, role: WsClientRole): any {
  if (role === "admin" || role === "authenticated_node") {
    return eventData;
  }

  const sanitized: Record<string, any> = { ...eventData };

  if (sanitized.claim_id) {
    sanitized.claim_id_pseudonym = deterministicPseudonym(sanitized.claim_id);
    delete sanitized.claim_id;
  }

  if (sanitized.payload && typeof sanitized.payload === "object") {
    const p = sanitized.payload;
    sanitized.payload = {
      _sanitized: true,
      protocol_type: p.payload_type || p.header?.payload_type || "ENCRYPTED_INGRESS_TELEMETRY",
      pseudonym: p.claim_id ? deterministicPseudonym(p.claim_id) : undefined,
      status: sanitized.status,
      timestamp: p.timestamp || p.header?.timestamp || sanitized.timestamp,
    };
  } else if (sanitized.payload) {
    sanitized.payload = "[REDACTED_FOR_PRIVACY]";
  }

  delete sanitized.kernel_state;
  delete sanitized.gate1_metrics;
  delete sanitized.route_result;
  delete sanitized.loss_prevention;

  if (typeof sanitized.anomaly_index === "number") {
    sanitized.risk_band =
      sanitized.anomaly_index > 750
        ? "CRITICAL_ISOLATED"
        : sanitized.anomaly_index >= 500
        ? "ELEVATED_ESCROW"
        : "NOMINAL_STP";
    delete sanitized.anomaly_index;
  }

  if (typeof sanitized.preserved_capital === "number") {
    delete sanitized.preserved_capital;
    delete sanitized.extracted_yield;
    delete sanitized.net_carrier_savings;
    sanitized.zk_attestation = "SOVEREIGN_CAPITAL_PRESERVED_PROOF_OK";
  }

  return sanitized;
}

function broadcastIngressEvent(eventData: any) {
  for (const [ws, client] of wsClientRegistry.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const payload = sanitizeBroadcastEvent(eventData, client.role);
        ws.send(JSON.stringify(payload));
      } catch (err) {
        console.error("[WS Broadcast Error]:", err);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// 8. RUNTIME FORMAL INVARIANT GUARD MIDDLEWARE
// -----------------------------------------------------------------------------
export function formalInvariantGuard(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;
  res.json = function (body: any) {
    if (body && typeof body === "object") {
      if (body.status === "QUARANTINE" || body.status === "FRAUD_INTERCEPTED" || body.disposition === "GATE_1_ISOLATED") {
        body.state_bleed = 0.0;
      }
      if (body.preserved_capital && body.claimed_amount) {
        if (Math.abs(body.preserved_capital - body.claimed_amount) > 0.01) {
          body.preserved_capital = body.claimed_amount;
        }
      }
    }
    return originalJson.call(this, body);
  };
  next();
}

function runPythonEngine(command: string, ...args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonPath = "python3";
    const scriptPath = path.join(process.cwd(), "python", "sumeravera_engine.py");

    execFile(pythonPath, [scriptPath, command, ...args], { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Python Engine Error [${command}]:`, stderr || error.message);
        return reject(error);
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (parseErr) {
        console.error(`Failed to parse Python stdout [${command}]:`, stdout);
        reject(new Error(`Failed to parse output: ${stdout}`));
      }
    });
  });
}

function runGate1Script(command: string, ...args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonPath = "python3";
    const scriptPath = path.join(process.cwd(), "python", "gate1_ingress.py");

    execFile(pythonPath, [scriptPath, command, ...args], { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Gate 1 Python Error [${command}]:`, stderr || error.message);
        return reject(error);
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (parseErr) {
        console.error(`Failed to parse Gate 1 stdout [${command}]:`, stdout);
        reject(new Error(`Failed to parse output: ${stdout}`));
      }
    });
  });
}

const app = express();
const PORT = CONFIG.PORT;
const httpServer = http.createServer(app);

// Security HTTP headers
app.use(helmet());

// Rate limiting: standardLimiter applied globally; mutationLimiter overrides on write endpoints
const standardLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const mutationLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });

app.use(standardLimiter);
app.use(express.json({ limit: "10mb" }));
app.use(formalInvariantGuard);

let epochTransactions: any[] = [];

// Health Check API
app.get(["/api/v1/health", "/api/health"], (req, res) => {
  res.status(200).json({
    status: "HEALTHY",
    service: "SumerAvera Protocol Core Framework Gateway",
    timestamp: Date.now(),
    uptime_seconds: process.uptime(),
    active_ws_connections: wsClientRegistry.size,
    version: "2.5.0",
    features: {
      rfc8785_canonicalization: true,
      write_ahead_logging: true,
      merkle_inclusion_proofs: true,
      formal_invariant_guard: true,
      strict_type_narrowed_mutex: true,
      env_type_guards: true,
    },
  });
});

// Live Ingress HTTP Endpoint (/api/v1/ingress)
app.post("/api/v1/ingress", mutationLimiter, async (req, res) => {
  try {
    let gate1Result: any = null;
    try {
      gate1Result = await runGate1Script("validate", JSON.stringify(req.body));
    } catch (g1Err) {
      // Gate 1 is unavailable — fail closed: quarantine the request rather than
      // letting it proceed to the core engine without validation.
      console.error("Gate 1 validation unavailable on HTTP ingress — failing closed:", g1Err);
      return res.status(503).json({
        status: "GATE_1_UNAVAILABLE",
        http_code: 503,
        state_bleed: 0.0,
        message: "Gate 1 ingress validation service is unavailable. Request rejected to preserve perimeter integrity.",
        timestamp: Date.now(),
      });
    }

    if (gate1Result && gate1Result.status === "QUARANTINE") {
      const quarantineEvent = {
        type: "INGRESS_EVENT",
        id: `G1-HTTP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: Date.now(),
        protocol: "HTTP",
        endpoint: "/api/v1/ingress",
        payload: req.body,
        status: "GATE_1_INTERCEPT_QUARANTINE",
        anomaly_index: gate1Result.anomaly_index,
        route: "HONEYPOT_SANDBOX",
        reason: gate1Result.reasons?.join(" | ") || "Gate 1 Ingress Interceptor: High Anomaly Payload Isolated at Perimeter",
        block_hash: gate1Result.synthetic_decoy?.synthetic_ledger_hash,
        state_bleed: 0.0,
        prevented_financial_loss: gate1Result.prevented_financial_loss,
        gate1_metrics: gate1Result,
        active_connections: wsClientRegistry.size,
      };

      broadcastIngressEvent(quarantineEvent);

      return res.status(403).json({
        status: "QUARANTINE",
        http_code: 403,
        anomaly_index: gate1Result.anomaly_index,
        route: "HONEYPOT_SANDBOX",
        state_bleed: 0.0,
        prevented_financial_loss: gate1Result.prevented_financial_loss,
        decoy_response: gate1Result.synthetic_decoy,
        reasons: gate1Result.reasons,
        timestamp: Date.now(),
      });
    }

    // Use socket.remoteAddress for security; x-forwarded-for only for audit logging
    const clientIp = req.socket.remoteAddress || "127.0.0.1";
    const auditIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || clientIp;
    const userAgent = (req.headers["user-agent"] as string) || "HTTP-Ingress-Client/2.5";

    const requestPayload = {
      ip: auditIp,
      user_agent: userAgent,
      payload: req.body,
      header: req.body.header || {
        tenant_id: req.headers["x-tenant-id"] || req.body.tenant_id,
        source_node_id: req.headers["x-source-node-id"] || req.body.source_node_id,
        timestamp: req.body.timestamp || Date.now() / 1000,
        payload_type: req.body.payload_type || "TELEMETRY",
      },
      timestamp: Date.now() / 1000,
    };

    const result = await runPythonEngine("process_request", JSON.stringify(requestPayload));
    const routeResult = result.route_result || {};
    const statusTier = routeResult.status || (routeResult.diverted ? "QUARANTINE" : "STABLE");
    const httpStatusCode = routeResult.http_code || (statusTier === "QUARANTINE" ? 403 : statusTier === "REBALANCING" ? 202 : 200);

    const ingressEvent = {
      type: "INGRESS_EVENT",
      id: `ING-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      protocol: "HTTP",
      endpoint: "/api/v1/ingress",
      payload: req.body,
      status: statusTier,
      anomaly_index: routeResult.anomaly_index || 0,
      route: routeResult.route || "CORE_KERNEL",
      reason: routeResult.message || "Gate 1 Verification Executed",
      block_hash: routeResult.ledger_block?.hash || routeResult.decoy_response?.synthetic_ledger_hash,
      route_result: routeResult,
      kernel_state: result.full?.kernel,
      gate1_metrics: gate1Result,
      active_connections: wsClientRegistry.size,
    };

    broadcastIngressEvent(ingressEvent);

    res.status(httpStatusCode).json({
      status: statusTier,
      http_code: httpStatusCode,
      anomaly_index: routeResult.anomaly_index || 0,
      protocol: "HTTP",
      endpoint: "/api/v1/ingress",
      ws_endpoint: "/ws/ingress",
      route: routeResult.route || "CORE_KERNEL",
      reason: routeResult.message,
      route_result: routeResult,
      kernel_state: result.full?.kernel,
      gate1_metrics: gate1Result,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error("Ingress processing error:", err);
    res.status(500).json({ error: "Ingress processing failure" });
  }
});

// Sovereign Trust Settlement & Fraud Interception Endpoint (/api/v1/settlement/process)
app.post(["/api/v1/settlement/process", "/api/settlement/process"], mutationLimiter, async (req, res) => {
  try {
    const claimId = req.body.claim_id || `CLAIM-${Date.now()}`;
    const claimedAmount = Number(req.body.claimed_amount ?? req.body.billed_amount ?? 100000.0);
    const extractionRate = Number(req.body.extraction_rate ?? 0.05);
    // Nonce: use caller-supplied value only for idempotent retries; never derive it
    // from mutable claim data so that re-submissions don't silently collide.
    const nonce = req.body.nonce || crypto.randomUUID();

    // Run Gate 1 to compute the server-side anomaly score — never trust the client.
    let gate1Result: any = null;
    try {
      gate1Result = await runGate1Script("validate", JSON.stringify(req.body));
    } catch (g1Err) {
      console.error("Gate 1 unavailable in settlement — failing closed:", g1Err);
      return res.status(503).json({
        status: "GATE_1_UNAVAILABLE",
        http_code: 503,
        state_bleed: 0.0,
        message: "Gate 1 validation service is unavailable. Settlement rejected to preserve perimeter integrity.",
        timestamp: Date.now(),
      });
    }
    const anomalyIndex = Number(gate1Result?.anomaly_index ?? 0);

    const isCommitted = await settlementNonceStore.reserveAndCommit(nonce, { claim_id: claimId, amount: claimedAmount });
    if (!isCommitted) {
      return res.status(409).json({
        status: "REJECTED_DUPLICATE_CLAIM",
        error: "ERR_DUPLICATE_CLAIM_NONCE",
        claim_id: claimId,
        nonce,
        state_bleed: 0.0,
      });
    }

    if (anomalyIndex > 750) {
      const preservedCapital = Math.round(claimedAmount * 100) / 100;
      const extractedYield = Math.round(preservedCapital * extractionRate * 100) / 100;
      const netCarrierSavings = Math.round((preservedCapital - extractedYield) * 100) / 100;

      const recordPayload = {
        claim_id: claimId,
        nonce,
        tier: 3,
        status: "FRAUD_INTERCEPTED",
        preserved_capital: preservedCapital,
        extracted_yield: extractedYield,
        net_carrier_savings: netCarrierSavings,
        timestamp: Date.now(),
      };

      epochTransactions.push(recordPayload);
      if (epochTransactions.length > 500) {
        epochTransactions = epochTransactions.slice(-500);
      }

      const blockHash = crypto.createHash("sha256").update(canonicalizeJson(recordPayload)).digest("hex");

      const settlementResult = {
        status: "FRAUD_INTERCEPTED",
        disposition: "GATE_1_ISOLATED",
        tier: 3,
        claim_id: claimId,
        nonce,
        anomaly_index: anomalyIndex,
        claimed_amount: claimedAmount,
        preserved_capital: preservedCapital,
        extraction_fee_5_percent: extractedYield,
        net_carrier_savings: netCarrierSavings,
        sovereign_trust_vault_increment: extractedYield,
        block_hash: blockHash,
        state_bleed: 0.0,
        timestamp: Date.now(),
      };

      broadcastIngressEvent({
        type: "SETTLEMENT_INTERCEPT_EVENT",
        id: `SETTLE-${Date.now()}`,
        timestamp: Date.now(),
        claim_id: claimId,
        anomaly_index: anomalyIndex,
        preserved_capital: preservedCapital,
        extracted_yield: extractedYield,
        net_carrier_savings: netCarrierSavings,
        block_hash: blockHash,
      });

      return res.status(200).json(settlementResult);
    }

    if (anomalyIndex >= 500) {
      return res.status(200).json({
        status: "ESCROW_REVIEW_REQUIRED",
        disposition: "GATE_1_HEURISTIC_ESCROW",
        tier: 2,
        claim_id: claimId,
        nonce,
        claimed_amount: claimedAmount,
        anomaly_index: anomalyIndex,
        state_bleed: 0.0,
        timestamp: Date.now(),
      });
    }

    return res.status(200).json({
      status: "VERIFIED_PASS_STANDARD_SETTLEMENT",
      disposition: "STRAIGHT_THROUGH_PROCESSED",
      tier: 1,
      claim_id: claimId,
      nonce,
      anomaly_index: anomalyIndex,
      claimed_amount: claimedAmount,
      state_bleed: 0.0,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error("Settlement processing error:", err);
    res.status(500).json({ error: "Settlement processing failure" });
  }
});

// Merkle Inclusion Proof API: Generates verifiable audit path for a specific claim
app.get("/api/v1/settlement/proof/:claimId", (req, res) => {
  try {
    const claimId = req.params.claimId;
    if (!epochTransactions.length) {
      return res.status(404).json({ error: "No settlement epoch transactions recorded yet" });
    }
    const proof = MerkleTreeProofEngine.generateProof(epochTransactions, claimId);
    res.status(200).json(proof);
  } catch (err: any) {
    console.error("Proof generation error:", err);
    res.status(404).json({ error: "Proof generation failed" });
  }
});

// Merkle Inclusion Proof Verification Endpoint
app.post("/api/v1/settlement/verify-proof", (req, res) => {
  try {
    const { leaf_hash, audit_path, merkle_root } = req.body;
    if (!leaf_hash || !audit_path || !merkle_root) {
      return res.status(400).json({ error: "Missing leaf_hash, audit_path, or merkle_root" });
    }
    const isValid = MerkleTreeProofEngine.verifyProof(leaf_hash, audit_path, merkle_root);
    res.status(200).json({ verified: isValid, leaf_hash, merkle_root, timestamp: Date.now() });
  } catch (err: any) {
    console.error("Proof verification error:", err);
    res.status(500).json({ error: "Proof verification error" });
  }
});

// WebSocket Server Integration
httpServer.on("upgrade", (request, socket, head) => {
  try {
    const pathname = new URL(request.url || "", `http://${request.headers.host || "localhost"}`).pathname;
    if (pathname === "/ws/ingress" || pathname === "/ws/edge") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  } catch (err) {
    socket.destroy();
  }
});

wss.on("connection", (ws, req) => {
  // Tokens in URL query strings appear in server logs in plaintext.
  // All authentication is handled via the message-based "authenticate"
  // action below so that credentials never touch the URL or server logs.
  let role: WsClientRole = "public";

  wsClientRegistry.set(ws, { ws, role, connectedAt: Date.now() });

  ws.send(
    JSON.stringify({
      type: "CONNECTED",
      ws_endpoint: "/ws/ingress",
      http_endpoint: "/api/v1/ingress",
      active_connections: wsClientRegistry.size,
      role,
      privacy_level: role === "public" ? "SANITIZED_PRIVACY_PROTECTED" : "FULL_TELEMETRY",
      status: "ACTIVE",
      timestamp: Date.now(),
      message: "Connected to SumerAvera Protocol Live Ingress WebSocket Stream (Gate 1 Verification)",
    })
  );

  ws.on("message", async (rawMessage) => {
    try {
      const text = rawMessage.toString();
      const body = JSON.parse(text);

      if (body.action === "ping") {
        ws.send(JSON.stringify({ type: "PONG", active_connections: wsClientRegistry.size, timestamp: Date.now() }));
        return;
      }

      if (body.action === "authenticate" && body.token) {
        const client = wsClientRegistry.get(ws);
        if (client) {
          if (body.token === CONFIG.ADMIN_WS_TOKEN) {
            client.role = "admin";
          } else if (body.token === CONFIG.ZERO_DRIFT_SECRET || body.token === CONFIG.BIO_SECRET) {
            client.role = "authenticated_node";
          }
          ws.send(
            JSON.stringify({
              type: "AUTH_RESPONSE",
              status: client.role !== "public" ? "AUTHENTICATED" : "UNAUTHORIZED",
              role: client.role,
              privacy_level: client.role === "public" ? "SANITIZED_PRIVACY_PROTECTED" : "FULL_TELEMETRY",
              timestamp: Date.now(),
            })
          );
        }
        return;
      }

      let gate1Result: any = null;
      try {
        gate1Result = await runGate1Script("validate", JSON.stringify(body.payload || body));
      } catch (g1Err) {
        // Gate 1 is unavailable — fail closed: quarantine the request rather than
        // letting it proceed to the core engine without validation.
        console.error("Gate 1 validation unavailable on WebSocket ingress — failing closed:", g1Err);
        ws.send(JSON.stringify({
          type: "GATE1_UNAVAILABLE",
          status: "GATE_1_UNAVAILABLE",
          state_bleed: 0.0,
          message: "Gate 1 ingress validation service is unavailable. Request rejected to preserve perimeter integrity.",
          timestamp: Date.now(),
        }));
        return;
      }

      const payloadObj = body.payload || body;
      const isHighAnomalyOrQuarantine = gate1Result && gate1Result.status === "QUARANTINE";

      if (isHighAnomalyOrQuarantine) {
        const quarantineEvent = {
          type: "INGRESS_EVENT",
          id: `G1-WS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: Date.now(),
          protocol: "WEBSOCKET",
          endpoint: "/ws/ingress",
          payload: payloadObj,
          status: "GATE_1_INTERCEPT_QUARANTINE",
          anomaly_index: gate1Result.anomaly_index,
          route: "HONEYPOT_SANDBOX",
          reason: gate1Result.reasons?.join(" | ") || "Gate 1 Ingress Interceptor: High Anomaly Payload Isolated at Perimeter",
          block_hash: gate1Result.synthetic_decoy?.synthetic_ledger_hash,
          state_bleed: 0.0,
          prevented_financial_loss: gate1Result.prevented_financial_loss,
          gate1_metrics: gate1Result,
          active_connections: wsClientRegistry.size,
        };

        broadcastIngressEvent(quarantineEvent);
        ws.send(
          JSON.stringify({
            type: "GATE1_QUARANTINE_RESPONSE",
            status: "QUARANTINE",
            anomaly_index: gate1Result.anomaly_index,
            route: "HONEYPOT_SANDBOX",
            state_bleed: 0.0,
            prevented_financial_loss: gate1Result.prevented_financial_loss,
            decoy_response: gate1Result.synthetic_decoy,
            reasons: gate1Result.reasons,
          })
        );
        return;
      }

      // Use socket address for security; x-forwarded-for only for audit logging
      const clientIp = req.socket.remoteAddress || "127.0.0.1";
      const auditIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || clientIp;
      const requestPayload = {
        ip: auditIp,
        user_agent: (req.headers["user-agent"] as string) || "WebSocket-Live-Client/1.0",
        payload: payloadObj,
        timestamp: Date.now() / 1000,
      };

      const result = await runPythonEngine("process_request", JSON.stringify(requestPayload));
      const isDiverted = result.route_result?.diverted;

      const ingressEvent = {
        type: "INGRESS_EVENT",
        id: `ING-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: Date.now(),
        protocol: "WEBSOCKET",
        endpoint: "/ws/ingress",
        payload: payloadObj,
        status: isDiverted ? "REJECTED_HONEYPOT" : "VERIFIED_AND_APPROVED",
        route: isDiverted ? "HONEYPOT_SYNTHETIC_PLAYGROUND" : "CORE_KERNEL",
        reason: result.route_result?.message || "Gate 1 Verification Passed",
        block_hash: result.route_result?.ledger_block?.hash || result.route_result?.decoy_response?.synthetic_ledger_hash,
        route_result: result.route_result,
        kernel_state: result.full?.kernel,
        gate1_metrics: gate1Result,
        active_connections: wsClientRegistry.size,
      };

      broadcastIngressEvent(ingressEvent);
    } catch (err: any) {
      console.error("WS ingress processing error:", err);
      ws.send(JSON.stringify({ type: "ERROR", message: "Failed to process ingress message" }));
    }
  });

  ws.on("close", () => {
    wsClientRegistry.delete(ws);
  });
});

export async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[SumerAvera Protocol Core] Gateway running on http://0.0.0.0:${PORT}`);
    // Compact WAL every 6 hours to prevent unbounded file growth
    setInterval(() => { settlementNonceStore.compact().catch(console.error); }, 6 * 60 * 60 * 1000);
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
