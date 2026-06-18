# API Spec

The public Gateway API should be OpenAI-compatible where possible while adding FountLayer attribution and billing metadata.

## Required Headers

All `/v1` requests carry attribution headers. All `/v1` endpoints except
`POST /v1/sessions` require a session bearer token in `v0.2.0-alpha`.

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
session/key pair, the Gateway returns the original response and does not create
another usage event or ledger entry set.

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

## Admin APIs

Admin APIs require `Authorization: Bearer <admin token>` in `v0.2.0-alpha`.
Configure the Gateway with `FOUNTLAYER_ADMIN_TOKEN_SHA256`, or use
`FOUNTLAYER_ADMIN_TOKEN` for local development so the Gateway hashes it at
startup. Console live-data reads use `CONSOLE_GATEWAY_ADMIN_TOKEN` server-side.

Implemented:

```txt
GET    /admin/apps
GET    /admin/channels
GET    /admin/faucet-grants
GET    /admin/routes
GET    /admin/provider-credentials
POST   /admin/provider-credentials
PATCH  /admin/provider-credentials/:id/rotate
DELETE /admin/provider-credentials/:id
GET    /admin/pricing-policies
GET    /admin/usage-events
GET    /admin/ledger
```

The v0.2.0-alpha Console can read these endpoints directly for live usage and
ledger, registry, faucet, route, pricing, and credential-metadata views when
its server-side admin token is configured.

Credential writes require `FOUNTLAYER_CREDENTIAL_MASTER_KEY` on the Gateway.
Create and rotate requests include plaintext provider keys only in the
authenticated Admin request body; responses return metadata only and never
include plaintext keys or encrypted ciphertext. The `display` value is generated
by the Gateway as a masked value, not accepted from callers.

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
POST   /admin/apps
PATCH  /admin/apps/:id
POST   /admin/apps/:appId/channels
POST   /admin/faucet-grants
POST   /admin/routes
POST   /admin/pricing-policies
GET    /admin/revenue
```
