# Architecture

FountLayer is divided into SDK, Gateway, Faucet Engine, Pricing Engine, Routing Engine, Adapter Layer, Usage Metering, Ledger, Console, and optional Billing integrations.

## Component Diagram

```txt
App / Plugin / SaaS
  ↓
SDK / Widget
  ↓
Gateway API
  ↓
Auth + Attribution
  ↓
Faucet + Budget Guard
  ↓
Route Resolver
  ↓
LLM Adapter Layer
  ├── LiteLLM Adapter
  ├── Developer Credential Adapter
  ├── BYOK Adapter
  └── Local OpenAI-Compatible Adapter
  ↓
Usage Events
  ↓
Ledger Entries
  ↓
Console / Worker / Optional Billing
```

## Source of Truth

- `usage_events` are the source of truth for token flow.
- `ledger_entries` are the source of truth for money flow.
- `sessions` are the source of truth for Gateway session auth; only token
  hashes are persisted.
- `model_prices` are the source of truth for cost estimation.
- `faucet_grants` are the source of truth for free credits.
- Provider logs and SDK telemetry are not financial sources of truth.

## Request Lifecycle

1. SDK creates or resumes a session.
2. SDK sends chat request with attribution headers.
3. Gateway validates app, channel, end user, and mode.
4. Gateway validates the session token hash and checks that session attribution
   matches request attribution.
5. Gateway estimates request cost.
6. Gateway chooses payment source: faucet grant, wallet, BYOK, or local.
7. Gateway resolves route to provider/model.
8. Adapter calls LiteLLM, developer credential, BYOK, or local endpoint.
9. Gateway records usage event.
10. Ledger engine records debits and credits.
11. Response returns usage and billing metadata.

## Routing Model

Logical model aliases decouple app code from provider details.

```yaml
routes:
  cheap/fast:
    adapter: litellm
    provider: litellm
    model: gpt-4.1-mini
    modelAllowlist: [gpt-4.1-mini]
    fallbackModels: [demo-local-model]
    maxRetailPrice: "0.05000000"
    latencyPreference: low
  vertical/paper-summary:
    adapter: local
    provider: demo
    model: demo-local-model
    modelAllowlist: [demo-local-model]
    fallbackModels: [demo-local-model]
    maxRetailPrice: "0.25000000"
    latencyPreference: balanced
```

## Deployment Modes

### Self-hosted

Developer runs Gateway, Postgres, Redis, LiteLLM sidecar, and Console.

## Observability

Gateway telemetry is metadata-only. Events may include app, channel, end-user
hash, use case, mode, route, provider, token counts, cost, latency, payment
source, and denial reason. Events must not include raw prompts, assistant
outputs, provider keys, session tokens, authorization headers, or raw adapter
payloads.

## Reliability

Gateway adapter calls may be wrapped with bounded retries and a circuit breaker.
Retries happen before usage events or ledger entries are written. When a circuit
is open, the Gateway rejects the request before adapter execution and before any
usage or ledger write.

`/health/dependencies` provides readiness checks for the active Store and any
deployment-injected dependencies such as Redis or adapter-side probes. Failed
checks return component status only and do not echo exception messages.

The Worker includes an in-memory queue abstraction and a `settlement.export`
handler that builds ledger-period reports and deterministic CSV exports. This is
the local foundation for later Redis- or database-backed async job execution.

## Privacy And Retention

FountLayer does not persist raw prompts or assistant outputs in the Gateway
billable loop. Request metadata retention controls clear ledger-entry metadata
after the configured window while keeping usage events and ledger amounts intact
for accounting. End-user anonymization replaces app-owned `end_user_id` values
with deterministic tombstone IDs, revokes sessions, active faucet grants, and
hosted end-user credentials, and scrubs ledger metadata without deleting usage
or money-movement facts.

### Managed cloud

FountLayer Cloud hosts Gateway, key pool, anti-abuse, billing, and settlement. SDK points to managed endpoint.

### Hybrid

Developer self-hosts Gateway but uses FountLayer Cloud for provider campaigns, billing, or settlement.
