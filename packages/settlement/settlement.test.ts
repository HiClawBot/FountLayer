import { describe, expect, it } from "vitest";

import {
  createSettlementReport,
  exportSettlementCsv,
  hashSettlementCsv,
  type SettlementLedgerEntry,
} from "./src/index";

const entries: SettlementLedgerEntry[] = [
  {
    amount: "0.00340000",
    createdAt: "2026-06-18T00:00:01.000Z",
    direction: "debit",
    id: "le_1",
    reason: "retail_charge",
    usageEventId: "ue_1",
    walletId: "wallet_user_demo",
  },
  {
    amount: "0.00340000",
    createdAt: "2026-06-18T00:00:01.000Z",
    direction: "credit",
    id: "le_2",
    reason: "platform_revenue",
    usageEventId: "ue_1",
    walletId: "wallet_platform_revenue",
  },
  {
    amount: "0.00210000",
    createdAt: "2026-06-18T00:00:01.000Z",
    direction: "debit",
    id: "le_3",
    reason: "provider_cost",
    usageEventId: "ue_1",
    walletId: "wallet_platform_cost",
  },
  {
    amount: "0.00210000",
    createdAt: "2026-06-18T00:00:01.000Z",
    direction: "credit",
    id: "le_4",
    reason: "provider_payable",
    usageEventId: "ue_1",
    walletId: "wallet_provider_payable",
  },
  {
    amount: "9.00000000",
    createdAt: "2026-06-19T00:00:00.000Z",
    direction: "debit",
    id: "le_outside",
    reason: "outside_period",
    walletId: "wallet_user_demo",
  },
];

describe("settlement reports", () => {
  it("creates balanced period reports from ledger entries", () => {
    const report = createSettlementReport({
      entries,
      period: {
        start: "2026-06-18T00:00:00.000Z",
        end: "2026-06-19T00:00:00.000Z",
      },
    });

    expect(report.balanced).toBe(true);
    expect(report.entries).toHaveLength(4);
    expect(report.totalDebits).toBe("0.00550000");
    expect(report.totalCredits).toBe("0.00550000");
    expect(report.walletTotals).toEqual(
      expect.arrayContaining([
        {
          credits: "0.00000000",
          debits: "0.00340000",
          net: "-0.00340000",
          walletId: "wallet_user_demo",
        },
      ]),
    );
    expect(report.contentHash).toHaveLength(64);
  });

  it("exports deterministic CSV with a matching content hash", () => {
    const forwardReport = createSettlementReport({
      entries,
      period: {
        start: "2026-06-18T00:00:00.000Z",
        end: "2026-06-19T00:00:00.000Z",
      },
    });
    const report = createSettlementReport({
      entries: [...entries].reverse(),
      period: {
        start: "2026-06-18T00:00:00.000Z",
        end: "2026-06-19T00:00:00.000Z",
      },
    });
    const csv = exportSettlementCsv(report);

    expect(csv).toContain('"entry_id","created_at","usage_event_id"');
    expect(csv).toBe(exportSettlementCsv(forwardReport));
    expect(hashSettlementCsv(csv)).toBe(report.contentHash);
  });

  it("marks unbalanced reports explicitly", () => {
    const report = createSettlementReport({
      entries: entries.slice(0, 1),
      period: {
        start: "2026-06-18T00:00:00.000Z",
        end: "2026-06-19T00:00:00.000Z",
      },
    });

    expect(report.balanced).toBe(false);
    expect(report.totalDebits).toBe("0.00340000");
    expect(report.totalCredits).toBe("0.00000000");
  });
});
