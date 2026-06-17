# Changelog

## Unreleased

### Added

- Gateway Store abstraction with in-memory and PostgreSQL implementations.
- PostgreSQL-backed Gateway mode via `FOUNTLAYER_GATEWAY_STORE=postgres`.
- Transactional faucet deduction with usage event and ledger entry persistence.
- `sessions` table and Gateway session validation with persisted token hashes.
- Session attribution checks for authenticated Gateway requests.
- Optional Postgres integration test gated by `FOUNTLAYER_RUN_DB_TESTS=1`.
- Root database scripts: `pnpm db:migrate`, `pnpm db:seed`, and `pnpm db:test:setup`.

## 0.1.0 - 2026-06-17

Initial public MVP for FountLayer, the open-source LLM last-mile distribution
layer for apps.

### Added

- TypeScript pnpm monorepo with Gateway, Console, Demo PDF Reader, SDK, protocol, pricing, faucet, adapter, ledger, and database packages.
- Shared protocol validators requiring `appId`, `channelId`, `endUserId`, `useCase`, and `mode` attribution for LLM requests.
- Fastify Gateway with sessions, balance, faucet grants, estimates, chat completions, and admin usage/ledger views.
- Smallest complete billable loop: SDK -> Gateway -> attribution -> faucet check -> local adapter -> usage event -> ledger entries -> console view.
- Faucet engine with remaining balance, model allowlist, use-case allowlist, daily cap, expiration, and atomic deduction SQL.
- Double-entry ledger helpers that create one usage event and balanced money movements for successful billable calls.
- LiteLLM/OpenAI-compatible adapter package, local/BYOK adapter package, and streaming parser tests.
- Browser/Node SDK with sessions, chat, streaming, balance, estimates, faucet grants, local endpoint helpers, and local-only BYOK storage helpers.
- Next.js developer console showing apps, channels, routes, credentials, faucet, pricing, usage, and ledger data.
- Next.js Demo PDF Reader app using the SDK against the Gateway.
- PostgreSQL schema, migration, and seed data for the MVP entities.
- GitHub Actions CI for install, tests, lint, format, and typecheck/build.

### Security

- No real provider API keys are included.
- Managed provider credentials are represented only as server-side placeholders.
- Gateway logger redacts authorization, cookie, proxy authorization, and common API-key headers when logging is enabled.
- Prompt/output logging is not enabled by default.
- Hosted BYOK is not implemented in this release; BYOK helpers store keys locally only.

### Known Limitations

- Gateway persistence is in-memory in `v0.1.0`; the PostgreSQL schema and seed package are present but not yet wired into Gateway runtime storage.
- Wallet-funded calls, hosted BYOK, settlement jobs, OpenMeter, and Lago adapters are planned after the faucet-funded loop.
- Docker Compose could not be runtime-validated in the local build environment because Docker CLI was unavailable.
- This is not production-ready for a hosted managed service until authentication, rate limits, persistent budget checks, provider terms review, privacy policy, terms of service, payments, tax, and settlement controls are completed.
