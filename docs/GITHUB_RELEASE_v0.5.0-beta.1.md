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
  channels, routes, faucet grants, pricing policies, credential metadata, and
  session revoke.
- Console `/setup` workflow and Usage & Ledger filters.
- Server-side encrypted provider credential storage helpers with metadata-only
  responses.
- Route model allowlists, route spend caps, durable PostgreSQL idempotency,
  rate limits, adapter retry/circuit breaker controls, and metadata-only
  observability.
- Stock demo, LiteLLM, and private/local OpenAI-compatible runtime adapter
  selection plus real Store-backed wallet balance reads.
- Strict key scan: `pnpm scan:keys`.
- GitHub Pages static project site.

## Verification

Latest local verification:

```txt
pnpm test       # 132 passed, 3 skipped
pnpm lint       # passed
pnpm format     # passed
pnpm typecheck  # passed
pnpm smoke:site # passed
pnpm scan:keys  # passed, no findings
port scan       # no local service port settings outside 3300-3399
```

GitHub Actions verification on the beta branch:

- CI passed:
  <https://github.com/HiClawBot/FountLayer/actions/workflows/ci.yml?query=branch%3Acodex%2Fv0.5.0-beta>
- Runtime Smoke passed in a Docker-enabled runner:
  <https://github.com/HiClawBot/FountLayer/actions/workflows/runtime-smoke.yml?query=branch%3Acodex%2Fv0.5.0-beta>
- Pages deploy passed:
  <https://github.com/HiClawBot/FountLayer/actions/workflows/pages.yml?query=branch%3Acodex%2Fv0.5.0-beta>
- Public site returned HTTP 200: <https://hiclawbot.github.io/FountLayer/>

Maintainers can repeat the runtime smoke locally with Docker:

```bash
pnpm db:migrate
pnpm db:seed
GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_BASE_URL=http://localhost:3301 \
pnpm smoke:runtime
```

## Known Gaps

- Full completion bodies are cached only in the active Gateway process. A
  completed retry after restart returns the original usage-event reference in
  a deterministic `409` response instead of replaying or rebilling it.
- Hosted managed-service production launch still requires provider terms
  review, privacy policy, terms of service, payment/tax review, settlement
  operations review, managed KMS/Vault backing, and production tenant/role
  controls.
