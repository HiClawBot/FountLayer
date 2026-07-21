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

| Capability                                   | Beta status                    | Current contract                                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Managed chat through LiteLLM                 | In scope                       | Runtime adapter selection, authenticated readiness, a 30-second default deadline, client-disconnect cancellation, and a real HTTP network-fixture smoke exist. A credentialed real-provider golden smoke must pass before release.                                                                        |
| Request attribution                          | In scope                       | A trusted backend signs a five-minute, single-use ticket binding app, channel, end user, use case, and managed mode. The SDK derives request attribution from that ticket.                                                                                                                                |
| Faucet-funded test credits                   | In scope                       | Successful calls create one usage event and balanced ledger entries. Credits have no cash value.                                                                                                                                                                                                          |
| PostgreSQL persistence and idempotency       | In scope                       | Checksum-journaled migrations, app-scoped relational constraints, durable ticket redemption, abuse counters, and billable-call coordination pass local PostgreSQL upgrade/restart tests.                                                                                                                  |
| Operator Console                             | In scope behind authentication | Every page is proxy-protected; runtime reads and Server Action mutations recheck an eight-hour operator session or automation bearer token. If the Gateway is unavailable, every runtime collection is empty and the Console displays a prominent unavailable state; it never substitutes sample records. |
| JavaScript SDK                               | In scope                       | The workspace SDK supports sessions and non-streaming chat. CI packs its protocol, ticket, and SDK tarballs and installs/imports them from a clean external consumer project.                                                                                                                             |
| Bounded document demo                        | In scope                       | The demo accepts text, Markdown, and PDFs up to 10 MB. PDF.js extracts at most 40 pages and 80,000 characters in the browser; only extracted text is sent when the user estimates or summarizes.                                                                                                          |
| Actual-usage monetary calculation            | In scope                       | Estimates are preflight only. Calls use validated actual usage and fixed-point Store prices; post-provider funding/cap failures record operator cost without charging users.                                                                                                                              |
| Developer/channel revenue share              | Unavailable                    | Both markup rates must remain zero. The Gateway rejects nonzero rates until payout wallets and settlement obligations are implemented.                                                                                                                                                                    |
| BYOK execution                               | Experimental, unavailable      | SDK helpers store a key locally, but the stock request path does not use it to select or authenticate an upstream. No provider key may be uploaded from a browser.                                                                                                                                        |
| Local/LAN execution                          | Experimental, unavailable      | SDK helpers store a validated local endpoint, but the stock browser request path does not route to it.                                                                                                                                                                                                    |
| Developer-key execution                      | Experimental, unavailable      | Protocol and credential foundations exist; no public end-to-end beta contract is offered.                                                                                                                                                                                                                 |
| Streaming chat                               | Experimental, unavailable      | Adapters can parse SSE, but the stock Gateway returns JSON for chat requests. Use non-streaming `chat()` only.                                                                                                                                                                                            |
| Stored credential routing and rotation       | Experimental                   | AES-GCM storage/admin metadata is explicitly app-scoped. The stock route does not load stored credentials, and production key-rotation drills are pending.                                                                                                                                                |
| Route fallback models and credential budgets | Experimental                   | Records can be stored, but the runtime does not execute fallback models or enforce credential budgets.                                                                                                                                                                                                    |
| Wallet funding                               | Test-only foundation           | Wallet deduction and ledger helpers exist. Deposits, custody, payments, withdrawals, tax, KYC, and payouts are outside beta.                                                                                                                                                                              |
| Settlement exports and Worker                | Non-critical foundation        | Deterministic exports and an in-memory queue exist. They must not carry production settlement obligations.                                                                                                                                                                                                |
| Production Docker/Compose install            | Implemented; CI gate pending   | A pinned, resource-bounded profile builds non-root Gateway, Console, and Demo images, runs migrations separately, and binds ports to loopback. Container build, SBOM, and image scans must be green on the release commit.                                                                                |

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
2. A browser locally extracts bounded text from a real PDF, starts a managed session,
   and submits only that text.
3. The configured upstream returns a non-streaming completion and actual token usage.
4. FountLayer atomically records one usage event and balanced ledger entries using
   fixed-point, actual-usage pricing.
5. An authenticated operator verifies the same attribution, usage, and ledger facts in
   the Console.

If any step uses the demo adapter, static sample records, estimated settlement, or an
unauthenticated control plane, the external beta gate has not passed.
