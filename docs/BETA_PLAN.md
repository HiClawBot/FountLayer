# FountLayer Beta Plan

Target: `v0.5.0-beta.1`

FountLayer is ready to move into a self-hosted beta track. The beta should be
positioned as an operator build for developers who want to run their own
Gateway. It is not a hosted managed-service launch.

## Current Assessment

Implemented foundation:

- SDK -> Gateway -> attribution -> faucet or wallet funding -> adapter -> one
  usage event -> balanced ledger entries -> Console readback.
- PostgreSQL-backed Gateway Store with memory mode for local demos.
- Session token hashing and attribution matching on authenticated `/v1`
  traffic.
- Authenticated Admin API reads plus encrypted provider credential create,
  rotate, and delete flows.
- Live Console read pages for apps, channels, faucet grants, routes, pricing,
  credential metadata, usage, and ledger.
- Route policy resolution with model allowlists and route spend caps.
- Wallet-funded calls when faucet grants cannot pay.
- Settlement report and CSV export helpers, plus an in-memory Worker job queue.
- Metadata-only telemetry events, spans, and metrics.
- Adapter retry and circuit breaker controls before billing writes.
- Dependency health checks, privacy retention purge, and end-user
  anonymization hooks.
- Static bilingual project website and GitHub Pages workflow.
- Local port policy consolidated to the `3300-3399` range.

Verified locally:

- `pnpm test`
- `pnpm lint`
- `pnpm format`
- `pnpm typecheck`
- Static scan for old local service ports outside `3300-3399`

Current blockers before tagging beta:

- Docker Compose runtime validation is still not proven in a Docker-enabled
  environment.
- Admin list endpoints need beta-grade pagination and filters for operator use.
- Console is mostly read-oriented; beta needs minimum write workflows for
  operator setup.
- Release packaging, beta checklist, and contributor-facing docs need a beta
  pass.

## Beta Definition

`v0.5.0-beta.1` is done when a new developer can:

1. Clone the repository and install dependencies.
2. Start Postgres, Redis, LiteLLM, Gateway, Console, and the demo using only
   documented commands and ports inside `3300-3399`.
3. Configure a local/self-hosted admin token and credential encryption key.
4. Create or inspect an app, channel, route, faucet grant, pricing policy, and
   credential metadata through Admin APIs and Console.
5. Run one billable call that produces exactly one usage event and balanced
   ledger entries.
6. Verify that denied calls do not create usage or ledger records.
7. Export or queue a settlement report.
8. Confirm no real provider key appears in SDK, frontend, logs, docs, or Git
   history.

## Construction Sequence

### Phase 0: Seal Current Workspace

Goal: stabilize the current beta branch before continuing beta changes.

- [x] Commit the `3300-3399` port consolidation.
- [x] Commit the SAFE cleanup removal of the unused Console placeholder file.
- [x] Re-run `pnpm test`, `pnpm lint`, `pnpm format`, and `pnpm typecheck`.
- [x] Confirm no old local service port settings outside `3300-3399`.
- [ ] Add the strict key scan script in Phase 5.
- [x] Record this as the baseline for beta.

Exit gate:

- Clean working tree except intentionally ignored local artifacts.
- All local quality checks pass.

### Phase 1: Version and Documentation Alignment

Goal: make the repository read like a beta track.

- [x] Add `docs/RELEASE_NOTES_v0.5.0-beta.1.md`.
- [x] Update README, API spec, SECURITY, ROADMAP, and RELEASE_CHECKLIST wording
      where the current implementation is beta-scope.
- [x] Add a concise self-hosted beta quickstart.
- [x] Document the `3300-3399` port policy in one canonical place and link to it
      from README and website docs.
- [x] Add a beta known-limits section that clearly excludes hosted
      managed-service claims.
- [x] Add a self-hosted beta runbook.

Exit gate:

- A reader can tell what beta includes, what is experimental, and what is not
  production-hosted.

### Phase 2: Self-Hosted Runtime Proof

Goal: make self-hosting repeatable, not aspirational.

- [x] Add a Docker Compose beta runbook.
- Validate Postgres on `3332`, Redis on `3379`, LiteLLM on `3305`, Gateway on
  `3300`, Console on `3301`, and Demo on `3302`.
- Extend `pnpm smoke:runtime` or add a beta smoke script that checks health,
  dependency readiness, session creation, estimate, chat, Admin readback,
  usage events, ledger entries, and Console live data.
- Add a CI job or documented manual path for Docker runtime smoke when local
  Docker is unavailable.

Exit gate:

- The runtime smoke path is repeatable and documented.
- Failed adapter, rate-limited, route-denied, and insufficient-wallet calls are
  confirmed non-billable.

### Phase 3: Admin API Operator Readiness

Goal: make Admin APIs usable for real operator workflows.

- Add pagination and basic filters to Admin list endpoints:
  apps, channels, routes, faucet grants, pricing policies, credentials, usage
  events, and ledger entries.
- Add minimal create/update endpoints for apps, channels, routes, faucet
  grants, and pricing policies.
- Add revoke flows for sessions and admin tokens if they are present in the
  current data model.
- Preserve metadata-only credential responses.
- Add tests for all write paths and for secret non-disclosure.

Exit gate:

- An operator can set up a new app path without editing seed code.
- Admin list endpoints are bounded and test-covered.

### Phase 4: Console Beta Workflows

Goal: move Console from mostly read-only to minimally operational.

- Add create/edit screens or forms for apps, channels, routes, faucet grants,
  and pricing policies.
- Add credential metadata management actions that call existing encrypted
  Admin APIs.
- Add filters for usage and ledger by app, channel, end user hash, status, and
  date range.
- Keep all admin tokens server-side only.
- Preserve static fallback only for offline docs/demo rendering, not as a
  hidden runtime dependency.

Exit gate:

- A beta tester can complete the first operator setup through the Console.
- Console never exposes provider keys or admin tokens to client-side code.

### Phase 5: Security and Abuse Beta Gate

Goal: make beta safe enough for public self-hosted testers.

- Add `docs/THREAT_MODEL.md`.
- Add `docs/SECURITY_BETA_CHECKLIST.md`.
- Add a repository script for strict provider-key pattern scans.
- Add anonymous IP or unauthenticated boundary rate limiting if public demo
  exposure is supported.
- Document production key generation for
  `FOUNTLAYER_CREDENTIAL_MASTER_KEY`.
- Confirm telemetry, spans, metrics, and health checks never expose prompts,
  outputs, auth headers, provider keys, or connection-string errors.

Exit gate:

- Beta security checklist is complete.
- Strict key scan passes.
- Public-demo abuse controls are either implemented or explicitly out of beta
  scope.

### Phase 6: Beta Release Packaging

Goal: make the beta publishable.

- Update changelog for `v0.5.0-beta.1`.
- Update release checklist with beta-specific gates.
- Add GitHub release draft text.
- Confirm GitHub Pages site links to beta quickstart and docs.
- Tag `v0.5.0-beta.1` only after checks pass.

Exit gate:

- `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm typecheck`, strict key scan,
  site smoke, and runtime smoke are recorded.
- Release notes state exact known gaps.

## Non-Goals for Beta

- Do not build a generic chatbot.
- Do not launch a hosted managed service.
- Do not add real provider keys to SDK, frontend, mobile, desktop, logs, docs,
  or Git history.
- Do not implement payment/tax/invoice/payout operations as production
  obligations.
- Do not broaden provider support before credential safety, route policy, and
  budget controls stay intact.

## Suggested Branching

- Finish current cleanup on the previous baseline branch or a short-lived
  branch.
  Completed in baseline commit `2817e88`.
- Continue beta construction on `codex/v0.5.0-beta`.
- Tag the first beta as `v0.5.0-beta.1`.

## Verification Matrix

| Gate                       | Command or check                           | Required for beta |
| -------------------------- | ------------------------------------------ | ----------------- |
| Unit and integration tests | `pnpm test`                                | Yes               |
| Lint                       | `pnpm lint`                                | Yes               |
| Formatting                 | `pnpm format`                              | Yes               |
| Typecheck and builds       | `pnpm typecheck`                           | Yes               |
| Site static smoke          | `pnpm smoke:site`                          | Yes               |
| Runtime smoke              | `pnpm smoke:runtime` or beta equivalent    | Yes               |
| Strict key scan            | beta key-scan script                       | Yes               |
| Port policy scan           | no local service ports outside `3300-3399` | Yes               |
| Docker Compose validation  | Docker-enabled environment                 | Yes               |
