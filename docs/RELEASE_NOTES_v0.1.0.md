# FountLayer v0.1.0 Release Notes

Release date: 2026-06-17

FountLayer `v0.1.0` is the first public MVP of the open-source LLM last-mile
distribution layer for apps.

## What Works

- SDK session creation and Gateway calls with required app, channel, end-user,
  use-case, and mode attribution.
- Faucet-funded managed request path with grant matching, balance deduction,
  model allowlist, use-case allowlist, daily cap, and expiration.
- Local demo adapter that simulates an OpenAI-compatible billable response
  without any provider API key.
- One `usage_event` for each successful billable call.
- Balanced `ledger_entries` for each successful money movement.
- Developer console pages for usage, ledger, faucet, apps, channels, routes,
  credentials, and pricing.
- Demo PDF Reader app that estimates cost, checks faucet balance, and runs the
  smallest complete loop through the SDK and Gateway.

## Verification

- `pnpm test`
- `pnpm lint`
- `pnpm format`
- `pnpm typecheck`
- Browser smoke checks for Console desktop/mobile views.
- Browser smoke checks for Demo PDF Reader estimate and summarize flow against
  the Gateway.
- Local placeholder-only secret scans.

Docker Compose runtime validation was not run in this environment because the
Docker CLI was unavailable.

## Security Notes

- No real provider API keys are present in the repository.
- `.env.example` contains placeholders only.
- Gateway logging redacts common credential headers when logging is enabled.
- BYOK helper methods are local-only in this release.
- Hosted BYOK, managed provider key storage, and production authentication are
  not enabled in this release.

## Not Production Ready

Do not run `v0.1.0` as a public hosted managed service without adding
persistent authentication, rate limits, database-backed Gateway state, provider
credential encryption, abuse controls, hosted-service privacy/terms documents,
payment/tax review, and provider terms review.
