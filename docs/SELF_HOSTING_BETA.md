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
pnpm build
pnpm db:migrate
pnpm db:seed
```

The beta migration is rerunnable. Existing beta databases can run
`pnpm db:migrate` again to add the durable `idempotency_records` table before
starting the updated Gateway.

## Start Gateway

For local beta testing:

```bash
FOUNTLAYER_ADMIN_TOKEN=change_me_admin_token \
FOUNTLAYER_GATEWAY_ADAPTER=litellm \
FOUNTLAYER_GATEWAY_STORE=postgres \
FOUNTLAYER_CREDENTIAL_MASTER_KEY=base64:CQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQk= \
LITELLM_BASE_URL=http://localhost:3305 \
LITELLM_MASTER_KEY=change_me \
pnpm --filter @fountlayer/gateway dev
```

For production-like testing, replace the plaintext admin token with
`FOUNTLAYER_ADMIN_TOKEN_SHA256`, use a non-local `DATABASE_URL`, and generate a
fresh 32-byte `FOUNTLAYER_CREDENTIAL_MASTER_KEY`.

`FOUNTLAYER_GATEWAY_ADAPTER` selects one adapter for the Gateway process:
`demo` for zero-provider-key development, `litellm` for the Compose sidecar, or
`local` for a direct OpenAI-compatible endpoint. Production mode rejects
`demo`. Direct local mode uses `LOCAL_OPENAI_BASE_URL` and optional
`LOCAL_OPENAI_API_KEY`, and only accepts localhost, private-LAN, or `.local`
targets.

## Idempotent Billable Requests

Pass a unique `idempotency-key` on retryable chat calls. With the PostgreSQL
Store, all Gateway instances sharing the database coordinate the same
session/key pair. Concurrent duplicates and conflicting payloads return `409`;
completed requests never run or bill twice. Only the active process caches the
full response, so a completed retry after restart returns
`idempotency_already_completed` with the original usage-event ID.

The durable record contains a request hash and billing reference, not prompt or
completion bodies. Do not reuse keys across distinct logical requests.

## Start Console

```bash
GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_GATEWAY_ADMIN_TOKEN=change_me_admin_token \
pnpm --filter @fountlayer/console dev
```

Open:

```txt
http://localhost:3301/overview
http://localhost:3301/setup
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

If Docker is unavailable on the local machine, push `codex/v0.5.0-beta` or run
the `Runtime Smoke` GitHub Actions workflow manually. It starts the Compose
dependencies, migrates and seeds Postgres, starts Gateway on `3300`, starts
Console on `3301`, and runs `pnpm smoke:runtime`.

The beta release gate passed in GitHub Actions on the beta branch:
<https://github.com/HiClawBot/FountLayer/actions/workflows/runtime-smoke.yml?query=branch%3Acodex%2Fv0.5.0-beta>.

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
