# FountLayer Beta Threat Model

Scope: `v0.5.0-beta.2` self-hosted operator beta.

This document covers the open-source self-hosted Gateway, Console, SDK, Worker,
database schema, and local demos. It does not certify a hosted managed-service
deployment.

## Protected Assets

- Provider API keys and encrypted provider credential ciphertext.
- Gateway admin bearer tokens, Console operator tokens, Console session-signing
  secrets, session-ticket signing secrets, one-time tickets, and signed browser
  sessions.
- End-user identifiers owned by apps.
- Usage events and ledger entries.
- Faucet grant balances, allowlists, daily caps, and expiration controls.
- Database connection strings, credential master keys, and runtime secrets.
- Prompt and assistant output content, which is intentionally not logged by
  default.

## Trust Boundaries

| Boundary                    | Trusted Side               | Untrusted Side         | Required Control                                                |
| --------------------------- | -------------------------- | ---------------------- | --------------------------------------------------------------- |
| SDK to Gateway              | Gateway                    | App client and network | Session token plus attribution headers.                         |
| App backend to browser      | Trusted ticket issuer      | Browser and network    | Five-minute, single-use, app-scoped signed ticket.              |
| Browser to Console          | Console server             | Browser and network    | Operator login, signed HttpOnly session, and TLS.               |
| Console to Gateway          | Console server and Gateway | Browser client         | Gateway admin token stays server-side only.                     |
| Gateway to provider adapter | Gateway                    | Provider network/API   | Provider keys stay server-side in the managed path.             |
| Gateway to database         | Gateway and database       | Public network         | Use Postgres credentials only in server env.                    |
| Public docs/site            | Static content             | Public internet        | No secrets, admin tokens, or provider keys.                     |
| Document upload to demo     | Browser-local PDF parser   | Untrusted file bytes   | Size, page, and extracted-text limits; raw PDF is not uploaded. |

## Primary Threats And Mitigations

| Threat                                              | Impact                                         | Current Mitigation                                                                                                                                       |
| --------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider key appears in SDK, frontend, logs, or Git | Upstream account compromise                    | Strict placeholder policy, `pnpm scan:keys`, metadata-only credential responses.                                                                         |
| Admin token exposed to browser                      | Full operator control                          | Console uses server actions and server env only; never use `NEXT_PUBLIC_*` for admin tokens.                                                             |
| Anonymous visitor reaches Console control plane     | Full operator control                          | Proxy gates every page; runtime reads and Server Actions independently verify a signed session or operator bearer.                                       |
| Stolen Console browser session is replayed          | Operator control until expiry                  | Eight-hour HMAC session, HttpOnly and SameSite=Strict cookie, TLS, logout, and an independent signing secret.                                            |
| Session token replay across attribution             | Unauthorized metered calls                     | Session token hashes are stored server-side; authenticated `/v1` requests must match captured attribution.                                               |
| Browser invents or drifts session attribution       | Cross-app credit abuse                         | Gateway verifies an HMAC ticket binding all attribution fields and managed mode before atomically redeeming it.                                          |
| Ticket or rate limit is replayed across instances   | Session/faucet abuse                           | PostgreSQL stores ticket-ID hashes and atomic rate counters across Gateway instances and restarts.                                                       |
| Cross-app IDs are joined through global resources   | Tenant data or credit crossover                | Composite foreign keys bind sessions, grants, usage, ledger, wallets, and credentials to an explicit app.                                                |
| Binary-float or estimate drift changes billing      | Incorrect balances or reconciliation           | BigInt fixed-point pricing settles from validated actual adapter usage and a pinned Store price/policy snapshot.                                         |
| An applied migration is edited or races another run | Unreviewed schema drift                        | Advisory-locked migration journal rejects filename/checksum mismatches.                                                                                  |
| Duplicate billing on client retry                   | Duplicate usage/ledger records                 | `idempotency-key` uses a session-scoped request hash and PostgreSQL reservation completed atomically with billing.                                       |
| Adapter failure after payment precheck              | User charged without provider result           | Usage events and ledger entries are written only after successful adapter response.                                                                      |
| Route to unapproved/high-cost model                 | Unexpected spend                               | Route model allowlists and max retail caps run before adapter execution.                                                                                 |
| Faucet abuse                                        | Free-credit drain                              | Faucet grants require balance, model allowlist, use-case allowlist, daily cap, expiration, and status.                                                   |
| Wallet overspend                                    | Negative balances                              | Wallet-funded writes atomically prevent negative balances.                                                                                               |
| Health or telemetry leaks secrets                   | Credential or prompt exposure                  | Health checks return component status only; telemetry/spans/metrics are metadata-only.                                                                   |
| Telemetry backend fails after billing               | Charged call appears failed                    | Telemetry writes are best-effort and cannot alter the committed request outcome.                                                                         |
| End-user deletion breaks accounting                 | Ledger integrity loss                          | Privacy purge anonymizes identifiers and metadata without deleting usage or ledger facts.                                                                |
| Malicious, oversized, or unreadable document upload | Browser exhaustion or unintended data transfer | PDF.js runs in-browser with 10 MB, 40-page, and 80,000-character limits; unsupported, encrypted, image-only, and unreadable files fail before inference. |

## Explicit Non-Goals For This Beta

- Hosted managed-service production authentication and tenant RBAC.
- Payment processing, tax, invoice, KYC, or wallet custody.
- Managed KMS/Vault integration beyond local master-key documentation.
- Public demo abuse protection beyond documented operator controls.
- Formal legal, trademark, provider-terms, or privacy-policy review.

## Release Gate

Before tagging `v0.5.0-beta.2`, maintainers should confirm:

- `pnpm scan:keys` passes with no findings.
- `pnpm test`, `pnpm lint`, `pnpm format`, and `pnpm typecheck` pass.
- Runtime smoke passes in a Docker-enabled environment.
- No local service port setting falls outside `3300-3399`.
- Anonymous Console page/action requests are rejected, authenticated setup and
  usage/ledger workflows succeed, and all Gateway admin tokens stay server-side.
- Ticket tamper, expiry, replay, attribution drift, and durable-limit tests pass;
  ticket-signing secrets never enter browser bundles or logs.
- No Gateway response returns plaintext provider keys or encrypted credential
  ciphertext.
- Real PDF fixture extraction, upload limits, unreadable-document failure, and the
  browser summary flow pass without uploading raw PDF bytes.
