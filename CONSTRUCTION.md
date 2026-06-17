# FountLayer Construction Guide

This document is written for human developers and AI coding agents such as Codex. It defines the build order, non-negotiable constraints, architecture, data model, APIs, tests, and Definition of Done.

## 0. Build Principle

Build the smallest complete loop first:

```txt
SDK request -> Gateway -> attribution -> faucet/budget check -> LLM adapter -> usage event -> ledger entries -> console view
```

Do not start by adding many providers. Do not build a generic chat app first. The product value is in attribution, faucet credits, usage metering, and revenue-sharing ledgers.

## 1. Non-Negotiable Product Rules

1. Provider API keys must never be present in SDK, frontend bundles, mobile apps, logs, screenshots, or Git history.
2. Every request must have `app_id`, `channel_id`, `end_user_id`, `use_case`, and `mode`.
3. Every successful billable request must create exactly one `usage_event`.
4. Every money movement must create `ledger_entries`.
5. Faucet grants must have limits: remaining balance, allowed models, allowed use cases, daily cap, and expiration.
6. The system must estimate cost before calling expensive models.
7. Streaming responses must be interruptible when budget is exhausted.
8. BYOK must default to local-only storage.
9. Local/LAN endpoint support must be OpenAI-compatible first.
10. Managed mode must use server-side credentials only.

## 2. Recommended Stack

```txt
Package manager: pnpm
Language: TypeScript
Gateway: Fastify or NestJS
Console: Next.js
SDK: TypeScript, Browser + Node compatible
Database: PostgreSQL
ORM: Prisma or Drizzle
Queue/cache: Redis
LLM adapter: LiteLLM sidecar first
Observability: OpenTelemetry
Testing: Vitest + Playwright for console smoke tests
```

## 3. Monorepo Layout

```txt
fountlayer/
├── apps/
│   ├── gateway/
│   ├── console/
│   ├── worker/
│   └── demo-pdf-reader/
├── packages/
│   ├── sdk-js/
│   ├── sdk-react/
│   ├── protocol/
│   ├── pricing/
│   ├── ledger/
│   ├── adapter-litellm/
│   ├── adapter-local/
│   ├── adapter-openmeter/
│   └── adapter-lago/
├── docs/
├── infra/
└── examples/
```

## 4. Environment Variables

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/fountlayer
REDIS_URL=redis://localhost:6379
GATEWAY_BASE_URL=http://localhost:8787
LITELLM_BASE_URL=http://localhost:4000
LITELLM_MASTER_KEY=change_me
FOUNTLAYER_JWT_SECRET=change_me
ENCRYPTION_MASTER_KEY=change_me_32_bytes
```

Never commit real keys. `.env.example` must use placeholders only.

## 5. First Development Sequence

### Task 1 - Repo bootstrap

- Create pnpm monorepo.
- Add `apps/gateway`, `apps/console`, `apps/worker`, `packages/sdk-js`, `packages/protocol`, `packages/pricing`, `packages/ledger`.
- Add Docker Compose with Postgres, Redis, and LiteLLM sidecar.
- Add `.env.example`.
- Add README and docs.

Definition of Done:

- `pnpm install` works.
- `docker compose up -d` starts Postgres, Redis, LiteLLM.
- `pnpm test` runs an empty test suite successfully.

### Task 2 - Protocol and types

Create shared TypeScript types:

```ts
export type FountLayerMode = "managed" | "developer_key" | "byok" | "local";

export interface AttributionContext {
  appId: string;
  channelId: string;
  endUserId: string;
  useCase: string;
  mode: FountLayerMode;
}

export interface ChatRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
  }>;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}
```

Definition of Done:

- Gateway and SDK import shared types from `packages/protocol`.
- API docs match these types.

### Task 3 - Database migrations

Create these tables first:

- developers
- apps
- channels
- end_users
- wallets
- faucet_grants
- model_prices
- usage_events
- ledger_entries
- provider_credentials
- routes
- pricing_policies

Use `docs/DATA_MODEL.sql` as the canonical reference.

Definition of Done:

- Migration runs against empty Postgres.
- Seed script creates one developer, one app, one channel, one model price, one faucet grant, one route.

### Task 4 - Gateway minimum API

Implement:

```txt
POST /v1/sessions
GET  /v1/balance
GET  /v1/faucet-grants
POST /v1/estimate
POST /v1/chat/completions
```

Definition of Done:

- All routes validate attribution headers.
- Missing `app_id` or `end_user_id` returns 400.
- Unknown app returns 403.
- `/v1/estimate` returns estimated upstream and retail cost.

### Task 5 - LiteLLM adapter

Implement `packages/adapter-litellm`:

```ts
export interface LLMAdapter {
  chat(input: AdapterChatInput): Promise<AdapterChatOutput>;
  streamChat(input: AdapterChatInput): AsyncIterable<AdapterChunk>;
}
```

Definition of Done:

- Gateway can forward a chat request to LiteLLM.
- Non-stream and stream both work.
- Adapter returns usage if provider returns usage.
- If provider does not return usage, estimate tokens and mark `usage_estimated = true`.

### Task 6 - Faucet engine

Implement grant matching:

```txt
active grant
AND remaining > 0
AND not expired
AND app/channel/end_user match
AND model allowed
AND use_case allowed
AND daily cap not exceeded
```

Definition of Done:

- User receives trial grant from seed data.
- First request consumes faucet grant.
- Request is blocked when grant is exhausted and wallet has no balance.
- Daily cap blocks excessive usage.

### Task 7 - Ledger engine

For every successful managed request:

```txt
Debit: end_user_wallet or faucet_wallet
Credit: platform_revenue_wallet
Debit: platform_cost_wallet
Credit: provider_payable_wallet
Credit: developer_margin_wallet if applicable
Credit: channel_commission_wallet if applicable
```

Definition of Done:

- Each usage event has balanced ledger entries.
- Ledger total debits equal total credits.
- Failed provider calls do not create billable usage events.
- Refund operation creates reversing entries instead of mutating history.

### Task 8 - SDK minimum

Implement:

```ts
createFountLayer();
startSession();
chat();
getBalance();
getEstimatedCost();
getAvailableFaucetGrants();
setLocalEndpoint();
setUserApiKey();
```

Definition of Done:

- Demo app can use the SDK without calling fetch manually.
- SDK supports browser and Node.
- SDK never stores provider keys unless BYOK local mode is explicitly called.

### Task 9 - Developer console minimum

Pages:

1. Overview
2. Apps
3. Channels
4. Routes
5. Credentials
6. Faucet
7. Pricing
8. Usage & Ledger

Definition of Done:

- Developer can create an app and channel.
- Developer can create a faucet grant.
- Developer can view usage and ledger records.
- Developer can configure a pricing policy.

### Task 10 - Demo PDF Reader

Build a demo app with:

- Document summary.
- Outline extraction.
- Document Q&A placeholder.
- Price estimate display.
- Faucet balance display.
- Mode switch: managed, BYOK, local.

Definition of Done:

- A new user can summarize text using managed mode and faucet credits.
- Console shows usage and ledger.
- User can switch to local OpenAI-compatible endpoint.

## 6. Testing Requirements

### Unit tests

- Pricing estimator.
- Faucet grant matcher.
- Ledger balancing.
- Attribution validator.
- Route resolver.

### Integration tests

- Managed request with faucet grant.
- Managed request with wallet balance.
- Insufficient balance blocks before provider call.
- BYOK local-only path.
- Local endpoint path.

### Security tests

- Provider keys are redacted in logs.
- `.env` is not committed.
- API rejects requests without attribution.
- Anonymous managed requests are rate-limited.

## 7. Pull Request Rules

Every PR must include:

```txt
What changed:
Why it changed:
How to test:
Security impact:
Ledger impact:
Screenshots if console UI changed:
```

Do not merge a PR that changes pricing or ledger logic without tests.

## 8. First Release Checklist

- Docker Compose works on a clean machine.
- README quickstart works.
- Demo app can run.
- Managed, BYOK, Local modes exist.
- Faucet credits work.
- Ledger balances.
- Provider keys do not leak.
- Whitepaper and security docs are included.
- License is chosen.
- GitHub repository has issue templates.
