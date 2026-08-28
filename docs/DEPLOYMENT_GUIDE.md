# Deployment Guide

## Required environment variables

Set the following before production deployment:

- `PORT`
- `SECURE_ZERO_DRIFT_SECRET_KEY`
- `SUMER_SECRET_ZERO_DRIFT`
- `SUMER_SECRET_BIO`
- `SUMER_SECRET_ENERGY`
- `SUMER_SECRET_ART`
- `SUMER_HMAC_MASTER_KEY`
- `SUMER_ADMIN_WS_TOKEN`
- `SETTLEMENT_STORE_PATH`
- `WAL_LOG_PATH`
- `SUMER_SALT`

Reference defaults and examples in `.env.example`.

## Security expectations

1. Replace all example secret values before any external deployment.
2. Restrict network ingress to approved source systems and WAF-protected entry points.
3. Treat admin WebSocket tokens as privileged credentials and rotate on a fixed schedule.
4. Enforce TLS termination for all external HTTP and WebSocket traffic.
5. Keep settlement stores on persistent encrypted volumes and backed up with retention policy.

## Production distribution steps

1. Build and start:
   - `docker compose up -d --build`
2. Verify readiness:
   - `curl -s http://localhost:3000/api/v1/health`
3. Confirm ingress listener state:
   - `curl -s http://localhost:3000/api/v1/ingress/stats`
4. Run protocol checks:
   - `npm run lint && npm test && npm run build`

## Operations runbook

### Routine checks

- Monitor `/api/v1/health` every 10-30 seconds.
- Track anomaly diversion rates and unexpected increases in quarantine responses.
- Track 4xx/5xx rates for `/api/v1/ingress`, `/api/v1/edge/listener`, and settlement endpoints.

### Incident response

1. If health fails, isolate traffic and capture server logs.
2. Verify integrity of settlement data files and WAL paths.
3. Re-run integration and security tests before returning to normal traffic.
4. Publish incident summary and add regression tests for root cause conditions.

### Release governance

- Promote changes through environments in this order: dev -> staging -> canary -> full.
- Block full rollout unless CI verification and load checks are green.
