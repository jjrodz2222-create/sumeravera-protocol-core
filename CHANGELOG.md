# Changelog

All notable changes to the SumerAvera Protocol Core Framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.5.0] - 2026-08-20

### Release Codename
**Gateway Ingress & Deterministic Core**

### Highlights
- **Containerized Multi-Stage Deployment**: Implemented production `Dockerfile` with multi-stage build (`node:20-alpine`) for minimal container footprint, strict permission sandboxing, and integrated python engine runtime.
- **Ingress Boundary & Honeypot Diversion**: Full Four-Gate ingress routing architecture with automated threat isolation, dynamic honeypot diversion, and zero false-positive containment.
- **Real-Time Telemetry & Monitoring Probes**: Deployed `/api/v1/health` and `/api/health` probes with active container `HEALTHCHECK` (10s interval, 3s timeout, 3 retries) tracking uptime, active WebSocket connections, and protocol versioning.
- **Automated Invariant Verification CI/CD**: Established `.github/workflows/verify.yml` pipeline with static TypeScript linting, state-ledger invariant tests, and smoke test automation.
- **Security Audit Manifest Export**: Added one-click JSON audit report generator exporting real-time protocol telemetry, cryptographic hashes, and ledger depth proofs.

### Added
- Multi-stage `Dockerfile` targeting Node.js 20 and Alpine Linux runtime.
- `docker-compose.yml` defining the `sumeravera-core-node` service with persistent volume `ledger-data:/app/data` and deterministic CPU/memory limits.
- Root `.dockerignore` for build context optimization.
- GitHub Actions workflow `.github/workflows/verify.yml` for automated protocol verification across push and pull requests.
- Node.js native test suite `test/invariants.test.mjs` verifying carrying capacity bounds $[E_{\text{floor}}, E_{\text{capacity}}]$, non-negative Quintet node distributions, and SHA-256 ledger integrity.
- Comprehensive JSON manifest export in `SecurityReportView` capturing system audit logs, honeypot diversion events, EVM transactions, and TLA+ formal verification records.
- Ingress health endpoint `/api/v1/health` for docker probes and external telemetry pollers.

### Changed
- Refactored `SecurityReportView` to dynamically bind with live protocol state and ledger telemetry.
- Updated `package.json` with `npm test` script executing Node.js subtest runners.
- Synchronized protocol version identifier to `2.5.0` across server API routes, metadata, and environment defaults.

### Verification Proof
- **State-Ledger Invariants**: 100% pass rate (0 invariant violations) across state-ledger test suites and continuous boundary validation.
- **Resource Enforcement**: Deterministic limits strictly capped at **2.0 CPUs** and **2048 MB memory** under `docker-compose.yml`.

---

## [2.4.0] - 2026-08-15
### Added
- Gate 1 Ingress Engine and Honeypot logging subsystem.
- Real-time WebSocket bridge on port `8080` (`/ws/ingress`).
- Interactive Live Payload Ingress tester with threat detection engine.

---

## [2.0.0] - 2026-08-01
### Added
- Core Homeostatic Kernel balancing five-node quintet state ($\alpha, \beta, \gamma, \delta, \epsilon$).
- Cryptographic SHA-256 state ledger with tamper-evident chain verification.
- TLA+ formal specification inspector for `UnifiedTruthKernel.tla`.
