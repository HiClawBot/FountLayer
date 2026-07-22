# GitHub Release Draft: v0.5.0-beta.2

Tag: `v0.5.0-beta.2`
Target branch: `codex/v0.5.0-beta`
Title: `FountLayer v0.5.0-beta.2`
Status: draft; exact release commit pending

## Summary

FountLayer `v0.5.0-beta.2` is a self-hosted, single-operator release candidate for
testing one managed, non-streaming, app-attributed LLM path with test credits. It proves
the transaction kernel—ticket bootstrap, policy, actual usage, metering, balanced
ledger, and authenticated Console readback—without claiming a hosted service, real
payments, or multi-mode execution.

## Highlights

- Trusted-backend, short-lived, single-use app session tickets.
- Authenticated single-operator Console with server-side Gateway administration.
- PostgreSQL ownership constraints, migration journal, durable idempotency/rate limits,
  exact fixed-point money, and atomic usage/ledger settlement.
- Browser-local bounded PDF extraction with no raw document upload to the Gateway.
- Production-shaped Docker/Compose profile, backup/restore drill, graceful shutdown,
  SBOM generation, and image vulnerability gates.
- Secret-safe production configuration doctor plus labeled existing-record choices in
  Console Setup to reduce first-run failures and ID transcription.
- Strict credentialed TLS-staging golden smoke with exact usage-event and balanced-ledger
  reconciliation.
- Managed-only public beta contract with Developer Key, BYOK, Local/LAN, streaming,
  payments, and revenue share explicitly unavailable.
- Production dependency graph patched for the July 2026 `fast-uri` and `sharp`
  advisories.

## Verification

Attach exact-commit links and evidence before converting this draft into a release:

- CI: <https://github.com/HiClawBot/FountLayer/actions/workflows/ci.yml?query=branch%3Acodex%2Fv0.5.0-beta>
- Runtime Smoke: <https://github.com/HiClawBot/FountLayer/actions/workflows/runtime-smoke.yml?query=branch%3Acodex%2Fv0.5.0-beta>
- Container Gates: <https://github.com/HiClawBot/FountLayer/actions/workflows/container-gates.yml?query=branch%3Acodex%2Fv0.5.0-beta>
- Pages: <https://github.com/HiClawBot/FountLayer/actions/workflows/pages.yml?query=branch%3Acodex%2Fv0.5.0-beta>
- Credentialed real-provider golden-smoke record.
- Staging soak and failure-injection record.
- Design-partner onboarding record with time to first attributed value.

## Install Boundary

This candidate is cloned and self-hosted from source. It does not publish npm packages
or container images and is not a hosted FountLayer service.

See the complete [beta.2 release notes](./RELEASE_NOTES_v0.5.0-beta.2.md),
[capability matrix](./BETA_CAPABILITIES.md), and
[self-hosting runbook](./SELF_HOSTING_BETA.md) before testing.
