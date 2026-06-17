# Security Policy

## Rule Zero

Never put real provider API keys in SDK code, frontend bundles, mobile apps,
desktop packages, logs, screenshots, or Git history.

## Supported Versions

| Version | Status                                     |
| ------- | ------------------------------------------ |
| 0.1.x   | Public MVP, security fixes accepted        |
| < 0.1   | Specification drafts, not actively patched |

## Reporting

For now, open a private security advisory after the GitHub repository is
created, or contact the maintainer through the repository owner profile. Do not
open a public issue with provider credentials, access tokens, or exploit
details.

## Current MVP Boundary

FountLayer `0.1.0` is an open-source foundation release. It includes local
development placeholders only and does not include real managed provider keys.
Hosted BYOK is not implemented; SDK BYOK helpers store user keys locally.

See [docs/SECURITY.md](./docs/SECURITY.md) for the detailed security model and
required controls before operating a hosted service.
