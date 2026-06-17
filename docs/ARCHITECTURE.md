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
    candidates:
      - provider: litellm
        model: gpt-4.1-mini
        weight: 100
  vertical/paper-summary:
    candidates:
      - provider: litellm
        model: gpt-4.1
        weight: 60
      - provider: litellm
        model: claude-sonnet
        weight: 40
    fallback:
      - provider: litellm
        model: gpt-4.1-mini
```

## Deployment Modes

### Self-hosted

Developer runs Gateway, Postgres, Redis, LiteLLM sidecar, and Console.

### Managed cloud

FountLayer Cloud hosts Gateway, key pool, anti-abuse, billing, and settlement. SDK points to managed endpoint.

### Hybrid

Developer self-hosts Gateway but uses FountLayer Cloud for provider campaigns, billing, or settlement.
