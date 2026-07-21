# FountLayer External Beta Capability Matrix

Target: `v0.5.0-beta.2`

This file is the source of truth for what an external beta tester may rely on.
Architecture documents and construction plans can describe intended or experimental
capabilities, but they do not override this matrix.

## Release Contract

The first external beta is a self-hosted, single-operator, test-credit release. Its
only supported execution path is managed mode through one operator-configured
LiteLLM/OpenAI-compatible upstream. It is not a hosted service, payment product,
provider-key marketplace, or settlement system.

| Capability                                   | Beta status                    | Current contract                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Managed chat through LiteLLM                 | In scope                       | Runtime adapter selection exists. Production packaging and a real-upstream golden smoke must pass before release.                                                                 |
| Request attribution                          | In scope                       | Every request carries app, channel, end user, use case, and mode. Session tickets will bind these fields before external release.                                                 |
| Faucet-funded test credits                   | In scope                       | Successful calls create one usage event and balanced ledger entries. Credits have no cash value.                                                                                  |
| PostgreSQL persistence and idempotency       | In scope                       | Durable billable-call coordination exists. PostgreSQL concurrency and upgrade tests remain release gates.                                                                         |
| Operator Console                             | In scope behind authentication | The Console must stay private until operator authentication protects every page and Server Action. Static sample fallback is not authoritative runtime data.                      |
| JavaScript SDK                               | In scope after packaging       | The workspace SDK supports sessions and non-streaming chat. An external package/tarball install test is required before release.                                                  |
| Plain-text document demo                     | In scope                       | The demo accepts text/Markdown and exercises the managed non-streaming path.                                                                                                      |
| PDF extraction                               | Planned before release         | The current binary `File.text()` behavior is not PDF extraction and is not exposed as a supported upload path.                                                                    |
| Actual-usage monetary calculation            | Planned before release         | Token counts come from the adapter, but monetary amounts currently originate from a pre-call estimate. Beta release requires actual-usage settlement with fixed-point arithmetic. |
| BYOK execution                               | Experimental, unavailable      | SDK helpers store a key locally, but the stock request path does not use it to select or authenticate an upstream. No provider key may be uploaded from a browser.                |
| Local/LAN execution                          | Experimental, unavailable      | SDK helpers store a validated local endpoint, but the stock browser request path does not route to it.                                                                            |
| Developer-key execution                      | Experimental, unavailable      | Protocol and credential foundations exist; no public end-to-end beta contract is offered.                                                                                         |
| Streaming chat                               | Experimental, unavailable      | Adapters can parse SSE, but the stock Gateway returns JSON for chat requests. Use non-streaming `chat()` only.                                                                    |
| Stored credential routing and rotation       | Experimental                   | AES-GCM storage/admin metadata exists. The stock route does not load stored credentials, and production key-rotation drills are pending.                                          |
| Route fallback models and credential budgets | Experimental                   | Records can be stored, but the runtime does not execute fallback models or enforce credential budgets.                                                                            |
| Wallet funding                               | Test-only foundation           | Wallet deduction and ledger helpers exist. Deposits, custody, payments, withdrawals, tax, KYC, and payouts are outside beta.                                                      |
| Settlement exports and Worker                | Non-critical foundation        | Deterministic exports and an in-memory queue exist. They must not carry production settlement obligations.                                                                        |
| Production Docker/Compose install            | Planned before release         | Current Compose files start dependencies only. Gateway, Console, and demo application images are a release gate.                                                                  |

## Public Claims Rule

- `In scope` means the capability must pass the documented external golden path and
  release gates.
- `Experimental` means implementation foundations may exist, but users must not depend
  on the capability or see it as a default product choice.
- `Unavailable` means the public UI and quickstart must not imply that the path works.
- Historical release notes remain historical records; they should not be read as the
  current support contract.

## External Beta Golden Path

1. A trusted application backend obtains or mints an app-scoped, short-lived session
   ticket.
2. A browser starts a managed session and submits bounded text extracted from a real
   document.
3. The configured upstream returns a non-streaming completion and actual token usage.
4. FountLayer atomically records one usage event and balanced ledger entries using
   fixed-point, actual-usage pricing.
5. An authenticated operator verifies the same attribution, usage, and ledger facts in
   the Console.

If any step uses the demo adapter, static sample records, estimated settlement, or an
unauthenticated control plane, the external beta gate has not passed.
