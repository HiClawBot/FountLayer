# FountLayer v0.5.0-beta.2 Release Notes

Status: release candidate. Do not tag or publish until every required gate in
[`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md) is green on the exact release commit.

FountLayer `v0.5.0-beta.2` is a self-hosted, single-operator beta for developers
evaluating an app-attributed, test-credit-funded managed LLM path. It is not a hosted
managed service or a commercial payments release.

## Supported Beta Path

The supported path is deliberately narrow:

1. A trusted application backend mints one short-lived, app-scoped session ticket.
2. The browser SDK redeems it once and receives a bounded session.
3. A non-streaming managed request runs through one operator-configured
   LiteLLM/OpenAI-compatible upstream.
4. Actual usage is attributed to app, channel, end user, and use case.
5. PostgreSQL records exactly one usage event plus balanced ledger entries.
6. An authenticated single-operator Console reads the resulting control-plane facts.

Developer Key, BYOK execution, Local/LAN execution, streaming, real payments, revenue
share, per-route stored-credential execution, fallback models, and credential budgets are
not supported beta capabilities.

## Changes Since beta.1

- Added SHA-256 operator-token verification, signed HttpOnly Console sessions, fail-closed
  route/action protection, and authenticated runtime smoke coverage.
- Replaced public app/channel session creation with short-lived, single-use,
  app-scoped tickets minted by a trusted backend.
- Added durable PostgreSQL ticket redemption, rate limits, checksum-journaled migrations,
  app ownership constraints, and restart-safe idempotency.
- Replaced floating-point billing with eight-decimal fixed-point money and atomic
  Store-backed usage/ledger settlement using validated adapter usage.
- Added browser-local bounded PDF extraction and a real document fixture; raw PDFs stay
  out of the Gateway path.
- Added production Compose/Docker targets, non-root images, read-only runtime controls,
  resource limits, SBOM/image-scan workflow gates, backup/restore drills, and graceful
  shutdown handling.
- Made the public beta contract managed-only and fail-closed for unsupported streaming,
  while preserving broader protocol foundations as explicitly experimental.
- Added a release-identity gate that keeps workspace package versions, OpenAPI, Docker,
  Compose, release notes, and public release links aligned.
- Added a secret-safe `beta:doctor` preflight for the production toolchain, private
  environment file, token relationships, independent security domains, HTTPS origins,
  exact release identity, and Compose expansion.
- Replaced repeated related-record ID entry in Console Setup with labeled App, Channel,
  Route, and Pricing Policy choices while retaining an empty/unavailable manual fallback.
- Added a strict `smoke:golden` TLS-staging profile that performs one seeded Managed call
  and reconciles provider-supplied usage to its exact balanced ledger entry set.
- Updated the pinned checkout, setup-node, general/Pages artifact upload, and Pages deploy
  Actions to their smallest verified Node 24 runtime lines without changing workflow
  permissions or intended job behavior.
- Patched the production dependency graph to `fast-uri 3.1.4` and `sharp 0.35.3`; the
  production audit reports no known vulnerabilities at candidate preparation time.

## Local Candidate Evidence

Candidate-preparation evidence recorded on 2026-07-22:

```text
pnpm release:verify                  # passed; 11 required markers, 3 stale claims absent
pnpm audit:prod                      # passed; no known vulnerabilities
pnpm test                            # passed; 182 tests, 8 PostgreSQL tests skipped
FOUNTLAYER_RUN_DB_TESTS=1 pnpm test # passed; 190 tests including all 8 PostgreSQL cases
pnpm lint                            # passed
pnpm format                          # passed
pnpm typecheck                       # passed; all workspace production builds included
pnpm scan:keys                       # passed; no findings
pnpm smoke:site                      # passed; 14 built-artifact assertions
pnpm smoke:sdk-package               # passed; protocol/ticket/SDK beta.2 tarballs imported
pnpm db:backup + db:restore:verify   # passed; 3 migration records restored in isolation
```

The bilingual site was also checked in a real browser at 390x844 with zero console
messages or horizontal overflow. Local results remain preparation evidence only; they do
not replace exact-commit GitHub Actions, Docker image, real-provider, or staging evidence.

## Required Evidence Before Tagging

- CI, Runtime Smoke, Pages, and Container Gates pass on the exact release commit.
- Gateway, Console, and Demo images build as non-root and their fixable high/critical
  scans are clean; SPDX SBOMs are retained with the candidate.
- One credentialed, non-streaming request through the configured LiteLLM route returns
  actual upstream usage and reconciles with one usage event and balanced ledger entries.
- A staging soak covers SIGTERM drain, provider timeout, database restart, failed
  provider-cost persistence, backup restore, and restore failure handling.
- A fresh developer completes the documented self-hosted path and records time to first
  attributed value without maintainer intervention.

## Known Boundaries

- All workspace packages and applications remain private; there is no npm or container
  registry publication workflow yet. The candidate is consumed by cloning and
  self-hosting the repository.
- Provider selection remains process-wide for the supported path rather than a complete
  per-route multi-adapter runtime.
- Full response bodies are not persisted for cross-restart idempotent replay; a completed
  duplicate returns the original usage-event reference without rebilling.
- Hosted-service legal, privacy, terms, provider-contract, payment, tax, settlement,
  tenant/role, and managed-secret obligations are outside this self-hosted beta.
