# Integration Kit

## Endpoint catalog

### Health and status

- `GET /api/v1/health`
- `GET /api/health`
- `GET /api/status`
- `GET /api/v1/status`
- `GET /api/history`
- `GET /api/v1/history`

### Ingress and validation

- `POST /api/v1/ingress`
- `POST /api/v1/gate1/validate`
- `POST /api/v1/gate1/comparative-test`
- `POST /api/v1/edge/handshake`
- `POST /api/v1/edge/listener`

### Settlement and security report

- `POST /api/v1/settlement/process`
- `POST /api/v1/settlement/batch`
- `GET /api/v1/security-report`
- `GET /api/v1/security-report/export`
- `GET /api/v1/manifest`

### Telemetry stream

- `WS /ws/ingress`

## Request/response contracts (minimal)

### 1) Ingress submit

`POST /api/v1/ingress`

Request shape:
- `payload` object OR top-level fields for telemetry/claim values
- Optional `header` with tenant/source identifiers

Response shape:
- `status`, `http_code`, `route`, `anomaly_index`, `reason`, `timestamp`
- `route_result` and `kernel_state` when available

### 2) Edge listener verification

`POST /api/v1/edge/listener`

Headers/body expected:
- Signature: `x-signature` (or `signature` in body)
- Optional `x-payload-hash`
- Optional `x-node-id`, `x-timestamp`, `x-sequence-number`

Success response:
- `status: TRANSITION_VERIFIED`
- `signature_valid: true`
- `payload_hash`, `route_result`, `state_ledger_block`

Failure response:
- `status: INVARIANT_REJECTED`
- `failed_invariants`, `invariant_checks`

### 3) Settlement process

`POST /api/v1/settlement/process`

Request fields:
- `claim_id`, `claimed_amount`, `anomaly_index`, `extraction_rate`, `nonce`

Response outcomes:
- Tier 3 intercept: `FRAUD_INTERCEPTED`
- Tier 2 escrow: `ESCROW_REVIEW_REQUIRED`
- Tier 1 pass: `VERIFIED_PASS_STANDARD_SETTLEMENT`
- Duplicate replay: `REJECTED_DUPLICATE_CLAIM` (`409`)

## Sample client flow

1. Check liveness (`GET /api/v1/health`).
2. Establish edge handshake (`POST /api/v1/edge/handshake`).
3. Submit signed transition (`POST /api/v1/edge/listener`).
4. Submit ingress telemetry/claim (`POST /api/v1/ingress`).
5. Execute settlement (`POST /api/v1/settlement/process`).
6. Export audit report (`GET /api/v1/security-report/export`).
7. Subscribe to live telemetry (`WS /ws/ingress`) for operational monitoring.
