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

This root Compose file is for development dependencies. It does not start the
FountLayer applications.

## Production-Shaped Compose

The release profile is [`compose.production.yml`](../compose.production.yml). It pins
PostgreSQL 16.14, the non-root LiteLLM 1.86.2 image, and the Node 22.23.1 base by exact
multi-platform digest. It builds separate non-root targets for Gateway, Console, and
Demo, mounts application files read-only, drops Linux capabilities, sets PID/CPU/memory
limits, and binds application/database ports to loopback only.

Create a private environment file and replace every `replace_with_*` value:

```bash
cp infra/production.env.example .env.production
chmod 600 .env.production
```

The Gateway Admin token has two representations: put its plaintext value only in
`CONSOLE_GATEWAY_ADMIN_TOKEN`, and its lowercase SHA-256 digest in
`FOUNTLAYER_ADMIN_TOKEN_SHA256`. The ticket secret, Console session secret, credential
master key, LiteLLM master key, database password, and upstream provider key must all be
independent high-entropy values. URL-encode the database password inside `DATABASE_URL`.

Build, migrate, and bootstrap a fresh beta database:

```bash
docker compose --env-file .env.production -f compose.production.yml build
docker compose --env-file .env.production -f compose.production.yml up -d postgres litellm
docker compose --env-file .env.production -f compose.production.yml run --rm migrate
docker compose --env-file .env.production -f compose.production.yml --profile bootstrap run --rm seed
docker compose --env-file .env.production -f compose.production.yml up -d gateway console demo
```

The bootstrap seed is for a fresh test-credit beta only. Repeating it does not reset
wallet balances, grant balances, grant status, or expiration. It creates the
`demo-local-model` route alias expected by the LiteLLM configuration, while LiteLLM maps
that stable alias to `UPSTREAM_OPENAI_MODEL` at the configured OpenAI-compatible base
URL.

The seeded model price is a deterministic test value, not a provider price quote.
Before inviting external users, sign in to Console `/setup`, create a USD model-price
version whose provider/model match the route, and record the upstream price-sheet URL
or revision in `source`. The effective version is visible on `/pricing`; do not edit
historical database rows after calls have been billed.

Verify liveness and dependency readiness:

```bash
curl -fsS http://127.0.0.1:3300/health
curl -fsS http://127.0.0.1:3300/health/dependencies
docker compose --env-file .env.production -f compose.production.yml ps
```

`/health` proves only that the process is alive. `/health/dependencies` returns `503`
unless PostgreSQL and the authenticated LiteLLM/OpenAI-compatible model endpoint are
reachable. Keep ports `3300-3302` on loopback and terminate TLS/authentication in a
same-host reverse proxy before remote use. Set `NEXT_PUBLIC_GATEWAY_BASE_URL` to the
public HTTPS Gateway origin before building the Demo image.

## Prepare Database

```bash
pnpm install
pnpm build
pnpm db:migrate
pnpm db:seed
```

The beta migrator executes numbered files in filename order under a PostgreSQL
advisory lock and records each SHA-256 checksum in
`fountlayer_schema_migrations`. Re-running is a no-op; modifying an already-applied
migration fails closed. Existing beta databases can run `pnpm db:migrate` again to
add durable ticket/rate controls plus app-scoped wallet, credential, session, usage,
and ledger constraints. Ambiguous cross-app historical relationships stop the
migration and must be remediated explicitly instead of being reassigned silently.

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

`FOUNTLAYER_UPSTREAM_TIMEOUT_MS` defaults to 30 seconds and bounds the upstream request
and response-body read. Browser disconnects cancel an in-flight adapter call. SIGINT or
SIGTERM stops new Gateway work, drains Fastify and PostgreSQL connections, and exits
within `FOUNTLAYER_SHUTDOWN_GRACE_MS` (15 seconds by default).

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
the `Runtime Smoke` and `Container Gates` GitHub Actions workflows manually. Runtime
Smoke starts a deterministic OpenAI-compatible HTTP fixture, routes through the pinned
LiteLLM container, migrates and seeds Postgres, starts Gateway on `3300`, starts Console
on `3301`, and runs `pnpm smoke:runtime`. Container Gates builds all three non-root
images, emits SPDX JSON SBOMs, and fails on fixable high/critical image vulnerabilities.
CI also uploads the generated production dependency license inventory as a build artifact.

Before tagging, require a green run for the exact release commit in both
[Runtime Smoke](https://github.com/HiClawBot/FountLayer/actions/workflows/runtime-smoke.yml?query=branch%3Acodex%2Fv0.5.0-beta)
and
[Container Gates](https://github.com/HiClawBot/FountLayer/actions/workflows/container-gates.yml?query=branch%3Acodex%2Fv0.5.0-beta).

The smoke test checks:

- Gateway health.
- Dependency readiness.
- Gateway -> LiteLLM -> real HTTP fixture transport with provider-supplied usage.
- Session creation.
- Ticket tamper/replay protection and an anonymous Console denial.
- Estimate with positive retail price.
- One successful billable chat call.
- Admin readback for apps, channels, faucet grants, model-price versions, routes,
  pricing policies, usage, and ledger.
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

## Backup And Restore Drill

Install PostgreSQL 16 client tools on the operator host. Point `DATABASE_URL` at the
loopback-published production database, not the internal Compose hostname, and create a
mode-0600 custom-format backup:

```bash
DATABASE_URL='postgres://fountlayer:URL_ENCODED_PASSWORD@127.0.0.1:3332/fountlayer' \
  pnpm db:backup -- ./backups
```

Before trusting a backup, restore it into an automatically created temporary database.
The verifier checks that the migration journal exists, then always drops only that
temporary database:

```bash
DATABASE_URL='postgres://fountlayer:URL_ENCODED_PASSWORD@127.0.0.1:3332/fountlayer' \
  pnpm db:restore:verify -- ./backups/fountlayer-fountlayer-TIMESTAMP.dump
```

For a real recovery, stop Gateway/Console/Demo, retain the failed volume, create an
empty replacement database, run `pg_restore --exit-on-error --no-owner --no-privileges`
against that empty target, rerun `migrate`, then start Gateway and verify
`/health/dependencies`, usage counts, ledger balance, and Console attribution before
switching traffic. Never restore an untrusted dump or restore over the only production
copy.

## Cleanup

```bash
docker compose down
docker compose --env-file .env.production -f compose.production.yml down
```

To remove local database state:

```bash
docker compose down -v
```

Do not use real provider keys in this runbook. The external beta supports only
the managed LiteLLM path; BYOK and local routing remain unavailable. Keep
provider credentials in server-side encrypted storage only.
