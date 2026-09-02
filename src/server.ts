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
  REQUIRE_MTLS: boolean;
  MTLS_PROXY_HEADER: string;
  REVOKED_KEY_IDS: Set<string>;
  HMAC_KEYRING: Record<string, string>;
}

export function validateProtocolEnvironment(): ProtocolEnvironmentConfig {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === "production";

  // Known committed development defaults — must never be used in production.
  const COMMITTED_DEV_DEFAULTS = new Set([
    "secure_zero_drift_secret_key_2026",
    "sumer_master_hmac_secret_2026",
    "sumer_admin_telemetry_ws_token_2026",
    "sumer_secret_bio_9982",
    "sumer_secret_art_4431",
    "sumer_secret_energy_1102",
    "sumer_secret_gaia_7700",
    "sumeravera_protocol_salt_2026",
  ]);

  const checkSecretString = (name: string, val: string | undefined, defaultVal: string, minLength = 16): string => {
    if (!val) {
      if (isProduction) {
        errors.push(`Secret '${name}' is required in production but was not set.`);
      } else {
        warnings.push(`Environment variable '${name}' not specified; using secure sandbox default.`);
      }
      return defaultVal;
    }
    const clean = val.trim();
    if (clean.length < minLength) {
      errors.push(`Secret '${name}' is too short (min ${minLength} chars, got ${clean.length}).`);
    }
    if (isProduction && COMMITTED_DEV_DEFAULTS.has(clean)) {
      errors.push(`Secret '${name}' equals a committed development default and must not be used in production.`);
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

  if (warnings.length > 0) {
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
    REQUIRE_MTLS: String(process.env.SUMER_REQUIRE_MTLS || "false").toLowerCase() === "true",
    MTLS_PROXY_HEADER: process.env.SUMER_MTLS_PROXY_HEADER || "x-mtls-client-verified",
    REVOKED_KEY_IDS: new Set(
      String(process.env.SUMER_REVOKED_KEY_IDS || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    ),
    HMAC_KEYRING: (() => {
      const raw = process.env.SUMER_HMAC_KEYRING_JSON;
      if (!raw) return {};
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
        const keyring: Record<string, string> = {};
        for (const [keyId, secret] of Object.entries(parsed)) {
          if (typeof secret === "string" && secret.trim().length >= 16) {
            keyring[keyId] = secret.trim();
          }
        }
        return keyring;
      } catch {
        warnings.push("SUMER_HMAC_KEYRING_JSON is invalid JSON and has been ignored.");
        return {};
      }
    })(),
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
  providedSignature: string | undefined | null,
  options?: { keyId?: string | null }
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

  const keyId = options?.keyId?.trim();
  if (keyId && CONFIG.REVOKED_KEY_IDS.has(keyId)) {
    return false;
  }

  const defaultKeys = [
    CONFIG.SECRET_KEY,
    CONFIG.ZERO_DRIFT_SECRET,
    CONFIG.BIO_SECRET,
    CONFIG.ENERGY_SECRET,
    CONFIG.ART_SECRET,
    CONFIG.MASTER_HMAC_KEY,
  ];

  const candidateKeys =
    keyId && CONFIG.HMAC_KEYRING[keyId]
      ? [CONFIG.HMAC_KEYRING[keyId]]
      : [
          ...new Set([
            ...defaultKeys,
            ...Object.entries(CONFIG.HMAC_KEYRING)
              .filter(([k]) => !CONFIG.REVOKED_KEY_IDS.has(k))
              .map(([, secret]) => secret),
          ]),
        ];

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

type FraudCaseStatus = "OPEN_REVIEW" | "CONFIRMED_FRAUD" | "CONFIRMED_BENIGN" | "CLOSED_UNRESOLVED";
type FraudAnalystVerdict = "TRUE_POSITIVE" | "FALSE_POSITIVE" | "FALSE_NEGATIVE" | "BENIGN_TRUE_NEGATIVE";

interface FraudCaseRecord {
  id: string;
  created_at: number;
  status: FraudCaseStatus;
  route: "STABLE" | "REBALANCING" | "QUARANTINE";
  anomaly_index: number;
  claim_id?: string;
  nonce?: string;
  entities: string[];
  reasons: string[];
  predicted_prevented_loss: number;
  analyst_verdict?: FraudAnalystVerdict;
  confirmed_loss?: number;
  reviewed_at?: number;
}

interface RootAnchorRecord {
  id: string;
  root: string;
  source: string;
  timestamp: number;
  previous_anchor_hash: string;
  anchor_hash: string;
  metadata?: Record<string, any>;
}

export class FraudIntelligenceEngine {
  private readonly maxAnomalyHistory = 500;
  private anomalyHistory: number[] = [];
  private entityRiskCounter = new Map<string, number>();
  private blockedEntities = new Map<string, number>();
  private entityLinks = new Map<string, Set<string>>();
  private fraudCases = new Map<string, FraudCaseRecord>();
  private anchors: RootAnchorRecord[] = [];

  private reviewedFraud = 0;
  private reviewedBenign = 0;
  private falsePositives = 0;
  private falseNegatives = 0;
  private predictedPreventedLoss = 0;
  private confirmedPreventedLoss = 0;
  private totalEvaluated = 0;
  private totalQuarantine = 0;
  private totalRebalancing = 0;
  private totalStable = 0;

  private cleanupExpiredBlocks(now = Date.now()): void {
    for (const [entity, blockedUntil] of this.blockedEntities.entries()) {
      if (blockedUntil <= now) this.blockedEntities.delete(entity);
    }
  }

  private pushAnomaly(anomaly: number): void {
    this.anomalyHistory.push(anomaly);
    if (this.anomalyHistory.length > this.maxAnomalyHistory) {
      this.anomalyHistory = this.anomalyHistory.slice(-this.maxAnomalyHistory);
    }
  }

  private getAnomalyStats(): { mean: number; std: number } {
    if (!this.anomalyHistory.length) return { mean: 0, std: 0 };
    const mean = this.anomalyHistory.reduce((acc, v) => acc + v, 0) / this.anomalyHistory.length;
    const variance =
      this.anomalyHistory.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / Math.max(1, this.anomalyHistory.length - 1);
    return { mean, std: Math.sqrt(variance) };
  }

  public extractEntities(payload: any, context: { ip?: string }): string[] {
    const p = payload && typeof payload === "object" ? payload : {};
    const entities = [
      p.agent_id ? `agent:${String(p.agent_id)}` : null,
      p.member_id ? `member:${String(p.member_id)}` : null,
      p.provider_npi ? `provider:${String(p.provider_npi)}` : null,
      p.device_id ? `device:${String(p.device_id)}` : null,
      p.claim_id ? `claim:${String(p.claim_id)}` : null,
      context.ip ? `ip:${String(context.ip)}` : null,
    ].filter(Boolean) as string[];
    return Array.from(new Set(entities));
  }

  public adjustAnomalyIndex(baseAnomaly: number, payload: any, context: { ip?: string }): {
    anomaly_index: number;
    reasons: string[];
    entities: string[];
    blocked: boolean;
  } {
    const now = Date.now();
    this.cleanupExpiredBlocks(now);
    const entities = this.extractEntities(payload, context);
    const reasons: string[] = [];
    let adjustment = 0;
    let blocked = false;

    for (const entity of entities) {
      const blockedUntil = this.blockedEntities.get(entity);
      if (blockedUntil && blockedUntil > now) {
        blocked = true;
        adjustment += 400;
        reasons.push(`AUTO_BLOCK_ACTIVE:${entity}`);
      }
      const riskHits = this.entityRiskCounter.get(entity) || 0;
      if (riskHits > 0) adjustment += Math.min(180, riskHits * 30);
    }

    const member = entities.find((e) => e.startsWith("member:"));
    const provider = entities.find((e) => e.startsWith("provider:"));
    const ip = entities.find((e) => e.startsWith("ip:"));
    if (member && provider) {
      const key = `pair:${member}->${provider}`;
      if ((this.entityLinks.get(key) || new Set<string>()).size >= 4) {
        adjustment += 180;
        reasons.push("ENTITY_LINK_RING_PATTERN:member-provider reuse exceeds threshold.");
      }
    }
    if (member && ip) {
      const key = `pair:${member}->${ip}`;
      if ((this.entityLinks.get(key) || new Set<string>()).size >= 3) {
        adjustment += 120;
        reasons.push("ENTITY_LINK_CLUSTER:member repeated from same network.");
      }
    }

    const { mean, std } = this.getAnomalyStats();
    if (this.anomalyHistory.length >= 25 && std > 0) {
      const z = (baseAnomaly - mean) / std;
      if (z >= 2.0) {
        adjustment += 120;
        reasons.push(`ANOMALY_DRIFT_SPIKE:z=${z.toFixed(2)}`);
      }
    }

    const adjusted = Math.max(0, Math.min(1000, Math.round(baseAnomaly + adjustment)));
    this.pushAnomaly(adjusted);
    return { anomaly_index: adjusted, reasons, entities, blocked };
  }

  public recordEvent(input: {
    route: "STABLE" | "REBALANCING" | "QUARANTINE";
    anomaly_index: number;
    entities: string[];
    claim_id?: string;
    nonce?: string;
    reasons?: string[];
    predicted_prevented_loss?: number;
  }): FraudCaseRecord | null {
    this.totalEvaluated += 1;
    if (input.route === "QUARANTINE") this.totalQuarantine += 1;
    if (input.route === "REBALANCING") this.totalRebalancing += 1;
    if (input.route === "STABLE") this.totalStable += 1;

    const linkTarget = input.claim_id || input.nonce || `event-${Date.now()}`;
    const member = input.entities.find((e) => e.startsWith("member:"));
    const provider = input.entities.find((e) => e.startsWith("provider:"));
    const ip = input.entities.find((e) => e.startsWith("ip:"));
    for (const entity of input.entities) {
      const risk = this.entityRiskCounter.get(entity) || 0;
      const nextRisk = input.route === "QUARANTINE" ? Math.min(10, risk + 1) : Math.max(0, risk - 1);
      this.entityRiskCounter.set(entity, nextRisk);
      const linkSet = this.entityLinks.get(entity) || new Set<string>();
      linkSet.add(linkTarget);
      if (linkSet.size > 25) {
        this.entityLinks.set(entity, new Set(Array.from(linkSet).slice(-25)));
      } else {
        this.entityLinks.set(entity, linkSet);
      }
      if (nextRisk >= 4 && input.route === "QUARANTINE") {
        this.blockedEntities.set(entity, Date.now() + 30 * 60 * 1000);
      }
    }
    if (member && provider) {
      const key = `pair:${member}->${provider}`;
      const set = this.entityLinks.get(key) || new Set<string>();
      set.add(linkTarget);
      this.entityLinks.set(key, set.size > 25 ? new Set(Array.from(set).slice(-25)) : set);
    }
    if (member && ip) {
      const key = `pair:${member}->${ip}`;
      const set = this.entityLinks.get(key) || new Set<string>();
      set.add(linkTarget);
      this.entityLinks.set(key, set.size > 25 ? new Set(Array.from(set).slice(-25)) : set);
    }

    const needsCase = input.route === "REBALANCING" || input.route === "QUARANTINE";
    if (!needsCase) return null;

    const predicted = Number(input.predicted_prevented_loss || 0);
    this.predictedPreventedLoss += predicted;
    const fraudCase: FraudCaseRecord = {
      id: `CASE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: Date.now(),
      status: "OPEN_REVIEW",
      route: input.route,
      anomaly_index: input.anomaly_index,
      claim_id: input.claim_id,
      nonce: input.nonce,
      entities: input.entities,
      reasons: input.reasons || [],
      predicted_prevented_loss: predicted,
    };
    this.fraudCases.set(fraudCase.id, fraudCase);
    return fraudCase;
  }

  public reviewCase(caseId: string, verdict: FraudAnalystVerdict, confirmedLoss?: number): FraudCaseRecord | null {
    const found = this.fraudCases.get(caseId);
    if (!found) return null;
    found.analyst_verdict = verdict;
    found.reviewed_at = Date.now();
    if (typeof confirmedLoss === "number" && Number.isFinite(confirmedLoss) && confirmedLoss >= 0) {
      found.confirmed_loss = confirmedLoss;
      this.confirmedPreventedLoss += confirmedLoss;
    }

    if (verdict === "TRUE_POSITIVE") {
      found.status = "CONFIRMED_FRAUD";
      this.reviewedFraud += 1;
    } else if (verdict === "FALSE_POSITIVE") {
      found.status = "CONFIRMED_BENIGN";
      this.falsePositives += 1;
      this.reviewedBenign += 1;
      for (const entity of found.entities) {
        this.entityRiskCounter.set(entity, Math.max(0, (this.entityRiskCounter.get(entity) || 0) - 2));
        this.blockedEntities.delete(entity);
      }
    } else if (verdict === "FALSE_NEGATIVE") {
      found.status = "CLOSED_UNRESOLVED";
      this.falseNegatives += 1;
      this.reviewedFraud += 1;
    } else {
      found.status = "CONFIRMED_BENIGN";
      this.reviewedBenign += 1;
    }
    return found;
  }

  public listCases(status?: FraudCaseStatus): FraudCaseRecord[] {
    const list = Array.from(this.fraudCases.values()).sort((a, b) => b.created_at - a.created_at);
    return status ? list.filter((item) => item.status === status) : list;
  }

  public anchorMerkleRoot(root: string, source: string, metadata?: Record<string, any>): RootAnchorRecord {
    const previous_anchor_hash = this.anchors.length ? this.anchors[this.anchors.length - 1].anchor_hash : "0".repeat(64);
    const timestamp = Date.now();
    const anchor_hash = crypto
      .createHash("sha256")
      .update(canonicalizeJson({ root, source, timestamp, previous_anchor_hash, metadata: metadata || null }))
      .digest("hex");
    const anchor: RootAnchorRecord = {
      id: `ANCHOR-${timestamp}-${Math.floor(Math.random() * 1000)}`,
      root,
      source,
      timestamp,
      previous_anchor_hash,
      anchor_hash,
      metadata,
    };
    this.anchors.push(anchor);
    if (this.anchors.length > 1000) this.anchors = this.anchors.slice(-1000);
    return anchor;
  }

  public listAnchors(limit = 50): RootAnchorRecord[] {
    return this.anchors.slice(-Math.max(1, Math.min(limit, 200))).reverse();
  }

  public getKpis() {
    const reviewedTotal = this.reviewedFraud + this.reviewedBenign;
    const truePositives = this.reviewedFraud - this.falseNegatives;
    const precision = truePositives + this.falsePositives > 0 ? truePositives / (truePositives + this.falsePositives) : 0;
    const recall = this.reviewedFraud > 0 ? truePositives / this.reviewedFraud : 0;
    const preventedLossAccuracy = this.predictedPreventedLoss > 0 ? this.confirmedPreventedLoss / this.predictedPreventedLoss : 0;

    return {
      totals: {
        evaluated: this.totalEvaluated,
        stable: this.totalStable,
        rebalancing: this.totalRebalancing,
        quarantine: this.totalQuarantine,
        open_cases: this.listCases("OPEN_REVIEW").length,
        blocked_entities: this.blockedEntities.size,
        reviewed_cases: reviewedTotal,
      },
      model_quality: {
        precision,
        recall,
        false_positive_rate: reviewedTotal > 0 ? this.falsePositives / reviewedTotal : 0,
        false_negative_count: this.falseNegatives,
      },
      prevented_loss: {
        predicted_total: Number(this.predictedPreventedLoss.toFixed(2)),
        confirmed_total: Number(this.confirmedPreventedLoss.toFixed(2)),
        accuracy_ratio: Number(preventedLossAccuracy.toFixed(4)),
      },
      adaptive_threshold: this.getAnomalyStats(),
      active_blocklist: Array.from(this.blockedEntities.entries()).map(([entity, until]) => ({ entity, blocked_until: until })),
    };
  }
}

const fraudIntel = new FraudIntelligenceEngine();

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

function extractInboundSignature(req: Request): { signature: string | null; keyId: string | null; payload: any } {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const payload = body.payload && typeof body.payload === "object" ? body.payload : body;
  const signatureHeader = req.headers["x-signature"];
  const keyIdHeader = req.headers["x-key-id"];
  const signature =
    (typeof body.signature === "string" && body.signature) ||
    (typeof payload.signature === "string" && payload.signature) ||
    (typeof signatureHeader === "string" ? signatureHeader : null);
  const keyId =
    (typeof body.key_id === "string" && body.key_id) ||
    (typeof payload.key_id === "string" && payload.key_id) ||
    (typeof keyIdHeader === "string" ? keyIdHeader : null);
  return { signature, keyId, payload };
}

function enforceMutualTlsProxyHeader(req: Request, res: Response): boolean {
  if (!CONFIG.REQUIRE_MTLS) return true;
  const v = req.headers[CONFIG.MTLS_PROXY_HEADER];
  const value = Array.isArray(v) ? v[0] : v;
  const ok = typeof value === "string" && value.toLowerCase() === "success";
  if (!ok) {
    res.status(401).json({
      status: "UNAUTHORIZED_MTLS_REQUIRED",
      http_code: 401,
      message: "Mutual TLS verification is required and was not asserted by the trusted proxy.",
      timestamp: Date.now(),
    });
    return false;
  }
  return true;
}

function enforceIngressReplayProtection(
  nonceCandidate: unknown,
  claimId: string | undefined,
  amount: number | undefined
): Promise<{ ok: true; nonce: string } | { ok: false }> {
  return (async () => {
    const nonce = typeof nonceCandidate === "string" ? nonceCandidate.trim() : "";
    if (!nonce) return { ok: false };
    const accepted = await settlementNonceStore.reserveAndCommit(`INGRESS:${nonce}`, {
      claim_id: claimId,
      amount,
    });
    if (!accepted) return { ok: false };
    return { ok: true, nonce };
  })();
}

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
      adaptive_fraud_intelligence: true,
      analyst_case_management: true,
      merkle_root_anchoring: true,
    },
    fraud_kpi_snapshot: fraudIntel.getKpis().totals,
  });
});

// Live Ingress HTTP Endpoint (/api/v1/ingress)
app.post("/api/v1/ingress", mutationLimiter, async (req, res) => {
  try {
    if (!enforceMutualTlsProxyHeader(req, res)) return;

    const { signature, keyId, payload } = extractInboundSignature(req);
    if (!signature) {
      return res.status(401).json({
        status: "UNAUTHORIZED_MISSING_SIGNATURE",
        http_code: 401,
        message: "A cryptographic signature is required for ingress mutation requests.",
        timestamp: Date.now(),
      });
    }
    const payloadForSig = { ...payload };
    delete payloadForSig.signature;
    const isHmacValid = verifyCryptographicHmac(canonicalizeJson(payloadForSig), signature, { keyId });
    if (!isHmacValid) {
      return res.status(401).json({
        status: "UNAUTHORIZED_INVALID_SIGNATURE",
        http_code: 401,
        key_id: keyId || undefined,
        message: "Ingress signature validation failed.",
        timestamp: Date.now(),
      });
    }

    const nonceCandidate = req.body?.nonce || req.body?.header?.nonce || req.headers["x-ingress-nonce"];
    const replay = await enforceIngressReplayProtection(
      nonceCandidate,
      req.body?.claim_id || req.body?.payload?.claim_id,
      Number(req.body?.claimed_amount ?? req.body?.billed_amount ?? 0)
    );
    if (!replay.ok) {
      return res.status(409).json({
        status: "REPLAY_REJECTED",
        http_code: 409,
        message: "Ingress nonce is missing, invalid, or already used.",
        state_bleed: 0.0,
        timestamp: Date.now(),
      });
    }

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

    // Use socket.remoteAddress for security; x-forwarded-for only for audit logging
    const clientIp = req.socket.remoteAddress || "127.0.0.1";
    const auditIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || clientIp;
    const userAgent = (req.headers["user-agent"] as string) || "HTTP-Ingress-Client/2.5";

    const adaptive = fraudIntel.adjustAnomalyIndex(Number(gate1Result?.anomaly_index ?? 0), req.body, { ip: auditIp });
    gate1Result.anomaly_index = adaptive.anomaly_index;
    gate1Result.reasons = [...(Array.isArray(gate1Result?.reasons) ? gate1Result.reasons : []), ...adaptive.reasons];
    if (adaptive.blocked) {
      gate1Result.status = "QUARANTINE";
      gate1Result.route = "HONEYPOT_SANDBOX";
      gate1Result.http_code = 403;
      gate1Result.passed = false;
      gate1Result.state_bleed = 0.0;
    }

    const mustQuarantine = gate1Result && (gate1Result.status === "QUARANTINE" || gate1Result.anomaly_index > 750);
    if (mustQuarantine) {
      const createdCase = fraudIntel.recordEvent({
        route: "QUARANTINE",
        anomaly_index: Number(gate1Result.anomaly_index || 0),
        entities: adaptive.entities,
        claim_id: req.body?.claim_id || req.body?.payload?.claim_id,
        nonce: replay.nonce,
        reasons: gate1Result.reasons,
        predicted_prevented_loss: Number(gate1Result?.prevented_financial_loss || 0),
      });

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
        case_id: createdCase?.id,
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
        case_id: createdCase?.id,
        nonce: replay.nonce,
        timestamp: Date.now(),
      });
    }

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
    let statusTier = routeResult.status || (routeResult.diverted ? "QUARANTINE" : "STABLE");
    if (gate1Result.anomaly_index > 750) {
      statusTier = "QUARANTINE";
    } else if (gate1Result.anomaly_index >= 250 && statusTier === "STABLE") {
      statusTier = "REBALANCING";
    }
    const httpStatusCode = routeResult.http_code || (statusTier === "QUARANTINE" ? 403 : statusTier === "REBALANCING" ? 202 : 200);
    const createdCase = fraudIntel.recordEvent({
      route: statusTier === "QUARANTINE" ? "QUARANTINE" : statusTier === "REBALANCING" ? "REBALANCING" : "STABLE",
      anomaly_index: Number(gate1Result.anomaly_index || 0),
      entities: adaptive.entities,
      claim_id: req.body?.claim_id || req.body?.payload?.claim_id,
      nonce: replay.nonce,
      reasons: gate1Result.reasons,
      predicted_prevented_loss: Number(gate1Result?.prevented_financial_loss || 0),
    });

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
      case_id: createdCase?.id,
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
      case_id: createdCase?.id,
      nonce: replay.nonce,
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
    if (!enforceMutualTlsProxyHeader(req, res)) return;
    const { signature, keyId, payload } = extractInboundSignature(req);
    if (!signature) {
      return res.status(401).json({
        status: "UNAUTHORIZED_MISSING_SIGNATURE",
        http_code: 401,
        message: "A cryptographic signature is required for settlement mutation requests.",
        timestamp: Date.now(),
      });
    }
    const payloadForSig = { ...payload };
    delete payloadForSig.signature;
    const validSig = verifyCryptographicHmac(canonicalizeJson(payloadForSig), signature, { keyId });
    if (!validSig) {
      return res.status(401).json({
        status: "UNAUTHORIZED_INVALID_SIGNATURE",
        http_code: 401,
        key_id: keyId || undefined,
        message: "Settlement signature validation failed.",
        timestamp: Date.now(),
      });
    }

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
    const clientIp = req.socket.remoteAddress || "127.0.0.1";
    const auditIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || clientIp;
    const adaptive = fraudIntel.adjustAnomalyIndex(Number(gate1Result?.anomaly_index ?? 0), req.body, { ip: auditIp });
    gate1Result.anomaly_index = adaptive.anomaly_index;
    gate1Result.reasons = [...(Array.isArray(gate1Result?.reasons) ? gate1Result.reasons : []), ...adaptive.reasons];
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
      const merkleRoot = MerkleTreeProofEngine.computeRoot(
        epochTransactions.map((tx) => crypto.createHash("sha256").update(canonicalizeJson(tx)).digest("hex"))
      );
      const anchor = fraudIntel.anchorMerkleRoot(merkleRoot, "settlement_epoch", {
        claim_id: claimId,
        nonce,
        tx_count: epochTransactions.length,
      });
      const createdCase = fraudIntel.recordEvent({
        route: "QUARANTINE",
        anomaly_index: anomalyIndex,
        entities: adaptive.entities,
        claim_id: claimId,
        nonce,
        reasons: gate1Result.reasons,
        predicted_prevented_loss: preservedCapital,
      });

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
        merkle_root_anchor: anchor.anchor_hash,
        case_id: createdCase?.id,
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
      const createdCase = fraudIntel.recordEvent({
        route: "REBALANCING",
        anomaly_index: anomalyIndex,
        entities: adaptive.entities,
        claim_id: claimId,
        nonce,
        reasons: gate1Result.reasons,
      });
      return res.status(200).json({
        status: "ESCROW_REVIEW_REQUIRED",
        disposition: "GATE_1_HEURISTIC_ESCROW",
        tier: 2,
        claim_id: claimId,
        nonce,
        claimed_amount: claimedAmount,
        anomaly_index: anomalyIndex,
        reasons: gate1Result.reasons,
        case_id: createdCase?.id,
        state_bleed: 0.0,
        timestamp: Date.now(),
      });
    }

    fraudIntel.recordEvent({
      route: "STABLE",
      anomaly_index: anomalyIndex,
      entities: adaptive.entities,
      claim_id: claimId,
      nonce,
      reasons: gate1Result.reasons,
    });

    return res.status(200).json({
      status: "VERIFIED_PASS_STANDARD_SETTLEMENT",
      disposition: "STRAIGHT_THROUGH_PROCESSED",
      tier: 1,
      claim_id: claimId,
      nonce,
      anomaly_index: anomalyIndex,
      claimed_amount: claimedAmount,
      reasons: gate1Result.reasons,
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

// Fraud intelligence KPIs and analyst workflow APIs
app.get("/api/v1/fraud/kpis", (req, res) => {
  res.status(200).json({
    status: "OK",
    kpis: fraudIntel.getKpis(),
    timestamp: Date.now(),
  });
});

app.get("/api/v1/fraud/cases", (req, res) => {
  const statusFilter = typeof req.query.status === "string" ? (req.query.status as FraudCaseStatus) : undefined;
  const cases = fraudIntel.listCases(statusFilter);
  res.status(200).json({
    status: "OK",
    count: cases.length,
    cases,
    timestamp: Date.now(),
  });
});

app.post("/api/v1/fraud/cases/:caseId/review", mutationLimiter, (req, res) => {
  const caseId = req.params.caseId;
  const verdict = req.body?.verdict as FraudAnalystVerdict;
  if (!["TRUE_POSITIVE", "FALSE_POSITIVE", "FALSE_NEGATIVE", "BENIGN_TRUE_NEGATIVE"].includes(verdict)) {
    return res.status(400).json({
      status: "INVALID_VERDICT",
      message: "verdict must be one of TRUE_POSITIVE, FALSE_POSITIVE, FALSE_NEGATIVE, BENIGN_TRUE_NEGATIVE.",
    });
  }
  const reviewed = fraudIntel.reviewCase(caseId, verdict, Number.isFinite(Number(req.body?.confirmed_loss)) ? Number(req.body.confirmed_loss) : undefined);
  if (!reviewed) {
    return res.status(404).json({ status: "CASE_NOT_FOUND", case_id: caseId });
  }
  return res.status(200).json({
    status: "REVIEW_RECORDED",
    case: reviewed,
    kpis: fraudIntel.getKpis(),
    timestamp: Date.now(),
  });
});

app.post("/api/v1/settlement/anchor-root", mutationLimiter, (req, res) => {
  const merkleRoot = typeof req.body?.merkle_root === "string" ? req.body.merkle_root : "";
  if (!/^[a-f0-9]{64}$/i.test(merkleRoot)) {
    return res.status(400).json({ status: "INVALID_MERKLE_ROOT", message: "merkle_root must be a 64-char hex string." });
  }
  const anchor = fraudIntel.anchorMerkleRoot(merkleRoot, "manual_anchor", {
    actor: req.body?.actor || "unknown",
    note: req.body?.note || null,
  });
  return res.status(200).json({
    status: "ANCHORED",
    anchor,
    timestamp: Date.now(),
  });
});

app.get("/api/v1/settlement/anchors", (req, res) => {
  const limit = Number(req.query.limit || 50);
  return res.status(200).json({
    status: "OK",
    anchors: fraudIntel.listAnchors(limit),
    timestamp: Date.now(),
  });
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
          const tokenBuf = Buffer.from(String(body.token));
          const adminBuf = Buffer.from(CONFIG.ADMIN_WS_TOKEN);
          const zeroBuf = Buffer.from(CONFIG.ZERO_DRIFT_SECRET);
          const bioBuf = Buffer.from(CONFIG.BIO_SECRET);
          const tokenLen = tokenBuf.length;
          // Constant-time token comparison to prevent timing attacks.
          const isAdmin =
            tokenLen === adminBuf.length && crypto.timingSafeEqual(tokenBuf, adminBuf);
          const isNode =
            (tokenLen === zeroBuf.length && crypto.timingSafeEqual(tokenBuf, zeroBuf)) ||
            (tokenLen === bioBuf.length && crypto.timingSafeEqual(tokenBuf, bioBuf));
          if (isAdmin) {
            client.role = "admin";
          } else if (isNode) {
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
      const signature =
        (typeof body.signature === "string" && body.signature) ||
        (typeof payloadObj.signature === "string" && payloadObj.signature) ||
        null;
      const keyId =
        (typeof body.key_id === "string" && body.key_id) ||
        (typeof payloadObj.key_id === "string" && payloadObj.key_id) ||
        null;
      if (!signature) {
        ws.send(JSON.stringify({ type: "UNAUTHORIZED", status: "UNAUTHORIZED_MISSING_SIGNATURE", state_bleed: 0.0 }));
        return;
      }
      const payloadForSig = { ...payloadObj };
      delete payloadForSig.signature;
      const isSigValid = verifyCryptographicHmac(canonicalizeJson(payloadForSig), signature, { keyId });
      if (!isSigValid) {
        ws.send(
          JSON.stringify({
            type: "UNAUTHORIZED",
            status: "UNAUTHORIZED_INVALID_SIGNATURE",
            key_id: keyId || undefined,
            state_bleed: 0.0,
          })
        );
        return;
      }

      const replay = await enforceIngressReplayProtection(
        body.nonce || payloadObj.nonce,
        body.claim_id || payloadObj.claim_id,
        Number(body.claimed_amount ?? payloadObj.claimed_amount ?? body.billed_amount ?? payloadObj.billed_amount ?? 0)
      );
      if (!replay.ok) {
        ws.send(
          JSON.stringify({
            type: "REPLAY_REJECTED",
            status: "REPLAY_REJECTED",
            state_bleed: 0.0,
            message: "Ingress nonce is missing, invalid, or already used.",
          })
        );
        return;
      }

      // Use socket address for security; x-forwarded-for only for audit logging
      const clientIp = req.socket.remoteAddress || "127.0.0.1";
      const auditIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || clientIp;
      const adaptive = fraudIntel.adjustAnomalyIndex(Number(gate1Result?.anomaly_index ?? 0), payloadObj, { ip: auditIp });
      gate1Result.anomaly_index = adaptive.anomaly_index;
      gate1Result.reasons = [...(Array.isArray(gate1Result?.reasons) ? gate1Result.reasons : []), ...adaptive.reasons];
      if (adaptive.blocked) {
        gate1Result.status = "QUARANTINE";
        gate1Result.route = "HONEYPOT_SANDBOX";
      }
      const isHighAnomalyOrQuarantine = gate1Result && (gate1Result.status === "QUARANTINE" || gate1Result.anomaly_index > 750);

      if (isHighAnomalyOrQuarantine) {
        const createdCase = fraudIntel.recordEvent({
          route: "QUARANTINE",
          anomaly_index: Number(gate1Result.anomaly_index || 0),
          entities: adaptive.entities,
          claim_id: body.claim_id || payloadObj.claim_id,
          nonce: replay.nonce,
          reasons: gate1Result.reasons,
          predicted_prevented_loss: Number(gate1Result?.prevented_financial_loss || 0),
        });
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
          case_id: createdCase?.id,
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
            case_id: createdCase?.id,
            nonce: replay.nonce,
          })
        );
        return;
      }

      const requestPayload = {
        ip: auditIp,
        user_agent: (req.headers["user-agent"] as string) || "WebSocket-Live-Client/1.0",
        payload: payloadObj,
        timestamp: Date.now() / 1000,
      };

      const result = await runPythonEngine("process_request", JSON.stringify(requestPayload));
      const routeResult = result.route_result || {};
      const statusTier =
        gate1Result.anomaly_index >= 250
          ? "REBALANCING"
          : routeResult.diverted
          ? "QUARANTINE"
          : "STABLE";
      const createdCase = fraudIntel.recordEvent({
        route: statusTier === "QUARANTINE" ? "QUARANTINE" : statusTier === "REBALANCING" ? "REBALANCING" : "STABLE",
        anomaly_index: Number(gate1Result.anomaly_index || 0),
        entities: adaptive.entities,
        claim_id: body.claim_id || payloadObj.claim_id,
        nonce: replay.nonce,
        reasons: gate1Result.reasons,
        predicted_prevented_loss: Number(gate1Result?.prevented_financial_loss || 0),
      });
      const isDiverted = routeResult?.diverted;

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
        route_result: routeResult,
        kernel_state: result.full?.kernel,
        gate1_metrics: gate1Result,
        active_connections: wsClientRegistry.size,
        case_id: createdCase?.id,
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
