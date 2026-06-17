# v0.2.0-alpha Iteration Plan

Goal: upgrade the `v0.1.0` in-memory MVP into a self-hostable alpha with
PostgreSQL-backed attribution, faucet, usage, and ledger state.

## Scope

- Gateway Store abstraction with memory and PostgreSQL implementations.
- PostgreSQL-backed app/channel validation.
- PostgreSQL-backed faucet grant lookup, daily cap accounting, row locking, and
  atomic deduction.
- PostgreSQL-backed `usage_events` and `ledger_entries` inserts for every
  successful billable call.
- Session auth persistence with stored token hashes only.
- Session attribution matching for authenticated `/v1` requests.
- Optional Postgres integration test gated by `FOUNTLAYER_RUN_DB_TESTS=1`.
- Documentation for enabling `FOUNTLAYER_GATEWAY_STORE=postgres`.

## Non-Goals

- Generic chatbot UI.
- Provider expansion beyond the existing demo/local/LiteLLM-compatible adapter
  foundation.
- Hosted BYOK.
- Payment, tax, invoice, or settlement automation.
- Production authentication and rate limiting.

## Current Status

- [x] Created `v0.2.0-alpha` branch.
- [x] Added Gateway Store abstraction.
- [x] Preserved memory Store for zero-dependency local demo and unit tests.
- [x] Added PostgreSQL Store with transactional faucet deduction plus
      usage/ledger writes.
- [x] Added `sessions` table, hashed session persistence, and session
      attribution checks.
- [x] Added optional Postgres integration test.
- [x] Added root DB scripts and README instructions.
- [ ] Docker Compose runtime validation is still blocked on machines without
      Docker CLI.
- [ ] CI Postgres service is not yet enabled.
- [ ] Console still reads static data rather than live Admin APIs.
- [ ] App tokens and production tenant auth are not yet implemented.

## Next Checks

1. Run local unit checks: `pnpm test`, `pnpm lint`, `pnpm typecheck`.
2. On a Docker-enabled machine, run:

   ```bash
   docker compose up -d postgres redis
   pnpm db:migrate
   pnpm db:seed
   FOUNTLAYER_GATEWAY_STORE=postgres pnpm --filter @fountlayer/gateway dev
   FOUNTLAYER_RUN_DB_TESTS=1 pnpm test
   ```

3. Add GitHub Actions Postgres service once Docker-backed tests are verified.
