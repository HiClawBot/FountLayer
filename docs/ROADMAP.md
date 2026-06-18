# FountLayer Roadmap

This roadmap starts from the current `v0.2.0-alpha` branch:

- PostgreSQL-backed Gateway Store exists.
- Gateway sessions are persisted as token hashes.
- Authenticated `/v1` requests enforce session attribution matching.
- Console Overview and Usage/Ledger can read live Gateway Admin API data with
  static fallback.
- The public MVP loop remains: SDK -> Gateway -> attribution -> faucet check ->
  adapter -> usage event -> ledger entries -> console view.

## Product Guardrails

- Do not build a generic chatbot before distribution, metering, faucet, and
  ledger foundations are production-shaped.
- Never put real provider API keys in SDK, frontend, mobile, desktop, logs, or
  Git history.
- Every LLM request must carry `app_id`, `channel_id`, `end_user_id`,
  `use_case`, and `mode`.
- Every successful billable call must create exactly one usage event.
- Every money movement must create balanced ledger entries.
- Faucet grants must keep balance, model allowlist, use-case allowlist, daily
  cap, and expiration controls.

## Next Sprint: Finish `v0.2.0-alpha`

Goal: make the current alpha self-hostable and safe enough for public testers.

1. Add Admin API authentication.
   - Add app or admin tokens with stored hashes.
   - Require admin auth on `/admin/*`.
   - Keep session bearer tokens scoped to `/v1` app traffic.
   - Add tests for missing, invalid, expired, and revoked admin tokens.

2. Enable PostgreSQL CI coverage.
   - Add a GitHub Actions Postgres service.
   - Run migrations and seed data in CI.
   - Run `FOUNTLAYER_RUN_DB_TESTS=1 pnpm test` in CI.
   - Keep memory-store tests as the fast default path.

3. Complete live Console read views.
   - Add Admin API read endpoints for apps, channels, faucet grants, routes,
     pricing policies, and provider credentials metadata.
   - Wire Console pages to those endpoints with static fallback.
   - Show credential metadata only, never secret values.

4. Validate Docker Compose runtime.
   - Verify Postgres, Redis, Gateway, Console, and LiteLLM sidecar startup.
   - Add a smoke-test script for health, session creation, estimate, chat,
     usage event, ledger entries, and Console readback.
   - Document ports and required environment variables.

Done when:

- `pnpm test`, `pnpm lint`, `pnpm format`, and `pnpm typecheck` pass.
- CI runs Postgres-backed tests.
- `/admin/*` is authenticated.
- Console no longer depends on static data for core read pages when Gateway is
  available.
- Docker Compose smoke testing is documented and repeatable.

## `v0.2.0-beta`: Self-Hosted Operator Build

Goal: make FountLayer practical for a developer to run as their own Gateway.

1. Harden runtime configuration.
   - Add environment validation at Gateway startup.
   - Fail fast on unsafe production settings.
   - Split local demo, self-hosted, and managed-service env examples.

2. Add rate and budget controls.
   - Per-app, per-channel, per-end-user, and anonymous IP limits.
   - Per-session request caps.
   - High-price model allowlist checks.
   - Streaming budget interruption for long-running responses.

3. Improve Gateway API behavior.
   - Add idempotency keys for billable requests.
   - Standardize error codes and response shapes.
   - Add request IDs to all public responses.
   - Add pagination for Admin list endpoints.

4. Expand Console operator workflows.
   - Create and update apps, channels, routes, faucet grants, and pricing
     policies.
   - Revoke sessions and admin tokens.
   - Inspect usage and ledger by app, channel, user hash, and date range.

Done when:

- A new self-hosting user can run the Gateway from README without editing code.
- Abuse controls exist before any managed provider key can be used.
- Admin APIs and Console flows are covered by tests.

## `v0.3.0`: Credentials, Routing, and Provider Expansion

Goal: support real provider routing without weakening key safety.

1. Add encrypted credential storage.
   - Introduce a KMS/Vault-style encryption interface.
   - Store encrypted provider and developer credentials server-side only.
   - Add key rotation and delete flows.
   - Ensure logs and Admin APIs never return plaintext secrets.

2. Promote route policies.
   - Support route aliases such as `cheap/fast`, `smart/default`, and
     `vertical/paper-summary`.
   - Map routes to model allowlists, fallback models, spend caps, and latency
     preferences.
   - Add LiteLLM routing tests with injected fetch and no real keys.

3. Clarify BYOK and local modes.
   - Keep default BYOK local-only.
   - Add explicit hosted BYOK opt-in only after encrypted storage exists.
   - Add local endpoint validation and user-visible delete/rotate controls.

Done when:

- Real provider credentials can be used only through server-side encrypted
  storage or local-only BYOK.
- Routes are policy objects, not hard-coded model strings.
- Provider expansion does not require SDK or frontend secret exposure.

## `v0.4.0`: Wallets, Billing, and Settlement

Goal: move beyond faucet-only usage while preserving double-entry accounting.

1. Add wallet-funded calls.
   - Support wallet balance payment source in addition to faucet grants.
   - Prevent negative balances.
   - Preserve one usage event per successful billable call.

2. Add billing integrations as optional adapters.
   - OpenMeter adapter for usage metering, limits, and entitlements.
   - Lago adapter for usage-based billing and hybrid pricing.
   - Keep FountLayer's internal ledger as the source of accounting truth.

3. Add settlement jobs.
   - Worker jobs for developer revenue, channel commissions, refunds, and
     reconciliation exports.
   - Immutable ledger export by period.
   - Admin review states before payout.

Done when:

- Faucet-funded and wallet-funded calls share one ledger model.
- Optional billing adapters can be disabled without breaking core metering.
- Settlement reports reconcile to ledger totals.

## `v0.5.0`: Observability and Reliability

Goal: make operations debuggable without exposing sensitive content.

1. Add OpenTelemetry.
   - Traces for session, estimate, chat, adapter, usage write, and ledger write.
   - Metrics for token counts, cost, latency, errors, denied requests, and
     faucet depletion.
   - No raw prompts, raw outputs, provider keys, or session tokens in telemetry.

2. Add reliability controls.
   - Adapter retries with bounded retry budgets.
   - Circuit breakers for provider failures.
   - Queue-backed async jobs for settlement and exports.
   - Health checks for database, Redis, and adapter dependencies.

3. Add privacy and retention controls.
   - Configurable retention for request metadata.
   - Prompt/output logging disabled by default.
   - User deletion hooks for app-owned identifiers.

Done when:

- Operators can debug cost and routing issues from metadata only.
- Provider failures do not corrupt usage or ledger invariants.
- Retention behavior is explicit and documented.

## `v1.0.0-rc`: Public Production Candidate

Goal: freeze the core contracts and prepare for broad external contribution.

1. Freeze public API and SDK contracts.
   - Version Gateway API responses.
   - Define migration policy.
   - Publish SDK compatibility matrix.

2. Complete security readiness.
   - Threat model document.
   - Secret-scanning guidance.
   - Abuse-control checklist.
   - External security review or documented internal review.

3. Improve contributor readiness.
   - Issue labels and starter tasks.
   - Architecture decision records.
   - Example self-host deployments.
   - Release automation for packages and Docker images.

Done when:

- The core distribution, metering, faucet, ledger, and auth contracts are stable.
- A third-party developer can self-host, integrate the SDK, and inspect usage
  without private guidance.
- Security boundaries are documented and tested.

## Backlog

- Python SDK after the TypeScript SDK contract stabilizes.
- Mobile SDK wrappers after session and BYOK UX are stable.
- Admin audit log UI.
- Multi-tenant organization and role model.
- Provider-specific cost reconciliation importers.
- Public demo deployment with CAPTCHA and strict spend caps.
