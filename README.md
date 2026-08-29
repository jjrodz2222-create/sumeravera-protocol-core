# SumerAvera Protocol Core

> **Homeostatic multi-agent state-verification framework with deterministic ingress interception, cryptographic settlement, and a real-time monitoring dashboard.**

[![CI](https://github.com/jjrodz2222-create/sumeravera-protocol-core/actions/workflows/verify.yml/badge.svg)](https://github.com/jjrodz2222-create/sumeravera-protocol-core/actions/workflows/verify.yml)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Key Concepts](#key-concepts)
4. [Setup](#setup)
5. [Usage](#usage)
6. [Testing](#testing)
7. [Configuration](#configuration)
8. [Security Considerations](#security-considerations)
9. [Contributing](#contributing)

---

## Overview

SumerAvera Protocol Core is a full-stack framework that combines a **TypeScript/Node.js** backend engine with **Python** mathematical sub-agents and a **React** real-time dashboard. Together they implement:

- **Gate 1 Ingress Interception** — cryptographically authenticated payload routing with anomaly-indexed three-tier disposition (Stable → Rebalancing → Quarantine).
- **Homeostatic Engine** — a Lotka-Volterra-inspired equilibrium model that tracks a five-node resource vector (`bio`, `art`, `spirit`, `water`, `energy`) and enforces capacity bounds.
- **Deterministic Settlement** — nonce-idempotent claim processing backed by a Write-Ahead Log (WAL) and a Merkle-tree proof engine for O(log N) state verification.
- **SHA-256 State Ledger** — an append-only, hash-chained ledger that records every state transition for immutable audit.
- **Truth Verification Engine** — a formal TLA⁺-inspired specification layer that inspects proof records against protocol invariants.

The framework is designed for research, simulation, and protocol validation workloads.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Dashboard (Vite)                   │
│  HomeostaticEngineView · Gate1IngressEngineView              │
│  SHA256LedgerExplorer · TruthVerificationConsole             │
│  SecurityReportView · HistoricalTrendsView · SystemLogs      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP + WebSocket
┌────────────────────────▼────────────────────────────────────┐
│               TypeScript / Node.js Core Server               │
│  • Express REST API (/api/v1/*)                              │
│  • WebSocket ingress stream (/ws/ingress)                    │
│  • RobustSettlementWALStore  (nonce deduplication + WAL)     │
│  • MerkleTreeProofEngine     (inclusion proofs)              │
│  • verifyCryptographicHmac   (HMAC-SHA256 auth)              │
│  • formalInvariantGuard      (request/response middleware)   │
└────────────────────────┬────────────────────────────────────┘
                         │ execFile / child_process
┌────────────────────────▼────────────────────────────────────┐
│                   Python Mathematical Agents                  │
│  gate1_ingress.py      – ingress validation & routing        │
│  sumeravera_engine.py  – homeostatic equilibrium model       │
│  settlement_engine.py  – SHA-256 ledger & settlement         │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### Carrying-Capacity Bounds Enforcement

The active resource vector **E(t)** is bounded:

```
E_floor ≤ E(t) ≤ E_capacity
```

If a submitted delta would breach `E_capacity`, the engine activates backpressure (throttling / rejection) to protect state integrity.

### Three-Tier Anomaly Routing

Every ingress payload receives an **anomaly index** (0–1000). Routing is deterministic:

| Anomaly Index | Tier | Disposition                  |
|---------------|------|------------------------------|
| 0 – 499       | 1    | `STRAIGHT_THROUGH_PROCESSED` |
| 500 – 750     | 2    | `GATE_1_HEURISTIC_ESCROW`    |
| 751 – 1000    | 3    | `GATE_1_ISOLATED` (quarantine) |

> **Note:** The Python ingress agent (`gate1_ingress.py`) uses a lower STP ceiling of ≤250 before promoting a payload to rebalancing; the TypeScript settlement layer and the test suite use ≥500 as the Escrow threshold. Both layers treat >750 as hard quarantine.

Tier-3 quarantined payloads have `state_bleed = 0.0` enforced — they produce no state mutation.

### Nonce Idempotency

Each ingress event carries a unique cryptographic nonce. The `RobustSettlementWALStore` stores committed nonces in an in-memory set backed by a WAL file:

```
∀ Ek ∈ IngressQueue,  State(t+1) = State(t)  iff  Nk ∈ NonceStore
```

Duplicate submissions are rejected, preventing replay attacks.

### Merkle State Verification

Batch settlement epochs commit a set of transactions whose leaf hashes are assembled into a binary Merkle tree. The resulting root enables O(log N) inclusion proofs without replaying historical logs.

### SHA-256 Hash-Chained Ledger

Every state transition is recorded as a block:

```json
{ "index": N, "prev_hash": "<hash of block N-1>", "action": "...", ... }
```

Chain integrity is verified by confirming `block[N].prev_hash == sha256(block[N-1])`.

### HMAC-SHA256 Authentication

All inter-node and client messages are authenticated with HMAC-SHA256 using a configurable master key. The implementation uses Node's `crypto.timingSafeEqual` to prevent timing-oracle attacks.

---

## Setup

### Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Node.js | 20.x |
| Python | 3.9 |
| npm | 10.x |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/jjrodz2222-create/sumeravera-protocol-core.git
cd sumeravera-protocol-core

# 2. Install Node.js dependencies
npm install

# 3. Copy environment configuration
cp .env.example .env
# Edit .env and set strong secret values (see Configuration section)
```

### Docker (optional)

```bash
# Build and start a production node
docker compose up --build
```

The container exposes port **3000** for both HTTP/dashboard and WebSocket ingress (`/ws/ingress`).

---

## Usage

### Development server

```bash
npm run dev
```

Starts the Express API and embedded Vite dev server (with hot-reload) at `http://localhost:3000`.
`npm run dev` runs `tsx src/server.ts`; the server creates a Vite middleware internally when `NODE_ENV` is not `production`.

### Production build

```bash
npm run build
npm start
```

### Python benchmark

```bash
python3 benchmark.py
```

Runs a standalone throughput benchmark of the Python mathematical engines without starting the full server.

### Key API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/v1/health` | Liveness check |
| `POST` | `/api/v1/ingress` | Submit a signed ingress payload |
| `GET`  | `/api/v1/ingress/stats` | Live ingress counters and routing summary |
| `POST` | `/api/v1/gate1/validate` | Directly invoke the Gate 1 ingress validator |
| `POST` | `/api/v1/settlement/process` | Process a single settlement claim (fraud-intercepted or STP) |
| `POST` | `/api/v1/settlement/batch` | Process a batch settlement epoch and return Merkle root |
| `GET`  | `/api/v1/manifest` | Download the audit manifest |
| `WS`   | `/ws/ingress` | Real-time ingress event stream (same port as HTTP) |

---

## Testing

The test suite is located in `test/invariants.test.mjs` and exercises production classes exported from `src/server.ts`.

```bash
npm test
```

### What the tests cover

| Test | Invariant |
|------|-----------|
| Carrying-capacity bounds | `E_floor ≤ E(t) ≤ E_capacity` and claim-amount numeric bounds guard (`[0, 1 000 000]`) |
| Quintet node equilibrium | Five-node resource vector values within `[0, 100]` |
| SHA-256 ledger chain validity | Hash-linking correctness, digest length |
| Zero state bleed on quarantine | `state_bleed = 0.0` on `QUARANTINE` / `FRAUD_INTERCEPTED` / `GATE_1_ISOLATED` responses |
| Three-tier routing thresholds | Boundary values at 750 (quarantine) and 500 (escrow) in the TypeScript settlement layer |
| Nonce idempotency & replay defence | `RobustSettlementWALStore` rejects duplicate nonces |
| Merkle root determinism | Same leaf set → same root; inclusion proof round-trips; tampered root fails |
| Capital preservation (synthetic fraud) | Anomaly index > 750 → 100% capital quarantined |
| Sovereign Trust extraction split | 5% extraction fee, 95% net carrier savings |
| STP / Escrow / Hard-intercept policy tiers | Three-tier disposition routing (STRAIGHT_THROUGH / HEURISTIC_ESCROW / GATE_1_ISOLATED) |

```bash
# Lint (TypeScript type-check)
npm run lint

# Build
npm run build
```

---

## Configuration

Copy `.env.example` to `.env` and customise the values below. **Never commit real secrets.**

| Variable | Description | Default (dev only) |
|----------|-------------|-------------------|
| `PORT` | HTTP server port | `3000` |
| `PROTOCOL_VERSION` | Protocol version tag | `2.5.0` |
| `SECURE_ZERO_DRIFT_SECRET_KEY` | Primary HMAC signing key | insecure dev default |
| `SUMER_SECRET_ZERO_DRIFT` | Alias for `SECURE_ZERO_DRIFT_SECRET_KEY` | insecure dev default |
| `SUMER_HMAC_MASTER_KEY` | Master HMAC key for inter-node auth | insecure dev default |
| `SUMER_ADMIN_WS_TOKEN` | Admin WebSocket authentication token | insecure dev default |
| `SUMER_SECRET_BIO` | Bio-node signing secret | insecure dev default |
| `SUMER_SECRET_ENERGY` | Energy-node signing secret | insecure dev default |
| `SUMER_SECRET_ART` | Art-node signing secret | insecure dev default |
| `SUMER_SECRET_GAIA` | Gaia-node signing secret (Python agents) | insecure dev default |
| `SETTLEMENT_STORE_PATH` | Path to persistent settlement JSON store (WAL path is derived from this) | `./python/settlement_store.json` |
| `ENABLE_HONEYPOT_DIVERSION` | Route anomalous payloads to honeypot subsystem | `true` |
| `STATE_LEDGER_ENFORCE_INVARIANTS` | Enforce protocol invariants at runtime | `true` |
| `GEMINI_API_KEY` | Google Gemini API key (AI-assisted analysis) | — |
| `APP_URL` | Hosted service URL (used for self-referential links) | — |

All secret variables must be at least **16 characters** long. The server performs a startup type-guard check and refuses to start if required secrets are malformed.

---

## Security Considerations

- **HMAC-SHA256 message authentication** — all API requests that mutate state require a valid HMAC signature. Verification uses `crypto.timingSafeEqual` to resist timing-oracle attacks.
- **Nonce replay defence** — the `RobustSettlementWALStore` rejects duplicate nonces, enforcing exactly-once semantics and preventing replay attacks.
- **Three-tier anomaly routing** — payloads with an anomaly index above 750 are fully isolated (`state_bleed = 0.0`); they cannot mutate internal state.
- **Honeypot diversion** — when `ENABLE_HONEYPOT_DIVERSION=true`, anomalous payloads are silently redirected to an observation subsystem rather than rejected outright, facilitating threat intelligence collection.
- **Write-Ahead Logging (WAL)** — all settlement state is persisted to a WAL before acknowledgement. On restart, the WAL is replayed to recover full nonce and settlement state, preventing data loss from crashes.
- **Helmet middleware** — standard HTTP security headers (`Content-Security-Policy`, `X-Frame-Options`, etc.) are applied to every response via the `helmet` package.
- **Rate limiting** — `express-rate-limit` constrains inbound request volume to protect against denial-of-service payloads.
- **Secret management** — production deployments **must** replace every insecure development default in `.env.example` with strong random values. The `.env` file is listed in `.gitignore` and must never be committed.

---

## Contributing

1. Fork the repository and create a feature branch.
2. Install dependencies: `npm install`.
3. Run the existing test suite before making changes: `npm test`.
4. Add or update tests for any new behaviour in `test/invariants.test.mjs`.
5. Ensure `npm run lint` and `npm run build` pass without errors.
6. Open a pull request describing the change and the invariants it affects. 
