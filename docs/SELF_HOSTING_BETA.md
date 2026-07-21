# Self-Hosted Beta Runbook

This runbook is for `v0.5.0-beta.2` self-hosted operator testing. It keeps all
local service ports inside `3300-3399`.

## Port Map

| Port   | Service                                  |
| ------ | ---------------------------------------- |
| `3300` | Gateway                                  |
| `3301` | Console                                  |
| `3302` | Demo Document Reader                     |
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

The beta migrations are rerunnable and execute in filename order. Existing beta
databases can run `pnpm db:migrate` again to add durable ticket-redemption and
rate-limit tables before starting the updated Gateway.

## Start Gateway

For local beta testing:

```bash
export FOUNTLAYER_SESSION_TICKET_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"

FOUNTLAYER_ADMIN_TOKEN=change_me_admin_token \
FOUNTLAYER_GATEWAY_ADAPTER=litellm \
FOUNTLAYER_GATEWAY_STORE=postgres \
FOUNTLAYER_SESSION_TICKET_SECRET="$FOUNTLAYER_SESSION_TICKET_SECRET" \
FOUNTLAYER_CREDENTIAL_MASTER_KEY=base64:CQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQk= \
LITELLM_BASE_URL=http://localhost:3305 \
LITELLM_MASTER_KEY=change_me \
pnpm --filter @fountlayer/gateway dev
```

For production-like testing, replace the plaintext admin token with
`FOUNTLAYER_ADMIN_TOKEN_SHA256`, use a non-local `DATABASE_URL`, and generate a
fresh 32-byte `FOUNTLAYER_CREDENTIAL_MASTER_KEY`. Retain the independent
`FOUNTLAYER_SESSION_TICKET_SECRET` in a secret manager and share it only with
the Gateway and trusted application backends that issue five-minute tickets.

`FOUNTLAYER_GATEWAY_ADAPTER` selects one adapter for the Gateway process:
`demo` for zero-provider-key development, `litellm` for the Compose sidecar, or
`local` for a direct OpenAI-compatible endpoint. Production mode rejects
`demo`. Direct local mode uses `LOCAL_OPENAI_BASE_URL` and optional
`LOCAL_OPENAI_API_KEY`, and only accepts localhost, private-LAN, or `.local`
targets.

## Issue Session Tickets From A Trusted Backend

Do not let a browser choose attribution or read the ticket secret. A trusted
application backend authenticates its user, derives the app-owned end-user hash,
and returns a short-lived ticket:

```ts
import { createSessionTicket } from "@fountlayer/session-ticket";

const ticket = await createSessionTicket({
  attribution: {
    appId: "app_pdf_reader",
    channelId: "channel_desktop",
    endUserId: "user_hash_123",
    mode: "managed",
    useCase: "paper_summary",
  },
  secret: process.env.FOUNTLAYER_SESSION_TICKET_SECRET!,
});
```

The browser passes only `{ ticket }` to `sdk.startSession`. The Gateway verifies
all claims, requires request attribution to match, stores only a ticket-ID hash,
and rejects expiry or replay. The bundled Document Reader demonstrates this
backend route at `/api/session-ticket`; it is a fixed-attribution test-credit
example, not general hosted-demo authentication.

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

Generate a separate Console operator token and session-signing secret. Keep the
plaintext operator token in your password manager or secret store; configure the
Console with only its SHA-256 digest.

```bash
export CONSOLE_OPERATOR_TOKEN="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
export CONSOLE_OPERATOR_TOKEN_SHA256="$(node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(process.env.CONSOLE_OPERATOR_TOKEN).digest("hex"))')"
export CONSOLE_SESSION_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"

GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_GATEWAY_ADMIN_TOKEN=change_me_admin_token \
CONSOLE_OPERATOR_TOKEN_SHA256="$CONSOLE_OPERATOR_TOKEN_SHA256" \
CONSOLE_SESSION_SECRET="$CONSOLE_SESSION_SECRET" \
pnpm --filter @fountlayer/console dev
```

Open `http://localhost:3301/login`, enter `CONSOLE_OPERATOR_TOKEN`, and continue
to either protected page:

```txt
http://localhost:3301/overview
http://localhost:3301/setup
```

## Optional Demo App

```bash
NEXT_PUBLIC_GATEWAY_BASE_URL=http://localhost:3300 \
FOUNTLAYER_SESSION_TICKET_SECRET="$FOUNTLAYER_SESSION_TICKET_SECRET" \
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
CONSOLE_SMOKE_OPERATOR_TOKEN="$CONSOLE_OPERATOR_TOKEN" \
FOUNTLAYER_SESSION_TICKET_SECRET="$FOUNTLAYER_SESSION_TICKET_SECRET" \
pnpm smoke:runtime
```

If Demo or smoke runs in a different shell, export the same ticket secret there;
it must match the Gateway. Export the same operator token for smoke as well. Do
not reuse the Gateway admin token as either Console credential or the ticket
secret.
Set `CONSOLE_SESSION_COOKIE_SECURE=true` behind production HTTPS ingress; it
defaults to secure cookies when `NODE_ENV=production`.

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
- Ticket tamper/replay protection and an anonymous Console denial.
- Estimate with positive retail price.
- One successful billable chat call.
- Admin readback for apps, channels, faucet grants, routes, pricing, usage,
  and ledger.
- A denied chat request does not create a usage event or ledger entries.
- An anonymous protected Console request redirects to `/login`.
- Console live pages render Gateway-backed data without leaking admin tokens,
  operator tokens, session tokens, plaintext provider keys, or encrypted
  credential fields.

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

Do not use real provider keys in this runbook. The external beta supports only
the managed LiteLLM path; BYOK and local routing remain unavailable. Keep
provider credentials in server-side encrypted storage only.
