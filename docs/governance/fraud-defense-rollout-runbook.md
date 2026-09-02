# Fraud Defense Rollout Runbook

## 1) Reviewer Routing (Early)
Request explicit review and sign-off from:
- Backend owners
- Security
- Fraud/Risk Operations
- Platform/DevOps

Required sign-off topics:
- Auth model
- Replay controls
- Quarantine policy
- KPI definitions

## 2) Controlled Pilot Plan
### Pilot Environment
- Staging environment matching production topology and secrets handling.
- mTLS behavior tested through the same trusted proxy path as production.

### Pilot Traffic
- Baseline legitimate traffic replay.
- Synthetic fraud mix (replay attempts, signature failures, coordinated identity reuse, high-anomaly bursts).

### Rollback Criteria
Rollback immediately if any condition is met:
- Sustained false-positive rate above approved threshold.
- Service-impacting auth/mTLS misconfiguration.
- Inability to process critical legitimate traffic.
- Unresolved high-severity security finding.

### Go/No-Go Thresholds
- CI green (`verify.yml`, `codeql.yml`) for pilot changes.
- Quality gates pass (`npm test`, `npm run lint`, `npm run build`).
- Precision/recall trend acceptable for agreed baseline window.
- Review latency within agreed operational SLA.

### Analyst Workflow During Pilot
- Analysts triage queue from `GET /api/v1/fraud/cases`.
- Analysts submit verdicts via `POST /api/v1/fraud/cases/:caseId/review`.
- Pilot owner tracks KPI drift via `GET /api/v1/fraud/kpis`.

## 3) Phased PR Breakdown
- **Phase 1 (Auth/Replay):** signature policy, key lifecycle, nonce protections.
- **Phase 2 (Adaptive Scoring):** drift escalation, entity-link risk controls.
- **Phase 3 (Analyst APIs):** case operations and KPI visibility.
- **Phase 4 (Anchoring):** Merkle-root anchoring and verification workflows.
- **Phase 5 (Docs/Tests):** runbooks, acceptance tests, and release notes.

Each PR must map to one acceptance criterion and remain independently reviewable.

## 4) Validation Gates Per PR
Run before merge:
- `npm test`
- `npm run lint`
- `npm run build`
- Require passing GitHub workflows:
  - `.github/workflows/verify.yml`
  - `.github/workflows/codeql.yml`

## 5) Adoption Handoff
### Fraud Analysts
- Queue triage process, verdict taxonomy, KPI interpretation.

### On-call / Platform
- Incident response playbook for false-positive spikes and auth/mTLS failures.
- Rollback execution steps and owner escalation chain.

### Monitoring Cadence
- Daily pilot standup review.
- Weekly KPI trend review with security + risk ops.
- 2–4 week threshold tuning window post-launch.

## 6) Executive/Steering Checkpoint
Present:
- Prevented-loss trend
- Precision/recall trend
- Incident count and severity
- Operational overhead (analyst and platform load)
- Recommendation: full rollout / extended pilot / rollback
