import { describe, expect, it } from "vitest";

import {
  buildAtomicFaucetDeductionStatement,
  calculateDailyGrantUsage,
  deductFaucetGrant,
  findMatchingFaucetGrant,
  type FaucetGrantRecord,
} from "./src/index";

const attribution = {
  appId: "app_pdf_reader",
  channelId: "channel_desktop",
  endUserId: "user_hash_123",
  useCase: "paper_summary",
  mode: "managed" as const,
};

const activeGrant: FaucetGrantRecord = {
  id: "grant_new_user",
  appId: "app_pdf_reader",
  channelId: "channel_desktop",
  endUserId: "user_hash_123",
  remaining: "1.00000000",
  allowedModels: ["vertical/paper-summary"],
  allowedUseCases: ["paper_summary"],
  dailyCap: "0.25000000",
  expiresAt: "2026-07-17T00:00:00Z",
  status: "active",
};

describe("faucet grant matcher", () => {
  it("matches an active grant with balance, allowlists, daily cap, and expiration", () => {
    const match = findMatchingFaucetGrant({
      grants: [activeGrant],
      attribution,
      model: "vertical/paper-summary",
      requestedAmount: "0.01000000",
      now: new Date("2026-06-17T00:00:00Z"),
    });

    expect(match).toEqual({
      matched: true,
      grant: activeGrant,
    });
  });

  it("rejects expired grants", () => {
    const match = findMatchingFaucetGrant({
      grants: [
        {
          ...activeGrant,
          expiresAt: "2026-06-16T00:00:00Z",
        },
      ],
      attribution,
      model: "vertical/paper-summary",
      requestedAmount: "0.01000000",
      now: new Date("2026-06-17T00:00:00Z"),
    });

    expect(match).toMatchObject({
      matched: false,
      reasons: ["expired"],
    });
  });

  it("rejects model allowlist mismatches", () => {
    const match = findMatchingFaucetGrant({
      grants: [activeGrant],
      attribution,
      model: "smart/default",
      requestedAmount: "0.01000000",
      now: new Date("2026-06-17T00:00:00Z"),
    });

    expect(match).toMatchObject({
      matched: false,
      reasons: ["model_not_allowed"],
    });
  });

  it("rejects use-case allowlist mismatches", () => {
    const match = findMatchingFaucetGrant({
      grants: [activeGrant],
      attribution: {
        ...attribution,
        useCase: "chat",
      },
      model: "vertical/paper-summary",
      requestedAmount: "0.01000000",
      now: new Date("2026-06-17T00:00:00Z"),
    });

    expect(match).toMatchObject({
      matched: false,
      reasons: ["use_case_not_allowed"],
    });
  });

  it("rejects requests that exceed the daily cap", () => {
    const match = findMatchingFaucetGrant({
      grants: [activeGrant],
      attribution,
      model: "vertical/paper-summary",
      requestedAmount: "0.01000000",
      dailyUsageByGrantId: new Map([["grant_new_user", "0.24500000"]]),
      now: new Date("2026-06-17T00:00:00Z"),
    });

    expect(match).toMatchObject({
      matched: false,
      reasons: ["daily_cap_exceeded"],
    });
  });
});

describe("faucet daily usage and deduction", () => {
  it("calculates successful same-day usage for a grant", () => {
    expect(
      calculateDailyGrantUsage(
        [
          {
            faucetGrantId: "grant_new_user",
            amount: "0.01000000",
            createdAt: "2026-06-17T01:00:00Z",
            status: "success",
          },
          {
            faucetGrantId: "grant_new_user",
            amount: "0.02000000",
            createdAt: "2026-06-17T02:00:00Z",
            status: "success",
          },
          {
            faucetGrantId: "grant_new_user",
            amount: "0.05000000",
            createdAt: "2026-06-17T03:00:00Z",
            status: "refunded",
          },
        ],
        "grant_new_user",
        new Date("2026-06-17T12:00:00Z"),
      ),
    ).toBe("0.03000000");
  });

  it("deducts from remaining balance without mutating the source grant", () => {
    const updated = deductFaucetGrant(activeGrant, "0.12500000");

    expect(activeGrant.remaining).toBe("1.00000000");
    expect(updated.remaining).toBe("0.87500000");
  });

  it("emits an atomic SQL deduction statement with balance, status, and expiration guards", () => {
    const statement = buildAtomicFaucetDeductionStatement(
      "grant_new_user",
      "0.01000000",
      new Date("2026-06-17T00:00:00Z"),
    );

    expect(statement.sql).toContain("remaining_numeric >= $2");
    expect(statement.sql).toContain("status = 'active'");
    expect(statement.sql).toContain("expires_at > $3");
    expect(statement.parameters).toEqual([
      "grant_new_user",
      "0.01000000",
      "2026-06-17T00:00:00.000Z",
    ]);
  });
});
