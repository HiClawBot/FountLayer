# API Spec

External beta note: only managed, non-streaming chat is supported. The broader schema
retains target/experimental mode and stream fields for compatibility; consult
[`BETA_CAPABILITIES.md`](BETA_CAPABILITIES.md) before exposing a client feature.

The public Gateway API should be OpenAI-compatible where possible while adding FountLayer attribution and billing metadata.

## Required Headers

All `/v1` requests carry attribution headers. All `/v1` endpoints except
`POST /v1/sessions` require a session bearer token in `v0.5.0-beta.1`.

Gateway stores only a SHA-256 hash of the session token. The attribution headers
on each authenticated request must match the attribution captured when the
session was created.

```http
Authorization: Bearer fl_session_or_app_token
x-fl-app-id: app_pdf_reader
x-fl-channel-id: channel_desktop
x-fl-end-user-id: user_hash_123
x-fl-use-case: paper_summary
x-fl-mode: managed
```

All Gateway responses include an `x-fl-request-id` response header for support,
tracing, and reconciliation without logging raw prompts or outputs.

`POST /v1/chat/completions` accepts an optional `idempotency-key` header. When a
successful billable chat response has already been recorded for the same
session/key pair, the Gateway does not execute the adapter or create another
usage event or ledger entry set. A same-process retry can replay the original
response from memory. PostgreSQL mode durably coordinates Gateway instances:
an in-flight duplicate returns `409 idempotency_in_progress`, reuse with a
different parsed request returns `409 idempotency_conflict`, and a completed
request whose response cache is unavailable returns
`409 idempotency_already_completed` with the original `usage_event_id`.

The durable record stores a canonical request hash and billing reference, not
raw prompts or assistant output. Keys are scoped to the authenticated session
and may contain at most 200 characters. The JavaScript SDK exposes the header as
the optional second argument `{ idempotencyKey: "..." }` to `chat` and
`streamChat`.

## POST /v1/sessions

Creates a session for an end user.

The response returns the only plaintext copy of the session token. Store it on
the client side as an application session token, not as a provider API key.

Request:

```json
{
  "appId": "app_pdf_reader",
  "channelId": "channel_desktop",
  "endUserId": "user_hash_123",
  "useCase": "paper_summary",
  "mode": "managed"
}
```

Response:

```json
{
  "session_id": "sess_123",
  "token": "fl_sess_xxx",
  "expires_at": "2026-06-18T00:00:00Z"
}
```

## GET /health/dependencies

Returns readiness-style dependency checks without attribution or Admin auth.
The default Store check reports `memory` or `postgres`; deployments can inject
additional checks such as `adapter` and `redis`. Failed checks return
`503 degraded` and component status only, not thrown exception messages.

Response:

```json
{
  "service": "fountlayer-gateway",
  "status": "ok",
  "checks": [{ "name": "store", "component": "postgres", "status": "ok" }]
}
```

## GET /v1/balance

Returns wallet and faucet balances.

Response:

```json
{
  "currency": "USD",
  "wallet_balance": "0.00000000",
  "faucet_balance": "1.00000000",
  "active_grants": ["grant_new_user"]
}
```

## GET /v1/faucet-grants

Returns active grants available to the end user.

## POST /v1/estimate

Request:

```json
{
  "model": "vertical/paper-summary",
  "messages": [{ "role": "user", "content": "Summarize this paper." }]
}
```

Response:

```json
{
  "currency": "USD",
  "model": "vertical/paper-summary",
  "route_id": "route_paper_summary",
  "routed_model": "demo-local-model",
  "estimated_input_tokens": 1024,
  "estimated_output_tokens": 512,
  "upstream_cost": "0.00210000",
  "wholesale_price": "0.00290000",
  "retail_price": "0.00340000",
  "payment_source": "faucet_grant"
}
```

`payment_source` is `faucet_grant` when a matching faucet grant can pay,
`wallet` when the end-user wallet has sufficient balance, and `none` when
neither source can pay.

## POST /v1/chat/completions

OpenAI-compatible chat completion endpoint.
The `model` field is treated as a FountLayer route alias. The Gateway resolves
the alias to a server-side route policy, checks model allowlists and route spend
caps, then calls the configured adapter with the target provider model. Rejected
route policy checks happen before adapter execution, usage event creation, or
ledger entry creation.

Request:

```json
{
  "model": "vertical/paper-summary",
  "messages": [{ "role": "user", "content": "Summarize this paper." }],
  "stream": false
}
```

Response:

```json
{
  "id": "req_123",
  "object": "chat.completion",
  "model": "gpt-4.1-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "input_tokens": 1024,
    "output_tokens": 512,
    "total_tokens": 1536
  },
  "billing": {
    "currency": "USD",
    "upstream_cost": "0.00210000",
    "retail_price": "0.00340000",
    "paid_by": "faucet_grant",
    "faucet_remaining": "0.99660000"
  }
}
```

Wallet-funded responses use `"paid_by": "wallet"` and return
`wallet_balance` instead of `faucet_remaining`.

## Admin APIs

Admin APIs require `Authorization: Bearer <admin token>` in
`v0.5.0-beta.1`.
Configure the Gateway with `FOUNTLAYER_ADMIN_TOKEN_SHA256`, or use
`FOUNTLAYER_ADMIN_TOKEN` for local development so the Gateway hashes it at
startup. Console live-data reads use `CONSOLE_GATEWAY_ADMIN_TOKEN` server-side.

Implemented:

```txt
GET    /admin/apps
POST   /admin/apps
PATCH  /admin/apps/:id
GET    /admin/channels
POST   /admin/channels
PATCH  /admin/channels/:id
GET    /admin/faucet-grants
POST   /admin/faucet-grants
PATCH  /admin/faucet-grants/:id
GET    /admin/routes
POST   /admin/routes
PATCH  /admin/routes/:id
GET    /admin/provider-credentials
POST   /admin/provider-credentials
PATCH  /admin/provider-credentials/:id/rotate
DELETE /admin/provider-credentials/:id
GET    /admin/pricing-policies
POST   /admin/pricing-policies
PATCH  /admin/pricing-policies/:id
POST   /admin/sessions/:id/revoke
GET    /admin/usage-events
GET    /admin/ledger
POST   /admin/privacy/request-metadata/purge
POST   /admin/privacy/end-users/anonymize
```

Admin list endpoints return their existing array field plus `page` metadata:

```json
{
  "usage_events": [],
  "page": {
    "limit": 100,
    "offset": 0,
    "returned": 0,
    "total": 0
  }
}
```

Supported common query parameters:

| Parameter      | Meaning                                                     |
| -------------- | ----------------------------------------------------------- |
| `limit`        | Page size, default `100`, max `500`.                        |
| `offset`       | Zero-based item offset, default `0`.                        |
| `q`            | Case-insensitive search over endpoint-specific text fields. |
| `created_from` | Inclusive date lower bound for records with `createdAt`.    |
| `created_to`   | Inclusive date upper bound for records with `createdAt`.    |

Endpoint-specific filters use snake_case field names, such as `app_id`,
`channel_id`, `end_user_id`, `route_id`, `usage_event_id`, `wallet_id`,
`status`, `mode`, `provider`, `model`, `direction`, and `reason`.

Admin setup writes use camelCase JSON fields. Faucet grant creation requires
`remaining`, `allowedModels`, `allowedUseCases`, `dailyCap`, and `expiresAt`;
route creation requires `modelAllowlist`. Provider credential writes remain
metadata-only in responses and never return plaintext keys or ciphertext.

The `v0.5.0-beta.1` Console can read these endpoints directly for live usage and
ledger, registry, faucet, route, pricing, and credential-metadata views when
its server-side admin token is configured.

Session revoke marks a Gateway session as revoked and makes the original
session token unusable for `/v1` requests. The response returns session
metadata only and never returns the plaintext token or token hash.

Session revoke response:

```json
{
  "session": {
    "id": "sess_123",
    "app_id": "app_pdf_reader",
    "channel_id": "channel_desktop",
    "end_user_id": "user_hash_123",
    "use_case": "paper_summary",
    "mode": "managed",
    "expires_at": "2026-07-04T00:00:00Z",
    "revoked_at": "2026-07-03T12:00:00Z",
    "created_at": "2026-07-03T00:00:00Z"
  }
}
```

Credential writes require `FOUNTLAYER_CREDENTIAL_MASTER_KEY` on the Gateway.
Create and rotate requests include plaintext provider keys only in the
authenticated Admin request body; responses return metadata only and never
include plaintext keys or encrypted ciphertext. The `display` value is generated
by the Gateway as a masked value, not accepted from callers. End-user hosted
BYOK credential writes (`ownerType: "end_user"`) are rejected unless the Gateway
is explicitly configured with `FOUNTLAYER_ALLOW_HOSTED_BYOK=true`.

Privacy endpoints operate on metadata and app-owned identifiers without deleting
accounting facts. Request metadata purge clears `ledger_entries.metadata` older
than the configured retention window but keeps usage events, ledger entries, and
amounts intact. End-user anonymization replaces matching `end_user_id` values
with a deterministic tombstone, revokes sessions, active faucet grants, and
hosted end-user credentials, and scrubs ledger metadata. The response does not
echo the original end-user identifier.

Request metadata purge body:

```json
{
  "retentionDays": 30
}
```

End-user anonymization body:

```json
{
  "appId": "app_pdf_reader",
  "endUserId": "user_hash_123"
}
```

Create credential request:

```json
{
  "ownerType": "developer",
  "ownerId": "dev_demo",
  "provider": "demo",
  "apiKey": "provider-secret-placeholder",
  "budgetDaily": "1.25000000"
}
```

Create/rotate response:

```json
{
  "credential": {
    "id": "cred_123",
    "owner": "developer:dev_demo",
    "provider": "demo",
    "storage": "server-side encrypted:local-v1",
    "status": "active",
    "display": "prov...lder"
  }
}
```

Planned:

```txt
GET    /admin/revenue
```
