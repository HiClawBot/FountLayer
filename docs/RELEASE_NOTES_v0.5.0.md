# FountLayer v0.5.0 Foundation Notes

FountLayer v0.5.0 is a foundation milestone for the open LLM last-mile
distribution layer. It keeps the original product shape: SDK -> Gateway ->
attribution -> faucet or wallet payment check -> adapter -> one usage event ->
balanced ledger entries -> Console and export views.

This is not a hosted managed-service production release. It is a self-hostable
foundation for public testers and contributors.

## Added Since v0.1.0

- PostgreSQL-backed Gateway Store with atomic faucet, wallet, usage event, and
  ledger writes.
- Session auth with stored token hashes and attribution matching on every
  authenticated `/v1` request.
- Authenticated Admin API reads and writes, including encrypted provider
  credential create, rotate, and delete flows.
- Live Console reads for apps, channels, faucet grants, routes, pricing,
  credentials metadata, usage events, and ledger entries.
- Runtime config validation, request IDs, billable request rate limits, and
  idempotency-key replay for successful chat responses.
- Store-backed route policies with model allowlists and route spend caps.
- Wallet-funded billable calls when faucet grants cannot pay.
- Deterministic settlement reconciliation reports and CSV export hashes.
- Worker in-memory queue with `settlement.export` job handler.
- Metadata-only telemetry events, spans, and metrics for session, estimate,
  adapter, billing write, and chat paths.
- Adapter retry and circuit breaker controls before usage or ledger writes.
- Dependency health checks for Store plus injected adapter/Redis probes.
- Privacy retention purge for ledger request metadata and app-owned end-user
  identifier anonymization with tombstone IDs.

## Preserved Invariants

- No real provider API keys are included in SDK, frontend, mobile, desktop,
  logs, or Git history.
- Every LLM request must include `app_id`, `channel_id`, `end_user_id`,
  `use_case`, and `mode`.
- Every successful billable call creates exactly one usage event.
- Every money movement creates balanced ledger entries.
- Faucet grants retain balance, model allowlist, use-case allowlist, daily cap,
  and expiration controls.
- Failed adapter retries, open circuits, rate limits, route policy denials,
  insufficient wallet balance, and privacy operations do not create duplicate
  usage or ledger records.

## Verification

Latest local verification for this milestone:

```txt
pnpm test       # 108 passed, 2 skipped
pnpm lint       # passed
pnpm format     # passed
pnpm typecheck  # passed
strict key scan # no matches
```

Docker Compose runtime validation still requires a Docker-enabled environment.
The scripted runtime smoke path remains `pnpm smoke:runtime`.

## Known Gaps Before a Hosted Managed Service

- Formal trademark and domain clearance.
- Provider terms review.
- Privacy policy, terms of service, payments, tax, invoice, and settlement
  operations review.
- Production-grade tenant and role model.
- Persistent queue backend for Worker jobs.
- External observability exporter wiring for a chosen OpenTelemetry collector.
