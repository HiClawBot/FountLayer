# FountLayer Beta Security Checklist

Scope: `v0.5.0-beta.1` self-hosted operator beta.

## Required Before Tagging

- [x] Provider keys are absent from SDK, frontend, mobile, desktop, logs, docs,
      and Git-tracked files.
- [x] Strict key scan exists and passes with no findings: `pnpm scan:keys`.
- [x] Gateway Admin APIs require configured bearer token authentication.
- [x] Console Admin API calls keep `CONSOLE_GATEWAY_ADMIN_TOKEN` server-side.
- [x] Session tokens are stored as hashes only.
- [x] Authenticated `/v1` requests require attribution match for app, channel,
      end user, use case, and mode.
- [x] Admin session revoke makes issued session tokens unusable without
      returning plaintext tokens or token hashes.
- [x] Credential create/rotate responses return metadata only.
- [x] Hosted end-user BYOK credential storage requires explicit Gateway opt-in.
- [x] Successful billable calls create exactly one usage event.
- [x] Money movement for billable calls creates balanced ledger entries.
- [x] Failed adapters, open circuits, route denials, rate limits, and
      insufficient balances do not create usage or ledger records.
- [x] Faucet grants require remaining balance, model allowlist, use-case
      allowlist, daily cap, expiration, and status.
- [x] Route policies enforce model allowlists and route spend caps before
      adapter execution.
- [x] Wallet-funded calls prevent negative balances.
- [x] PostgreSQL idempotency reservations coordinate concurrent/restarted
      billable requests and complete atomically with usage and ledger writes.
- [x] Durable idempotency records exclude raw prompts and response bodies.
- [x] Metadata-only telemetry, spans, metrics, and health checks avoid prompts,
      outputs, auth headers, provider keys, session tokens, and thrown
      connection-string errors.
- [x] Telemetry sink failures cannot change billable request outcomes.
- [x] Privacy purge and anonymization preserve accounting records.
- [x] Local service port settings stay inside `3300-3399`.
- [x] Docker Compose runtime smoke passes in a Docker-enabled environment:
      <https://github.com/HiClawBot/FountLayer/actions/workflows/runtime-smoke.yml?query=branch%3Acodex%2Fv0.5.0-beta>.

## Operator Defaults

- Use `FOUNTLAYER_ADMIN_TOKEN_SHA256` instead of plaintext
  `FOUNTLAYER_ADMIN_TOKEN` outside local development.
- Generate `FOUNTLAYER_CREDENTIAL_MASTER_KEY` as a random 32-byte key, for
  example `base64:<32-byte-random-key>`.
- Use `FOUNTLAYER_GATEWAY_STORE=postgres` for production-like runtime checks.
- Keep `CONSOLE_GATEWAY_ADMIN_TOKEN` out of `NEXT_PUBLIC_*` variables.
- Keep prompt/output logging disabled unless a downstream app adds its own
  explicit, consented logging boundary.

## Still Out Of Beta Scope

- Hosted managed-service tenant RBAC and SSO.
- Managed KMS/Vault envelope encryption.
- Public demo CAPTCHA/IP throttling.
- Payment, tax, invoice, KYC, wallet custody, and settlement operations review.
- Formal provider terms review and hosted-service legal documents.
