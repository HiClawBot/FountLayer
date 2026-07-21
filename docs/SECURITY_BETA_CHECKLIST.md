# FountLayer Beta Security Checklist

Scope: `v0.5.0-beta.2` self-hosted operator beta.

## Required Before Tagging

- [x] Provider keys are absent from SDK, frontend, mobile, desktop, logs, docs,
      and Git-tracked files.
- [x] Strict key scan exists and passes with no findings: `pnpm scan:keys`.
- [x] Gateway Admin APIs require configured bearer token authentication.
- [x] Console Admin API calls keep `CONSOLE_GATEWAY_ADMIN_TOKEN` server-side.
- [x] Every Console page is fail-closed behind the operator proxy, and central
      runtime reads and Server Action mutations independently require authentication.
- [x] Console configuration stores only the SHA-256 operator-token digest; browser
      login exchanges the token for an eight-hour HMAC-signed, HttpOnly,
      SameSite=Strict session cookie.
- [x] Negative tests prove anonymous page and Server Action requests are rejected
      before any Gateway Admin request.
- [x] Session tokens are stored as hashes only.
- [x] Public session creation requires a five-minute HMAC ticket issued by a
      trusted backend and binding app, channel, end user, use case, and managed mode.
- [x] Ticket IDs are stored as hashes and redeemed once in the same Store
      transaction that creates the session; replay, expiry, tamper, and attribution
      drift tests pass.
- [x] Session-creation and billable-request limits use Store-backed atomic counters;
      PostgreSQL coverage verifies restart persistence.
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
- [ ] The updated authenticated Docker Compose runtime smoke passes in a
      Docker-enabled environment:
      <https://github.com/HiClawBot/FountLayer/actions/workflows/runtime-smoke.yml?query=branch%3Acodex%2Fv0.5.0-beta>.

## Operator Defaults

- Use `FOUNTLAYER_ADMIN_TOKEN_SHA256` instead of plaintext
  `FOUNTLAYER_ADMIN_TOKEN` outside local development.
- Generate `FOUNTLAYER_CREDENTIAL_MASTER_KEY` as a random 32-byte key, for
  example `base64:<32-byte-random-key>`.
- Use `FOUNTLAYER_GATEWAY_STORE=postgres` for production-like runtime checks.
- Keep `CONSOLE_GATEWAY_ADMIN_TOKEN` out of `NEXT_PUBLIC_*` variables.
- Generate independent high-entropy values for the Console operator token and
  `CONSOLE_SESSION_SECRET`; configure only `CONSOLE_OPERATOR_TOKEN_SHA256`, and
  never reuse the Gateway admin token for either purpose.
- Generate an independent `FOUNTLAYER_SESSION_TICKET_SECRET` of at least 32
  characters. Share it only with the Gateway and trusted ticket-issuing backend,
  never a browser or `NEXT_PUBLIC_*` variable.
- Terminate TLS before exposing the Console. Keep secure session cookies enabled
  outside loopback development.
- Keep prompt/output logging disabled unless a downstream app adds its own
  explicit, consented logging boundary.

## Still Out Of Beta Scope

- Hosted managed-service tenant RBAC and SSO.
- Managed KMS/Vault envelope encryption.
- Public demo CAPTCHA/IP throttling.
- Payment, tax, invoice, KYC, wallet custody, and settlement operations review.
- Formal provider terms review and hosted-service legal documents.
