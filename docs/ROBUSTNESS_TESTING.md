# Robustness Testing and Rollout

## Layered test model

- **Unit and invariant tests:** deterministic state and arithmetic safety checks (`test/invariants.test.mjs`).
- **Integration tests:** API and WebSocket behavior with live server process (`test/integration.security-resilience.test.mjs`).
- **Failure-path tests:** malformed payloads, invalid signatures, and nonce replay rejection.
- **Regression checks:** repeatable baseline assertions for settlement tiering and ledger constraints.
- **Security/adversarial checks:** unauthorized WebSocket auth and invariant rejection pathways.

## Load and soak validation

- Burst mode: `npm run test:load`
- Soak mode: `npm run test:soak`

Use CI burst checks for fast regressions and run soak tests pre-release or before scaling changes.

## CI quality gates

Verification pipeline enforces:
- Type linting
- Regression/integration tests
- Coverage threshold test run
- Security dependency audit (`npm audit --audit-level=high`)
- Build and smoke checks
- Burst load verification

## Operational resilience checks

- Restart recovery and nonce replay durability across process restarts.
- File-backed settlement state path integrity.
- Health endpoint continuity under repeated requests.

## Staged rollout model

1. **Dev:** validate new behavior and invariants.
2. **Staging:** execute integration and security checks with representative data.
3. **Canary:** release to a restricted traffic slice and monitor anomalies.
4. **Full:** promote after canary SLO pass and incident-free observation window.

## Observability standards

Track and alert on:
- health endpoint failures
- elevated quarantine/diversion anomalies
- settlement replay rejections
- API 4xx/5xx spikes
- latency outliers from load checks
