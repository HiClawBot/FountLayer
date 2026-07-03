# Release Checklist

## Repository

- [x] Project name: FountLayer.
- [x] README complete for the current beta foundation.
- [x] WHITEPAPER.md included.
- [x] CONSTRUCTION.md included.
- [x] docs complete for the MVP scope.
- [x] LICENSE selected: Apache-2.0.
- [x] .env.example uses placeholders only.
- [x] .gitignore excludes `.env`, logs, local DB files, secrets, local planning logs, and the handoff ZIP.
- [x] Issue templates added.
- [x] GitHub Actions CI added.
- [x] CHANGELOG.md and release notes added.

## Security

- [x] No real provider keys found in local placeholder-only scans.
- [x] Logs redact common credential headers when Gateway logging is enabled.
- [x] Session tokens are stored as hashes only in the Gateway path.
- [x] Managed mode uses server-side placeholders only in this release.
- [x] BYOK local mode does not upload keys.
- [x] Hosted BYOK is not implemented; docs require explicit opt-in before adding it.
- [x] Per-app/per-user faucet budget checks exist for the MVP grant-funded path.
- [x] Free faucet grants have balance, model allowlist, use-case allowlist, daily cap, and expiration.

## Product

- [x] SDK can call Gateway.
- [x] Gateway records app/channel/end-user/use-case/mode.
- [x] Faucet grant works.
- [x] Usage event is created for each successful billable call.
- [x] Ledger entries balance.
- [x] Developer console shows usage and ledger.
- [x] Demo app works in browser smoke checks.
- [x] Beta branch includes optional PostgreSQL-backed Gateway store.

## Documentation

- [x] Node/pnpm quickstart commands tested locally.
- [ ] Docker Compose self-hosting runtime test is scripted with
      `pnpm smoke:runtime`, but remains blocked locally because Docker CLI is
      unavailable.
- [x] Optional Postgres integration test runs in CI with
      `FOUNTLAYER_RUN_DB_TESTS=1`.
- [x] Security warning visible.
- [x] Pricing formula documented.
- [x] API spec documented.
- [x] Data model documented.

## Legal/Operations

- [ ] Trademark search is not complete; conduct formal clearance before commercial launch.
- [ ] Review provider terms before managed service launch.
- [ ] Review payment, tax, invoice, and settlement rules before revenue sharing.
- [ ] Prepare privacy policy and terms for hosted service.

## v0.5.0-beta.1 Gates

- [ ] `docs/RELEASE_NOTES_v0.5.0-beta.1.md` is complete.
- [ ] Docker Compose runtime smoke passes in a Docker-enabled environment.
- [x] Self-hosted beta runbook is present.
- [x] Admin list endpoints have beta-grade pagination and filters.
- [ ] Console has minimum operator setup workflows for apps, channels, routes,
      faucet grants, pricing policies, and credential metadata.
- [ ] Threat model and beta security checklist are present.
- [x] Strict key scan script exists.
- [x] `pnpm scan:keys` passes.
- [x] No local service port settings outside `3300-3399`.
