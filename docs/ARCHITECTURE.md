# Architecture

FountLayer is divided into SDK, Gateway, Faucet Engine, Pricing Engine, Routing Engine, Adapter Layer, Usage Metering, Ledger, Console, and optional Billing integrations.

This document includes target-state components. The current external release contract is
defined by [`BETA_CAPABILITIES.md`](BETA_CAPABILITIES.md); a component shown here is not
necessarily wired into the stock beta runtime.

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
- `session_ticket_redemptions` stores one-way ticket-ID hashes so a signed
  five-minute bootstrap ticket can create at most one session.
- `rate_limit_counters` stores atomic session-creation and billable-request
  windows across Gateway instances.
- `idempotency_records` coordinate session-scoped billable requests; they store
  request hashes, leases, status, and usage references but no response bodies.
- `model_prices` are the source of truth for cost estimation.
- `pricing_policies` selected by each app are the source of truth for fee rates;
  developer/channel markups remain disabled until payout wallets exist.
- `fountlayer_schema_migrations` journals immutable migration filenames and
  SHA-256 checksums under an advisory lock.
- `faucet_grants` are the source of truth for free credits.
- Provider logs and SDK telemetry are not financial sources of truth.

## Request Lifecycle

1. A trusted application backend signs a five-minute ticket binding the full
   managed attribution context.
2. SDK derives attribution from the ticket; Gateway verifies and atomically
   redeems it while creating a session.
3. SDK sends chat request with attribution headers.
4. Gateway validates app, channel, end user, and mode.
5. Gateway validates the session token hash and checks that session attribution
   matches request attribution.
6. Gateway reserves an optional session-scoped idempotency key and consumes
   durable abuse counters.
7. Gateway snapshots the Store-backed model price and app pricing policy, then
   estimates request cost for route-cap and funding preflight.
8. Gateway checks that a faucet grant or test wallet can cover the estimate.
9. Gateway resolves the managed route to provider/model.
10. Adapter calls the configured LiteLLM/OpenAI-compatible upstream.
11. Gateway validates adapter token usage, recomputes the fixed-point final price,
    rechecks funding, and atomically records the usage event, balanced ledger
    entries, funding mutation, and idempotency completion.
12. If actual usage exceeds the available balance or route cap, Gateway deducts no
    user credits but records a failed usage event and balanced platform-cost/provider-
    payable entries before returning `402`.
13. Response returns usage and billing metadata.

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

Developer runs Gateway, Postgres, a LiteLLM sidecar, and Console. Redis remains an
optional development/future queue dependency and is not required by the narrow beta
runtime.
The beta Gateway selects one process-wide runtime adapter with
`FOUNTLAYER_GATEWAY_ADAPTER=demo|litellm|local`; route policies continue to
control the routed provider/model, allowlists, and spend caps.

## Observability

Gateway telemetry is metadata-only. Events may include app, channel, end-user
hash, use case, mode, route, provider, token counts, cost, latency, payment
source, and denial reason. Events must not include raw prompts, assistant
outputs, provider keys, session tokens, authorization headers, or raw adapter
payloads.

The observability package also provides metadata-only span and metric records.
Gateway emits spans for session creation, estimates, adapter calls, billing
writes, and chat requests, plus metrics for estimated tokens, chat tokens,
retail price, latency, denied requests, and adapter errors.
Telemetry delivery is best-effort; a sink failure cannot change request or
billing outcomes.

## Reliability

Gateway adapter calls may be wrapped with bounded retries and a circuit breaker.
Retries happen before usage events or ledger entries are written. When a circuit
is open, the Gateway rejects the request before adapter execution and before any
usage or ledger write.

`/health/dependencies` provides readiness checks for the active Store and the stock
runtime's authenticated adapter model probe. Failed
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
