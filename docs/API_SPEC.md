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

Implemented in `v0.1.0`:

```txt
GET    /admin/usage-events
GET    /admin/ledger
```

Planned:

```txt
POST   /admin/apps
GET    /admin/apps
PATCH  /admin/apps/:id
POST   /admin/apps/:appId/channels
GET    /admin/apps/:appId/channels
POST   /admin/faucet-grants
GET    /admin/faucet-grants
POST   /admin/routes
GET    /admin/routes
POST   /admin/pricing-policies
GET    /admin/revenue
```
