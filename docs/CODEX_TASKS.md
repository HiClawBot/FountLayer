# Codex Task Board

Use this file as the AI coding agent's task list. Implement tasks sequentially. Do not skip tests for pricing, ledger, or security-sensitive code.

## Epic 1 - Bootstrap

```txt
[ ] Create pnpm workspace.
[ ] Add TypeScript config shared by all packages.
[ ] Add lint, format, test commands.
[ ] Add Docker Compose for Postgres, Redis, LiteLLM.
[ ] Add .env.example.
[ ] Add initial README and docs links.
```

## Epic 2 - Protocol

```txt
[ ] Create packages/protocol.
[ ] Define AttributionContext.
[ ] Define ChatRequest/ChatResponse.
[ ] Define BillingMetadata.
[ ] Define FaucetGrant types.
[ ] Define UsageEvent and LedgerEntry types.
[ ] Export zod validators.
```

## Epic 3 - Database

```txt
[ ] Choose Prisma or Drizzle.
[ ] Translate docs/DATA_MODEL.sql into migrations.
[ ] Add seed data.
[ ] Add test database setup.
```

## Epic 4 - Gateway

```txt
[ ] Create apps/gateway.
[ ] Implement health check.
[ ] Implement attribution middleware.
[ ] Implement auth/session middleware.
[ ] Implement /v1/sessions.
[ ] Implement /v1/balance.
[ ] Implement /v1/faucet-grants.
[ ] Implement /v1/estimate.
[ ] Implement /v1/chat/completions.
```

## Epic 5 - Pricing

```txt
[ ] Create packages/pricing.
[ ] Implement token estimator placeholder.
[ ] Implement model price lookup.
[ ] Implement managed pricing formula.
[ ] Implement BYOK pricing formula.
[ ] Implement local pricing formula.
[ ] Add unit tests.
```

## Epic 6 - Faucet

```txt
[ ] Implement grant matcher.
[ ] Implement daily cap query.
[ ] Implement atomic grant deduction.
[ ] Add tests for expiration, model allowlist, use-case allowlist, daily cap.
```

## Epic 7 - Adapter Layer

```txt
[ ] Create adapter interface.
[ ] Implement LiteLLM adapter.
[ ] Implement local OpenAI-compatible adapter.
[ ] Add BYOK request path.
[ ] Add streaming support.
```

## Epic 8 - Ledger

```txt
[ ] Create packages/ledger.
[ ] Implement createUsageEvent.
[ ] Implement createBalancedLedgerEntries.
[ ] Implement refund reversal entries.
[ ] Add tests ensuring debits equal credits.
```

## Epic 9 - SDK

```txt
[ ] Create packages/sdk-js.
[ ] Implement createFountLayer.
[ ] Implement startSession.
[ ] Implement chat.
[ ] Implement streaming chat.
[ ] Implement getBalance.
[ ] Implement getEstimatedCost.
[ ] Implement getAvailableFaucetGrants.
[ ] Implement setUserApiKey local-only storage.
[ ] Implement setLocalEndpoint.
```

## Epic 10 - Console

```txt
[ ] Create apps/console.
[ ] Add Overview page.
[ ] Add Apps page.
[ ] Add Channels page.
[ ] Add Routes page.
[ ] Add Faucet page.
[ ] Add Pricing page.
[ ] Add Usage & Ledger page.
```

## Epic 11 - Demo PDF Reader

```txt
[ ] Create apps/demo-pdf-reader.
[ ] Integrate SDK.
[ ] Add text/PDF input.
[ ] Add summary button.
[ ] Add price estimate.
[ ] Add faucet balance.
[ ] Add mode switch.
```

## Epic 12 - Release

```txt
[ ] Verify clean Docker Compose setup.
[ ] Run tests.
[ ] Run secret scan.
[ ] Update README.
[ ] Add LICENSE.
[ ] Add GitHub issue templates.
[ ] Tag pre-release.
```
