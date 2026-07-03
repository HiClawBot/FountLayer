# Self-Hosted Beta Runbook

This runbook is for `v0.5.0-beta.1` self-hosted operator testing. It keeps all
local service ports inside `3300-3399`.

## Port Map

| Port   | Service                                  |
| ------ | ---------------------------------------- |
| `3300` | Gateway                                  |
| `3301` | Console                                  |
| `3302` | Demo PDF Reader                          |
| `3303` | Website dev server                       |
| `3304` | Website preview server                   |
| `3305` | LiteLLM                                  |
| `3314` | Local OpenAI-compatible endpoint example |
| `3332` | PostgreSQL                               |
| `3379` | Redis                                    |

## Prerequisites

- Node.js `>=20.11.0`
- pnpm `10.32.1`
- Docker with Compose support
- No local service already listening on the ports above

## Start Infrastructure

```bash
cp .env.example .env
docker compose up -d postgres redis litellm
```

The Compose stack starts:

- Postgres on `localhost:3332`
- Redis on `localhost:3379`
- LiteLLM on `localhost:3305`

## Prepare Database

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
```

## Start Gateway

For local beta testing:

```bash
FOUNTLAYER_ADMIN_TOKEN=change_me_admin_token \
FOUNTLAYER_GATEWAY_STORE=postgres \
FOUNTLAYER_CREDENTIAL_MASTER_KEY=base64:CQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQk= \
pnpm --filter @fountlayer/gateway dev
```

For production-like testing, replace the plaintext admin token with
`FOUNTLAYER_ADMIN_TOKEN_SHA256`, use a non-local `DATABASE_URL`, and generate a
fresh 32-byte `FOUNTLAYER_CREDENTIAL_MASTER_KEY`.

## Start Console

```bash
GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_GATEWAY_ADMIN_TOKEN=change_me_admin_token \
pnpm --filter @fountlayer/console dev
```

Open:

```txt
http://localhost:3301/overview
```

## Optional Demo App

```bash
NEXT_PUBLIC_GATEWAY_BASE_URL=http://localhost:3300 \
pnpm --filter @fountlayer/demo-pdf-reader dev
```

Open:

```txt
http://localhost:3302
```

## Runtime Smoke

After Gateway and Console are running:

```bash
GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_BASE_URL=http://localhost:3301 \
CONSOLE_GATEWAY_ADMIN_TOKEN=change_me_admin_token \
pnpm smoke:runtime
```

The smoke test checks:

- Gateway health.
- Dependency readiness.
- Session creation.
- Estimate with positive retail price.
- One successful billable chat call.
- Admin readback for apps, channels, faucet grants, routes, pricing, usage,
  and ledger.
- A denied chat request does not create a usage event or ledger entries.
- Console live pages render Gateway-backed data without leaking admin tokens,
  session tokens, plaintext provider keys, or encrypted credential fields.

## Expected Success Shape

The smoke script prints JSON similar to:

```json
{
  "ok": true,
  "gatewayBaseUrl": "http://localhost:3300",
  "consoleBaseUrl": "http://localhost:3301",
  "gateway": {
    "usageEventId": "ue_...",
    "usageEvents": 1,
    "ledgerEntries": 4
  },
  "consolePages": ["/overview", "/apps", "/channels"]
}
```

## Cleanup

```bash
docker compose down
```

To remove local database state:

```bash
docker compose down -v
```

Do not use real provider keys in this runbook. Keep provider credentials in
server-side encrypted storage only, and keep BYOK local by default.
