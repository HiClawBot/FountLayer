import { describe, expect, it } from "vitest";

import {
  assertLedgerBalanced,
  createBalancedLedgerEntries,
  createRefundReversalEntries,
  createUsageEvent,
} from "./src/index";

const attribution = {
  appId: "app_pdf_reader",
  channelId: "channel_desktop",
  endUserId: "user_hash_123",
  useCase: "paper_summary",
  mode: "managed" as const,
};

const wallets = {
  payerWalletId: "wallet_faucet_new_user",
  platformRevenueWalletId: "wallet_platform_revenue",
  platformCostWalletId: "wallet_platform_cost",
  providerPayableWalletId: "wallet_provider_payable",
  developerMarginWalletId: "wallet_developer_margin",
  channelCommissionWalletId: "wallet_channel_commission",
};

describe("usage events", () => {
  it("creates one usage event from required attribution", () => {
    expect(
      createUsageEvent({
        id: "ue_1",
        requestId: "req_1",
        attribution,
        provider: "demo",
        model: "demo-local-model",
        routeId: "route_paper_summary",
        inputTokens: 10,
        outputTokens: 5,
        upstreamCost: "0.00100000",
        wholesalePrice: "0.00133000",
        retailPrice: "0.00133000",
        faucetGrantId: "grant_new_user",
        createdAt: "2026-06-17T00:00:00.000Z",
      }),
    ).toMatchObject({
      id: "ue_1",
      requestId: "req_1",
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endUserId: "user_hash_123",
      useCase: "paper_summary",
      status: "success",
    });
  });
});

describe("balanced ledger entries", () => {
  it("balances payer debit, platform revenue, platform cost, and provider payable", () => {
    const entries = createBalancedLedgerEntries({
      usageEventId: "ue_1",
      wallets,
      upstreamCost: "0.00100000",
      retailPrice: "0.00133000",
      createdAt: "2026-06-17T00:00:00.000Z",
    });

    expect(entries).toHaveLength(4);
    expect(() => assertLedgerBalanced(entries)).not.toThrow();
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          walletId: "wallet_faucet_new_user",
          direction: "debit",
          amount: "0.00133000",
          reason: "retail_charge",
        }),
        expect.objectContaining({
          walletId: "wallet_provider_payable",
          direction: "credit",
          amount: "0.00100000",
          reason: "provider_payable",
        }),
      ]),
    );
  });

  it("includes developer margin and channel commission credits", () => {
    const entries = createBalancedLedgerEntries({
      usageEventId: "ue_2",
      wallets,
      upstreamCost: "0.00100000",
      retailPrice: "0.00200000",
      developerMargin: "0.00030000",
      channelCommission: "0.00020000",
    });

    expect(() => assertLedgerBalanced(entries)).not.toThrow();
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          walletId: "wallet_developer_margin",
          direction: "credit",
          amount: "0.00030000",
          reason: "developer_margin",
        }),
        expect.objectContaining({
          walletId: "wallet_channel_commission",
          direction: "credit",
          amount: "0.00020000",
          reason: "channel_commission",
        }),
      ]),
    );
  });

  it("throws when entries are not balanced", () => {
    expect(() =>
      assertLedgerBalanced([
        {
          id: "le_1",
          usageEventId: "ue_1",
          walletId: "wallet_a",
          direction: "debit",
          amount: "1.00000000",
          reason: "test",
          metadata: {},
          createdAt: "2026-06-17T00:00:00.000Z",
        },
      ]),
    ).toThrow("not balanced");
  });
});

describe("refund reversals", () => {
  it("creates balanced reversal entries without mutating original history", () => {
    const entries = createBalancedLedgerEntries({
      usageEventId: "ue_refund",
      wallets,
      upstreamCost: "0.00100000",
      retailPrice: "0.00133000",
    });
    const reversals = createRefundReversalEntries(entries, {
      idPrefix: "ue_refund",
      createdAt: "2026-06-18T00:00:00.000Z",
    });

    expect(reversals).toHaveLength(entries.length);
    expect(() => assertLedgerBalanced(reversals)).not.toThrow();
    expect(reversals[0]).toMatchObject({
      direction: entries[0]?.direction === "debit" ? "credit" : "debit",
      amount: entries[0]?.amount,
      reason: "refund_reversal",
      metadata: {
        reversesLedgerEntryId: entries[0]?.id,
      },
    });
  });
});
