# GitHub Release Draft: v0.5.0-beta.1

Tag: `v0.5.0-beta.1`
Target branch: `codex/v0.5.0-beta`
Title: `FountLayer v0.5.0-beta.1`

## Summary

FountLayer `v0.5.0-beta.1` is the first self-hosted operator beta for the open
LLM last-mile distribution layer for apps. It focuses on Gateway metering,
attribution, faucet/wallet payment checks, ledger integrity, Admin APIs, and
Console operator workflows.

This is not a hosted managed-service production launch.

## Highlights

- SDK -> Gateway -> attribution -> faucet or wallet payment check -> adapter ->
  one usage event -> balanced ledger entries -> Console readback.
- PostgreSQL-backed Gateway Store with in-memory local demo mode.
- Authenticated Admin APIs with pagination, filters, and setup writes for apps,
  channels, routes, faucet grants, pricing policies, and credential metadata.
- Console `/setup` workflow and Usage & Ledger filters.
- Server-side encrypted provider credential storage helpers with metadata-only
  responses.
- Route model allowlists, route spend caps, idempotency replay, rate limits,
  adapter retry/circuit breaker controls, and metadata-only observability.
- Strict key scan: `pnpm scan:keys`.
- GitHub Pages static project site.

## Verification

Latest local verification:

```txt
pnpm test       # 112 passed, 2 skipped
pnpm lint       # passed
pnpm format     # passed
pnpm typecheck  # passed
pnpm scan:keys  # passed, no findings
port scan       # no local service port settings outside 3300-3399
```

Docker Compose runtime smoke still needs to be run in a Docker-enabled
environment before tagging:

```bash
pnpm db:migrate
pnpm db:seed
GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_BASE_URL=http://localhost:3301 \
pnpm smoke:runtime
```

## Known Gaps

- Docker Compose runtime smoke could not be completed on the current local
  machine because Docker CLI is unavailable.
- Hosted managed-service production launch still requires provider terms
  review, privacy policy, terms of service, payment/tax review, settlement
  operations review, managed KMS/Vault backing, and production tenant/role
  controls.
