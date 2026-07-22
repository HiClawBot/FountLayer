# FountLayer

**Open-source LLM last-mile distribution layer for apps.**  
中文名建议：**智泉层**

FountLayer lets apps embed managed LLM capabilities with attribution, controlled test
credits, usage metering, and balanced ledger records. The first external beta supports
one self-hosted managed-mode path; developer-key, BYOK, local/LAN, streaming, payments,
and settlement remain experimental foundations. See the
[external beta capability matrix](docs/BETA_CAPABILITIES.md).

> FountLayer is not a chatbot UI and not an API-key reseller. It is an infrastructure layer for app-native AI distribution.

## Why FountLayer

Most end users do not want to configure API keys, base URLs, token budgets, provider pricing, or local model endpoints. Most software developers do not want to rebuild LLM routing, key security, free credits, metering, billing, ledgers, channel attribution, and BYOK support from scratch.

FountLayer turns any vertical software product into a safe and measurable AI distribution channel.

```txt
App / Plugin / SaaS
  ↓
FountLayer SDK
  ↓
FountLayer Gateway
  ↓
Faucet + Pricing + Budget Guard
  ↓
LLM Adapter: Managed via LiteLLM (external beta)
  ↓
Usage Events + Ledger Entries
  ↓
Developer Console + Revenue Sharing
```

## Core Concepts

| Concept      | Meaning                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| App          | A software product integrating FountLayer.                                                                      |
| Channel      | A distribution source inside or around an app: desktop app, plugin store, affiliate, marketplace, partner.      |
| End User     | The final user using AI inside the app.                                                                         |
| Route        | A logical model alias such as `cheap/fast`, `smart/default`, or `vertical/paper-summary`.                       |
| Credential   | A provider credential from the platform, developer, end user, or local endpoint.                                |
| Faucet Grant | Controlled credits issued by platform, developer, provider, or campaign.                                        |
| Usage Event  | Token-level record of an LLM request.                                                                           |
| Ledger Entry | Money movement record for wallet debit, platform fee, developer margin, channel commission, subsidy, or refund. |

## AI Access Modes

| Mode            | External beta status | Description                                                                                     |
| --------------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `managed`       | Supported            | Requests use the operator-configured LiteLLM/OpenAI-compatible upstream.                        |
| `developer_key` | Experimental         | Credential and protocol foundations exist; no public end-to-end path is offered.                |
| `byok`          | Unavailable          | SDK local-storage helpers exist, but the stock request path does not use the stored key.        |
| `local`         | Unavailable          | SDK endpoint helpers exist, but the stock browser request path does not route to that endpoint. |

## Local Quickstart

This repository is a TypeScript pnpm monorepo. The MVP loop can run locally
without real provider API keys because the Gateway uses a demo local adapter by
default.

```bash
git clone https://github.com/YOUR_ORG/fountlayer.git
cd fountlayer
pnpm install
pnpm build
cp .env.example .env
pnpm test
pnpm --filter @fountlayer/gateway dev
```

Development Compose is included for Postgres, Redis, and LiteLLM. The separate
production profile builds non-root Gateway, Console, and Demo images and runs
Postgres plus the pinned non-root LiteLLM image:

```bash
docker compose up -d
cp infra/production.env.example .env.production
docker compose --env-file .env.production -f compose.production.yml build
```

## Self-Hosted Beta Quickstart

Use this path for the `v0.5.0-beta.2` operator beta. All local service ports
must stay inside `3300-3399`.

```bash
pnpm install
pnpm build
cp .env.example .env
docker compose up -d postgres redis litellm
pnpm db:migrate
pnpm db:seed
export FOUNTLAYER_SESSION_TICKET_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
FOUNTLAYER_GATEWAY_ADAPTER=litellm \
FOUNTLAYER_GATEWAY_STORE=postgres \
FOUNTLAYER_SESSION_TICKET_SECRET="$FOUNTLAYER_SESSION_TICKET_SECRET" \
LITELLM_BASE_URL=http://localhost:3305 \
LITELLM_MASTER_KEY=change_me \
pnpm --filter @fountlayer/gateway dev
```

For the production-shaped path, replace every value in `.env.production`, then run the
one-time migration and bootstrap seed before the application services:

```bash
docker compose --env-file .env.production -f compose.production.yml up -d postgres litellm
docker compose --env-file .env.production -f compose.production.yml run --rm migrate
docker compose --env-file .env.production -f compose.production.yml --profile bootstrap run --rm seed
docker compose --env-file .env.production -f compose.production.yml up -d gateway console demo
```

The published ports bind to loopback and must sit behind authenticated TLS ingress for
remote access. See the [self-hosted beta runbook](docs/SELF_HOSTING_BETA.md) for secret
generation, readiness, backup/restore verification, and shutdown procedures.

In another terminal, generate an independent Console operator credential, retain
the plaintext token for login/smoke, and start the Console with only its digest:

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

Sign in at `http://localhost:3301/login` with `CONSOLE_OPERATOR_TOKEN`.

Then run the runtime smoke path:

```bash
GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_BASE_URL=http://localhost:3301 \
CONSOLE_GATEWAY_ADMIN_TOKEN=change_me_admin_token \
CONSOLE_SMOKE_OPERATOR_TOKEN="$CONSOLE_OPERATOR_TOKEN" \
pnpm smoke:runtime
```

For production-like testing, set `FOUNTLAYER_DEPLOYMENT_ENV=production`,
`FOUNTLAYER_GATEWAY_STORE=postgres`, hashed admin tokens, a non-local
`DATABASE_URL`, `FOUNTLAYER_CREDENTIAL_MASTER_KEY`,
`FOUNTLAYER_GATEWAY_ADAPTER=litellm`, and a non-placeholder
`FOUNTLAYER_SESSION_TICKET_SECRET` shared only with trusted application
backends. The `demo` adapter is rejected in production mode.

## Current Local Loop

The MVP implementation includes the smallest complete FountLayer path:

```txt
SDK -> Gateway -> attribution -> faucet check -> local adapter -> usage_event -> ledger_entries -> console view
```

Useful development commands:

```bash
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm --filter @fountlayer/gateway dev
pnpm --filter @fountlayer/console dev
NEXT_PUBLIC_GATEWAY_BASE_URL=http://localhost:3300 pnpm --filter @fountlayer/demo-pdf-reader dev
```

### Database-Backed Gateway

The default Gateway mode is `memory` so the demo works without Docker. To use
the beta PostgreSQL-backed store:

```bash
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
FOUNTLAYER_GATEWAY_STORE=postgres pnpm --filter @fountlayer/gateway dev
```

Run the optional Postgres integration test with:

```bash
FOUNTLAYER_RUN_DB_TESTS=1 pnpm test
```

Run the runtime smoke test after starting Gateway and Console with the same
admin token:

```bash
export FOUNTLAYER_SESSION_TICKET_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"

FOUNTLAYER_ADMIN_TOKEN=change_me_admin_token \
FOUNTLAYER_GATEWAY_STORE=postgres \
FOUNTLAYER_SESSION_TICKET_SECRET="$FOUNTLAYER_SESSION_TICKET_SECRET" \
pnpm --filter @fountlayer/gateway dev

export CONSOLE_OPERATOR_TOKEN="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
export CONSOLE_OPERATOR_TOKEN_SHA256="$(node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(process.env.CONSOLE_OPERATOR_TOKEN).digest("hex"))')"
export CONSOLE_SESSION_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"

GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_GATEWAY_ADMIN_TOKEN=change_me_admin_token \
CONSOLE_OPERATOR_TOKEN_SHA256="$CONSOLE_OPERATOR_TOKEN_SHA256" \
CONSOLE_SESSION_SECRET="$CONSOLE_SESSION_SECRET" \
pnpm --filter @fountlayer/console dev

GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_BASE_URL=http://localhost:3301 \
CONSOLE_GATEWAY_ADMIN_TOKEN=change_me_admin_token \
CONSOLE_SMOKE_OPERATOR_TOKEN="$CONSOLE_OPERATOR_TOKEN" \
FOUNTLAYER_SESSION_TICKET_SECRET="$FOUNTLAYER_SESSION_TICKET_SECRET" \
pnpm smoke:runtime
```

If another service already uses port `3300`, start the gateway on another port within `3300-3399` and point the demo at it:

```bash
GATEWAY_PORT=3390 pnpm --filter @fountlayer/gateway dev
NEXT_PUBLIC_GATEWAY_BASE_URL=http://localhost:3390 pnpm --filter @fountlayer/demo-pdf-reader dev
```

The demo seed attribution is:

```txt
app_id: app_pdf_reader
channel_id: channel_desktop
end_user_id: user_hash_123
use_case: paper_summary
mode: managed
```

The developer console runs on `http://localhost:3301` by default, and the PDF
reader demo runs on `http://localhost:3302`. Keep all local development ports
inside `3300-3399`; if a port is occupied, stop the conflicting process or
choose another explicit port in that range.

Local port allocation:

| Port   | Service                                  |
| ------ | ---------------------------------------- |
| `3300` | Gateway                                  |
| `3301` | Console                                  |
| `3302` | Demo Document Reader                     |
| `3303` | Project website dev server               |
| `3304` | Project website preview server           |
| `3305` | LiteLLM proxy                            |
| `3314` | Local OpenAI-compatible endpoint example |
| `3332` | PostgreSQL                               |
| `3379` | Redis                                    |

The Console reads Gateway Admin API usage, ledger, app, channel, faucet, route,
credential-metadata, and pricing data from `CONSOLE_GATEWAY_BASE_URL` or
`GATEWAY_BASE_URL`. If the Gateway cannot be reached, the Console shows an explicit
unavailable state and empty runtime collections; it never substitutes sample records.
The `/setup` page creates apps, channels, routes, faucet grants, immutable model-price
versions, pricing policies, app defaults, and credential metadata through server-side
Admin API actions. `/admin/*`
requires an admin bearer token, but the Console is protected by a single-operator login:
its proxy gates every page, while runtime reads and Server Actions recheck the signed
session or automation bearer token.
Configure the Gateway with `FOUNTLAYER_ADMIN_TOKEN_SHA256` or
`FOUNTLAYER_ADMIN_TOKEN`, and configure the Console server with
`CONSOLE_GATEWAY_ADMIN_TOKEN`, `CONSOLE_OPERATOR_TOKEN_SHA256`, and an independent
`CONSOLE_SESSION_SECRET`. Do not expose any of these through `NEXT_PUBLIC_*`
environment variables or reuse them for one another. Put the Console behind TLS and
keep secure session cookies enabled outside loopback development.

For production-like Gateway startup, set `FOUNTLAYER_DEPLOYMENT_ENV=production`.
The Gateway then fails fast unless it uses `FOUNTLAYER_GATEWAY_STORE=postgres`,
an explicit non-local `DATABASE_URL`, and hashed admin tokens through
`FOUNTLAYER_ADMIN_TOKEN_SHA256` or `FOUNTLAYER_ADMIN_TOKEN_HASHES`. Production
startup also requires `FOUNTLAYER_CREDENTIAL_MASTER_KEY`, a 32-byte credential
encryption master key such as `base64:<32-byte-random-key>`, plus an optional
`FOUNTLAYER_CREDENTIAL_KEY_VERSION`, and an independent
`FOUNTLAYER_SESSION_TICKET_SECRET` for trusted-backend ticket issuance.

BYOK and local endpoint helpers are experimental storage/configuration primitives in
this release. They do not change the stock SDK request destination or authenticate an
upstream. Hosted end-user BYOK writes remain disabled by default; do not enable or
advertise them for the external beta.

Gateway billable chat calls are protected by simple windowed caps. Tune
`FOUNTLAYER_BILLABLE_RATE_WINDOW_MS`,
`FOUNTLAYER_SESSION_BILLABLE_REQUESTS_PER_WINDOW`, and
`FOUNTLAYER_END_USER_BILLABLE_REQUESTS_PER_WINDOW`, plus
`FOUNTLAYER_SESSION_CREATIONS_PER_WINDOW`, for self-hosted deployments. These
counters are Store-backed and survive restart in PostgreSQL mode. Rate-limited
calls return `429` before adapter execution, usage event creation, or ledger
entry creation.

When no faucet grant can pay, the Gateway can fall back to an end-user wallet
with sufficient balance. Wallet-funded successful calls still create exactly one
usage event and balanced ledger entries, and wallet deduction prevents negative
balances.

Billable retries can carry a session-scoped idempotency key. PostgreSQL-backed
Gateway instances coordinate in-flight and completed requests without storing
prompt or completion bodies. Same-process retries can replay the original
response; after cache loss, a completed retry returns the original usage-event
reference without running or billing the request again.

The stock Gateway can select `demo` (development only), `litellm`, or `local` per
process. The external beta contract supports `litellm` only. LiteLLM mode reads
`LITELLM_BASE_URL` and `LITELLM_MASTER_KEY`; the other adapters remain internal or
experimental until their product contracts and release tests are complete. Adapter
requests have a configurable deadline (`FOUNTLAYER_UPSTREAM_TIMEOUT_MS`, 30 seconds by
default), disconnected clients cancel in-flight upstream calls, and dependency
readiness probes the configured adapter's authenticated model endpoint.

## SDK Example

```ts
import { createFountLayer } from "@fountlayer/sdk-js";

const ai = createFountLayer({
  appId: "app_pdf_reader",
  channelId: "channel_desktop",
  endpoint: "https://gateway.example.com",
});

// A trusted backend signs this five-minute, single-use ticket.
const { ticket } = await fetch("/api/session-ticket", { method: "POST" }).then(
  (response) => response.json(),
);
const session = await ai.startSession({ ticket });

const result = await session.chat(
  {
    model: "vertical/paper-summary",
    messages: [{ role: "user", content: "Summarize this paper." }],
  },
  { idempotencyKey: "paper-summary-document-123" },
);
```

## Gateway Request Headers

Every request should carry attribution fields.

```http
x-fl-app-id: app_pdf_reader
x-fl-channel-id: channel_desktop
x-fl-end-user-id: user_hash_123
x-fl-use-case: paper_summary
x-fl-mode: managed
```

## Repository Layout

```txt
fountlayer/
├── apps/
│   ├── gateway/           # Gateway API
│   ├── console/           # Developer console
│   ├── worker/            # Settlement and async jobs
│   └── demo-pdf-reader/   # First vertical demo
├── packages/
│   ├── sdk-js/            # Browser/Node SDK
│   ├── protocol/          # Shared OpenAPI schema and types
│   ├── db/                # Drizzle schema, migration, and seed data
│   ├── credentials/       # Server-side credential encryption helpers
│   ├── money/             # Exact fixed-point money and rate arithmetic
│   ├── pricing/           # Model price registry and estimator
│   ├── faucet/            # Faucet grant matching and deduction
│   ├── ledger/            # Double-entry ledger helpers
│   ├── settlement/        # Ledger reconciliation and export helpers
│   ├── observability/     # Metadata-only telemetry helpers
│   ├── reliability/       # Retry and circuit breaker helpers
│   ├── privacy/           # Retention and end-user tombstone helpers
│   ├── adapter-core/      # Shared adapter interface
│   ├── adapter-litellm/   # LiteLLM adapter
│   └── adapter-local/     # OpenAI-compatible local endpoint adapter
├── docs/
├── infra/
└── examples/
```

## Implemented Foundation Scope

The current foundation proves the accounting shape of the managed test-credit loop. It
does not yet prove a production commercial loop:

- SDK can call the Gateway.
- Gateway can select the development demo adapter or server-configured LiteLLM/local
  adapter packages; only LiteLLM is in the external beta contract.
- Requests include app/channel/end-user/use-case attribution.
- Faucet credits can be issued, limited, and deducted.
- Usage events and ledger entries are created for every successful call.
- Developer console can show usage, cost, revenue, gross margin, and channel commission.
- SDK helpers can store local-only BYOK/local endpoint configuration, but those values do
  not participate in the stock request path and are not supported beta execution modes.
- PostgreSQL-backed Gateway mode persists sessions, grants, usage, ledger,
  credentials metadata, wallets, routes, and pricing policies.
- Checksum-journaled forward migrations enforce app-scoped session, user, wallet,
  credential, usage, and ledger relationships.
- Monetary values are calculated with 8-decimal fixed-point arithmetic; the final
  charge is recomputed from validated adapter token usage and Store-backed prices and
  policy, rather than copied from the pre-call estimate.
- Admin APIs require bearer-token authentication and return credential metadata
  only.
- Server-side credential writes encrypt provider keys before persistence.
- Wallet-funded calls, route policies, settlement exports, metadata-only observability,
  reliability controls, and privacy retention helpers exist as foundations. Several are
  not wired into the stock production runtime and are not public beta promises.
- Provider API keys never appear in SDK, frontend bundles, mobile apps, logs, or the Git repository.

## Current Limitations

- `v0.5.0-beta.2` is a self-hosted operator beta, not a hosted managed-service
  production launch.
- The repository is not ready for external beta exposure until the P0 gates in
  [the beta plan](docs/BETA_PLAN.md) and capability matrix are complete.
- The document demo performs bounded browser-local PDF.js extraction: 10 MB, 40 pages,
  and 80,000 extracted characters. Raw PDF bytes are not sent to the Gateway.
- Pinned, non-root production images and a resource-bounded Compose profile are
  implemented; their Docker build, SBOM, and fixable high/critical scan workflow must be
  green on the release commit.
- Developer/channel revenue-share markups remain disabled until payout wallets and
  settlement obligations are implemented.
- The runtime workflow now traverses Gateway -> LiteLLM -> a deterministic network
  fixture. A credentialed real-provider golden smoke is still required before tagging.
- Managed-service operations still need formal provider terms review,
  privacy/terms documents, payment/tax review, and managed KMS/Vault backing.

## Security Rule Zero

Never embed real provider API keys in the SDK, frontend code, mobile app, desktop package, or repository history. Managed provider credentials must stay server-side. BYOK should default to local-only storage unless the user explicitly opts into hosted encrypted storage.

## Recommended Stack

| Layer         | Recommendation                                                |
| ------------- | ------------------------------------------------------------- |
| SDK           | TypeScript first. Browser, Node.js, Electron, Tauri, Next.js. |
| Gateway       | Node.js + Fastify or NestJS.                                  |
| Database      | PostgreSQL.                                                   |
| Queue/cache   | Redis.                                                        |
| LLM gateway   | LiteLLM sidecar or adapter.                                   |
| Metering      | Built-in MVP ledger; optional OpenMeter adapter.              |
| Billing       | Built-in credits MVP; optional Lago adapter.                  |
| Observability | OpenTelemetry.                                                |

## Documentation

- [Whitepaper](./WHITEPAPER.md)
- [Construction Guide](./CONSTRUCTION.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [API Spec](./docs/API_SPEC.md)
- [Data Model](./docs/DATA_MODEL.sql)
- [Pricing and Ledger](./docs/PRICING_LEDGER.md)
- [Security](./docs/SECURITY.md)
- [Threat Model](./docs/THREAT_MODEL.md)
- [Beta Security Checklist](./docs/SECURITY_BETA_CHECKLIST.md)
- [Website](./docs/WEBSITE.md)
- [Beta Plan](./docs/BETA_PLAN.md)
- [Self-Hosted Beta Runbook](./docs/SELF_HOSTING_BETA.md)
- [Codex Tasks](./docs/CODEX_TASKS.md)
- [Release Checklist](./docs/RELEASE_CHECKLIST.md)
- [GitHub Release Draft v0.5.0-beta.2](./docs/GITHUB_RELEASE_v0.5.0-beta.2.md)
- [Release Notes v0.1.0](./docs/RELEASE_NOTES_v0.1.0.md)
- [Release Notes v0.5.0](./docs/RELEASE_NOTES_v0.5.0.md)
- [Release Notes v0.5.0-beta.2](./docs/RELEASE_NOTES_v0.5.0-beta.2.md)
- [Roadmap](./docs/ROADMAP.md)
- [Changelog](./CHANGELOG.md)

## License

Apache License 2.0. See [LICENSE](./LICENSE).

## Project Status

Public MVP foundation release. Not production ready for a hosted managed
service.

## Disclaimer

FountLayer is infrastructure for app-native AI access, metering, credits, and revenue sharing. It is not intended for API key resale, credential sharing, or evasion of provider terms. Review provider terms, payment rules, tax rules, and local regulations before operating a managed service.
