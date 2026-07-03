# FountLayer v0.5.0-beta.1 Release Notes

FountLayer `v0.5.0-beta.1` is the first self-hosted operator beta for the open
LLM last-mile distribution layer. It is intended for developers who want to run
their own Gateway, inspect usage, enforce faucet and wallet budgets, and keep
provider credentials out of SDKs and frontends.

This beta is not a hosted managed-service production launch.

## Included

- SDK -> Gateway -> attribution -> faucet or wallet payment check -> adapter ->
  one usage event -> balanced ledger entries -> Console readback.
- Memory Store for local demos and PostgreSQL Store for self-hosted runtime.
- Session auth with stored token hashes and attribution matching on
  authenticated `/v1` traffic.
- Authenticated Admin APIs for apps, channels, faucet grants, routes, pricing
  policies, credential metadata, usage events, ledger entries, privacy actions,
  and provider credential writes.
- Server-side credential encryption helpers and Gateway credential create,
  rotate, and delete flows.
- Route policy resolution with model allowlists and route spend caps.
- Wallet-funded billable calls when faucet grants cannot pay.
- Deterministic settlement reports and CSV export hashes.
- Worker in-memory `settlement.export` queue handler.
- Metadata-only telemetry events, spans, and metrics.
- Adapter retry and circuit breaker controls before usage or ledger writes.
- Dependency health checks that avoid returning thrown exception details.
- Privacy retention purge and app-owned end-user anonymization hooks.
- Static bilingual website with GitHub Pages workflow.
- Local service port policy constrained to `3300-3399`.
- Self-hosted beta runbook.

## Preserved Invariants

- No real provider API keys are included in SDK, frontend, mobile, desktop,
  logs, docs, or Git history.
- Every LLM request must include `app_id`, `channel_id`, `end_user_id`,
  `use_case`, and `mode`.
- Every successful billable call creates exactly one usage event.
- Every money movement creates balanced ledger entries.
- Faucet grants retain balance, model allowlist, use-case allowlist, daily cap,
  and expiration controls.
- Failed adapters, open circuits, rate limits, route policy denials,
  insufficient wallet balances, and privacy operations do not create duplicate
  usage or ledger records.

## Verification Before Tagging

Latest local baseline:

```txt
pnpm test       # passed, 108 passed and 2 skipped
pnpm lint       # passed
pnpm format     # passed
pnpm typecheck  # passed
port scan       # no local service port settings outside 3300-3399
```

Required before tagging `v0.5.0-beta.1`:

- Docker Compose runtime smoke in a Docker-enabled environment.
- Strict provider-key scan script.
- Beta threat model and security checklist.
- Admin API pagination and filters.
- Minimum Console operator setup workflows.

## Known Gaps

- Admin list endpoints still need beta-grade pagination and filters.
- Console setup workflows are still mostly read-oriented.
- Docker Compose runtime smoke must be repeated where Docker is available.
- Managed-service production launch still requires provider terms review,
  privacy policy, terms of service, payment/tax review, settlement operations
  review, managed KMS/Vault backing, and production tenant/role controls.
