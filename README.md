# SumerAvera Protocol Core Framework

SumerAvera Protocol Core is a fraud-resilient ingress, verification, and settlement protocol designed for high-risk transaction workflows.

## Primary adopters and high-value use cases

| Adopter group | Most useful protocol outcome |
| --- | --- |
| Insurers | Prevents fraudulent claims leakage with deterministic isolation and measurable preserved capital. |
| Trust/settlement operators | Enforces replay-safe settlement with nonce idempotency and auditable event chains. |
| Fraud and security teams | Delivers adversarial ingress testing, quarantine routing, and live telemetry for response operations. |

## Production distribution path

1. Build and run from the repository using `docker compose up -d --build`.
2. Validate runtime via health probes:
   - `GET /api/v1/health`
   - `GET /api/health`
3. Integrate consumers with HTTP ingress (`/api/v1/ingress`) and live WebSocket telemetry (`/ws/ingress`).

## Deployment and integration guides

- [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md)
- [`docs/INTEGRATION_KIT.md`](docs/INTEGRATION_KIT.md)
- [`docs/ROBUSTNESS_TESTING.md`](docs/ROBUSTNESS_TESTING.md)

## Trust signals

- Versioned release artifacts and release notes in [`RELEASE_NOTES.md`](RELEASE_NOTES.md)
- Changelog discipline in [`CHANGELOG.md`](CHANGELOG.md)
- Automated CI checks in [`.github/workflows/verify.yml`](.github/workflows/verify.yml)

## Public known limits

See [`docs/KNOWN_LIMITS.md`](docs/KNOWN_LIMITS.md) before production onboarding.

## Validation commands

- `npm run lint`
- `npm test`
- `npm run build`
