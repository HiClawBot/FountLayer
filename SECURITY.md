# Security Policy

## Rule Zero

Never put real provider API keys in SDK code, frontend bundles, mobile apps,
desktop packages, logs, screenshots, or Git history.

## Supported Versions

| Version      | Status                                     |
| ------------ | ------------------------------------------ |
| 0.5.0-beta.x | Self-hosted beta, security fixes accepted  |
| 0.1.x        | Public MVP, security fixes accepted        |
| < 0.1        | Specification drafts, not actively patched |

## Reporting

For now, open a private security advisory after the GitHub repository is
created, or contact the maintainer through the repository owner profile. Do not
open a public issue with provider credentials, access tokens, or exploit
details.

## Current Beta Boundary

FountLayer `v0.5.0-beta.2` is a self-hosted, single-operator beta. The only
supported external-beta execution path is managed mode through an
operator-configured LiteLLM/OpenAI-compatible upstream. Console access requires
an independent operator token exchanged for a signed HttpOnly session; the
Gateway admin token remains server-side. BYOK and local routing are not supported
external-beta execution modes. Public session creation requires a five-minute,
single-use ticket signed by a trusted backend; PostgreSQL persists ticket
redemptions and abuse counters across Gateway restarts. Checksum-journaled
migrations enforce app-scoped relationships, and billable amounts are settled from
validated actual adapter usage with fixed-point arithmetic.

See [docs/SECURITY.md](./docs/SECURITY.md) for the detailed security model and
required controls before operating a hosted service.
