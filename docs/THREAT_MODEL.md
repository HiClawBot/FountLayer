# FountLayer Beta Threat Model

Scope: `v0.5.0-beta.1` self-hosted operator beta.

This document covers the open-source self-hosted Gateway, Console, SDK, Worker,
database schema, and local demos. It does not certify a hosted managed-service
deployment.

## Protected Assets

- Provider API keys and encrypted provider credential ciphertext.
- Admin bearer tokens and session tokens.
- End-user identifiers owned by apps.
- Usage events and ledger entries.
- Faucet grant balances, allowlists, daily caps, and expiration controls.
- Database connection strings, credential master keys, and runtime secrets.
- Prompt and assistant output content, which is intentionally not logged by
  default.

## Trust Boundaries

| Boundary                    | Trusted Side               | Untrusted Side         | Required Control                              |
| --------------------------- | -------------------------- | ---------------------- | --------------------------------------------- |
| SDK to Gateway              | Gateway                    | App client and network | Session token plus attribution headers.       |
| Console to Gateway          | Console server and Gateway | Browser client         | Admin token stays server-side only.           |
| Gateway to provider adapter | Gateway                    | Provider network/API   | Provider keys stay server-side or local-only. |
| Gateway to database         | Gateway and database       | Public network         | Use Postgres credentials only in server env.  |
| Public docs/site            | Static content             | Public internet        | No secrets, admin tokens, or provider keys.   |

## Primary Threats And Mitigations

| Threat                                              | Impact                               | Current Mitigation                                                                                                 |
| --------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Provider key appears in SDK, frontend, logs, or Git | Upstream account compromise          | Strict placeholder policy, `pnpm scan:keys`, metadata-only credential responses.                                   |
| Admin token exposed to browser                      | Full operator control                | Console uses server actions and server env only; never use `NEXT_PUBLIC_*` for admin tokens.                       |
| Session token replay across attribution             | Unauthorized metered calls           | Session token hashes are stored server-side; authenticated `/v1` requests must match captured attribution.         |
| Duplicate billing on client retry                   | Duplicate usage/ledger records       | `idempotency-key` uses a session-scoped request hash and PostgreSQL reservation completed atomically with billing. |
| Adapter failure after payment precheck              | User charged without provider result | Usage events and ledger entries are written only after successful adapter response.                                |
| Route to unapproved/high-cost model                 | Unexpected spend                     | Route model allowlists and max retail caps run before adapter execution.                                           |
| Faucet abuse                                        | Free-credit drain                    | Faucet grants require balance, model allowlist, use-case allowlist, daily cap, expiration, and status.             |
| Wallet overspend                                    | Negative balances                    | Wallet-funded writes atomically prevent negative balances.                                                         |
| Health or telemetry leaks secrets                   | Credential or prompt exposure        | Health checks return component status only; telemetry/spans/metrics are metadata-only.                             |
| Telemetry backend fails after billing               | Charged call appears failed          | Telemetry writes are best-effort and cannot alter the committed request outcome.                                   |
| End-user deletion breaks accounting                 | Ledger integrity loss                | Privacy purge anonymizes identifiers and metadata without deleting usage or ledger facts.                          |

## Explicit Non-Goals For This Beta

- Hosted managed-service production authentication and tenant RBAC.
- Payment processing, tax, invoice, KYC, or wallet custody.
- Managed KMS/Vault integration beyond local master-key documentation.
- Public demo abuse protection beyond documented operator controls.
- Formal legal, trademark, provider-terms, or privacy-policy review.

## Release Gate

Before tagging `v0.5.0-beta.1`, maintainers should confirm:

- `pnpm scan:keys` passes with no findings.
- `pnpm test`, `pnpm lint`, `pnpm format`, and `pnpm typecheck` pass.
- Runtime smoke passes in a Docker-enabled environment.
- No local service port setting falls outside `3300-3399`.
- Console setup and usage/ledger workflows keep admin tokens server-side.
- No Gateway response returns plaintext provider keys or encrypted credential
  ciphertext.
