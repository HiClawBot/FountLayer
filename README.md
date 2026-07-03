# FountLayer

**Open-source LLM last-mile distribution layer for apps.**  
中文名建议：**智泉层**

FountLayer lets any app safely embed LLM capabilities with managed models, developer-owned keys, end-user BYOK, local/LAN models, faucet credits, usage metering, attribution, and revenue-sharing ledgers.

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
LLM Adapter: Managed / Developer Key / BYOK / Local
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

## Four AI Access Modes

| Mode            | Description                                                                             | Good for                                     |
| --------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- |
| `managed`       | End users use AI without entering API keys. Requests go through the FountLayer Gateway. | Consumer apps and low-friction onboarding.   |
| `developer_key` | The app developer supplies provider keys and pricing policies.                          | SaaS, vertical apps, enterprise tools.       |
| `byok`          | End users bring their own API keys. Default should be local-only storage.               | Power users and privacy-sensitive users.     |
| `local`         | End users connect a local or LAN OpenAI-compatible endpoint.                            | Offline, private, low-cost, self-hosted use. |

## Local Quickstart

This repository is a TypeScript pnpm monorepo. The MVP loop can run locally
without real provider API keys because the Gateway uses a demo local adapter by
default.

```bash
git clone https://github.com/YOUR_ORG/fountlayer.git
cd fountlayer
pnpm install
cp .env.example .env
pnpm test
pnpm --filter @fountlayer/gateway dev
```

Docker Compose is included for Postgres, Redis, and LiteLLM self-hosting:

```bash
docker compose up -d
```

## Self-Hosted Beta Quickstart

Use this path for the `v0.5.0-beta.1` operator beta. All local service ports
must stay inside `3300-3399`.

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis litellm
pnpm db:migrate
pnpm db:seed
FOUNTLAYER_GATEWAY_STORE=postgres pnpm --filter @fountlayer/gateway dev
```

In another terminal, start the Console with the same local admin token:

```bash
GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_GATEWAY_ADMIN_TOKEN=change_me_admin_token \
pnpm --filter @fountlayer/console dev
```

Then run the runtime smoke path:

```bash
GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_BASE_URL=http://localhost:3301 \
CONSOLE_GATEWAY_ADMIN_TOKEN=change_me_admin_token \
pnpm smoke:runtime
```

For production-like testing, set `FOUNTLAYER_DEPLOYMENT_ENV=production`,
`FOUNTLAYER_GATEWAY_STORE=postgres`, hashed admin tokens, a non-local
`DATABASE_URL`, and `FOUNTLAYER_CREDENTIAL_MASTER_KEY`.

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
FOUNTLAYER_ADMIN_TOKEN=change_me_admin_token \
FOUNTLAYER_GATEWAY_STORE=postgres \
pnpm --filter @fountlayer/gateway dev

GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_GATEWAY_ADMIN_TOKEN=change_me_admin_token \
pnpm --filter @fountlayer/console dev

GATEWAY_BASE_URL=http://localhost:3300 \
CONSOLE_BASE_URL=http://localhost:3301 \
CONSOLE_GATEWAY_ADMIN_TOKEN=change_me_admin_token \
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
| `3302` | Demo PDF Reader                          |
| `3303` | Project website dev server               |
| `3304` | Project website preview server           |
| `3305` | LiteLLM proxy                            |
| `3314` | Local OpenAI-compatible endpoint example |
| `3332` | PostgreSQL                               |
| `3379` | Redis                                    |

The Console reads live Gateway Admin API usage, ledger, app, channel, faucet,
route, credential-metadata, and pricing data from `CONSOLE_GATEWAY_BASE_URL` or
`GATEWAY_BASE_URL`, and falls back to local sample data when the Gateway is
unavailable. The `/setup` page creates apps, channels, routes, faucet grants,
pricing policies, and credential metadata through server-side Admin API
actions. In `v0.5.0-beta.1`, `/admin/*` requires an admin bearer token.
Configure the Gateway with `FOUNTLAYER_ADMIN_TOKEN_SHA256` or
`FOUNTLAYER_ADMIN_TOKEN`, and configure the Console server with
`CONSOLE_GATEWAY_ADMIN_TOKEN`. Do not expose this token through `NEXT_PUBLIC_*`
environment variables.

For production-like Gateway startup, set `FOUNTLAYER_DEPLOYMENT_ENV=production`.
The Gateway then fails fast unless it uses `FOUNTLAYER_GATEWAY_STORE=postgres`,
an explicit non-local `DATABASE_URL`, and hashed admin tokens through
`FOUNTLAYER_ADMIN_TOKEN_SHA256` or `FOUNTLAYER_ADMIN_TOKEN_HASHES`. Production
startup also requires `FOUNTLAYER_CREDENTIAL_MASTER_KEY`, a 32-byte credential
encryption master key such as `base64:<32-byte-random-key>`, plus an optional
`FOUNTLAYER_CREDENTIAL_KEY_VERSION`.

BYOK stays local-only by default. SDK local endpoint configuration accepts only
localhost, private LAN, or `.local` URLs. Hosted end-user BYOK credential writes
are disabled unless the Gateway is explicitly started with
`FOUNTLAYER_ALLOW_HOSTED_BYOK=true`.

Gateway billable chat calls are protected by simple windowed caps. Tune
`FOUNTLAYER_BILLABLE_RATE_WINDOW_MS`,
`FOUNTLAYER_SESSION_BILLABLE_REQUESTS_PER_WINDOW`, and
`FOUNTLAYER_END_USER_BILLABLE_REQUESTS_PER_WINDOW` for self-hosted deployments.
Rate-limited calls return `429` before adapter execution, usage event creation,
or ledger entry creation.

When no faucet grant can pay, the Gateway can fall back to an end-user wallet
with sufficient balance. Wallet-funded successful calls still create exactly one
usage event and balanced ledger entries, and wallet deduction prevents negative
balances.

## SDK Example

```ts
import { createFountLayer } from "@fountlayer/sdk-js";

const ai = createFountLayer({
  appId: "app_pdf_reader",
  channelId: "desktop_app",
  endpoint: "https://gateway.example.com",
});

const session = await ai.startSession({
  endUserId: "hash_of_user_id",
  useCase: "paper_summary",
});

const result = await session.chat({
  model: "vertical/paper-summary",
  messages: [{ role: "user", content: "Summarize this paper." }],
  stream: true,
});
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

The current beta foundation proves the full commercial loop:

- SDK can call the Gateway.
- Gateway can route through the local demo adapter, LiteLLM adapter package, or
  OpenAI-compatible local adapter package.
- Requests include app/channel/end-user/use-case attribution.
- Faucet credits can be issued, limited, and deducted.
- Usage events and ledger entries are created for every successful call.
- Developer console can show usage, cost, revenue, gross margin, and channel commission.
- SDK helpers support local-only BYOK and local endpoint configuration.
- PostgreSQL-backed Gateway mode persists sessions, grants, usage, ledger,
  credentials metadata, wallets, routes, and pricing policies.
- Admin APIs require bearer-token authentication and return credential metadata
  only.
- Server-side credential writes encrypt provider keys before persistence.
- Wallet-funded calls, route policies, settlement exports, metadata-only
  observability, reliability controls, and privacy retention helpers are
  implemented as beta foundations.
- Provider API keys never appear in SDK, frontend bundles, mobile apps, logs, or the Git repository.

## Current Limitations

- `v0.5.0-beta.1` is a self-hosted operator beta, not a hosted managed-service
  production launch.
- Docker Compose runtime validation must be repeated in a Docker-enabled
  environment before tagging the beta release.
- Console usage and ledger filtering still need operator-grade controls.
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
- [Website](./docs/WEBSITE.md)
- [Beta Plan](./docs/BETA_PLAN.md)
- [Self-Hosted Beta Runbook](./docs/SELF_HOSTING_BETA.md)
- [Codex Tasks](./docs/CODEX_TASKS.md)
- [Release Checklist](./docs/RELEASE_CHECKLIST.md)
- [Release Notes v0.1.0](./docs/RELEASE_NOTES_v0.1.0.md)
- [Release Notes v0.5.0](./docs/RELEASE_NOTES_v0.5.0.md)
- [Release Notes v0.5.0-beta.1](./docs/RELEASE_NOTES_v0.5.0-beta.1.md)
- [Roadmap](./docs/ROADMAP.md)
- [Changelog](./CHANGELOG.md)

## License

Apache License 2.0. See [LICENSE](./LICENSE).

## Project Status

Public MVP foundation release. Not production ready for a hosted managed
service.

## Disclaimer

FountLayer is infrastructure for app-native AI access, metering, credits, and revenue sharing. It is not intended for API key resale, credential sharing, or evasion of provider terms. Review provider terms, payment rules, tax rules, and local regulations before operating a managed service.
