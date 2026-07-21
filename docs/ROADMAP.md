# FountLayer Roadmap

This roadmap tracks the path from the beta construction branch to
`v0.5.0-beta.2`. The direct execution checklist is in [Beta Plan](./BETA_PLAN.md),
and the current support contract is in
[External Beta Capabilities](./BETA_CAPABILITIES.md).

- PostgreSQL-backed Gateway Store exists.
- Gateway sessions are persisted as token hashes.
- Authenticated `/v1` requests enforce session attribution matching.
- Console can read Gateway Admin API data; static fallback must become an explicit
  non-authoritative sample/degraded state before release.
- Admin auth, credential encryption, route policies, wallet-funded calls,
  settlement exports, metadata-only observability, reliability controls,
  privacy retention, and dependency health checks exist as beta foundations.
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

## `v0.5.0-beta.1`: Self-Hosted Operator Build

Goal: make FountLayer practical for a developer to run as their own Gateway.

1. Align version, docs, and release packaging.
   - Add beta release notes and a self-hosted beta quickstart.
   - Keep the hosted managed-service boundary explicit.
   - Publish a beta-specific release checklist.

2. Prove self-hosted runtime.
   - Validate Docker Compose with Postgres, Redis, LiteLLM, Gateway, Console,
     and the demo app.
   - Record `pnpm smoke:runtime` output in release notes.

3. Improve Gateway API operator behavior.
   - Add pagination for Admin list endpoints.
   - Add basic filters for usage, ledger, app, channel, end-user hash, status,
     and date range.
   - Add minimum create/update endpoints for apps, channels, routes, faucet
     grants, and pricing policies.

4. Expand Console operator workflows.
   - Create and update apps, channels, routes, faucet grants, and pricing
     policies.
   - Inspect usage and ledger by app, channel, user hash, and date range.
   - Keep credentials and admin tokens server-side only.

Done when:

- A new self-hosting user can run the Gateway from README without editing code.
- Abuse controls exist before any managed provider key can be used.
- Admin APIs and Console flows are covered by tests.
- Runtime smoke is repeatable in a Docker-enabled environment.

## Historical Foundation Milestones

The `v0.3.0` through `v0.5.0` sections below describe foundations that have
already been incorporated into `v0.5.0-beta.1`. They remain useful as design
history. Their unfinished work is productionization: per-route multi-adapter
routing, durable async queues, full cross-instance response replay, fixed-point
accounting hardening, managed KMS/Vault integration, and complete operator
workflows.

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
