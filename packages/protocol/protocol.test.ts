import { describe, expect, it } from "vitest";

import {
  attributionContextSchema,
  chatRequestSchema,
  faucetGrantSchema,
  ledgerEntrySchema,
  parseAttributionHeaders,
} from "./src/index";

describe("protocol attribution validation", () => {
  it("accepts the required request attribution fields", () => {
    expect(
      attributionContextSchema.parse({
        appId: "app_pdf_reader",
        channelId: "channel_desktop",
        endUserId: "user_hash_123",
        useCase: "paper_summary",
        mode: "managed",
      }),
    ).toEqual({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endUserId: "user_hash_123",
      useCase: "paper_summary",
      mode: "managed",
    });
  });

  it("rejects requests missing channel or use-case attribution", () => {
    expect(() =>
      attributionContextSchema.parse({
        appId: "app_pdf_reader",
        endUserId: "user_hash_123",
        mode: "managed",
      }),
    ).toThrow();
  });

  it("parses case-insensitive gateway attribution headers", () => {
    expect(
      parseAttributionHeaders({
        "X-FL-App-ID": "app_pdf_reader",
        "x-fl-channel-id": "channel_desktop",
        "x-fl-end-user-id": "user_hash_123",
        "x-fl-use-case": "paper_summary",
        "x-fl-mode": "local",
      }),
    ).toEqual({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endUserId: "user_hash_123",
      useCase: "paper_summary",
      mode: "local",
    });
  });
});

describe("protocol request and billing records", () => {
  it("requires a model and at least one chat message", () => {
    expect(() =>
      chatRequestSchema.parse({
        model: "vertical/paper-summary",
        messages: [],
      }),
    ).toThrow();
  });

  it("requires faucet controls for balance, allowlists, daily cap, and expiration", () => {
    const grant = faucetGrantSchema.parse({
      id: "grant_new_user",
      sponsorType: "platform",
      appId: "app_pdf_reader",
      amount: "1.00000000",
      remaining: "1.00000000",
      allowedModels: ["vertical/paper-summary"],
      allowedUseCases: ["paper_summary"],
      dailyCap: "0.25000000",
      expiresAt: "2026-06-18T00:00:00Z",
    });

    expect(grant.remaining).toBe("1.00000000");
    expect(grant.allowedModels).toEqual(["vertical/paper-summary"]);
    expect(grant.allowedUseCases).toEqual(["paper_summary"]);
    expect(grant.dailyCap).toBe("0.25000000");
  });

  it("rejects ledger entries without a debit or credit direction", () => {
    expect(() =>
      ledgerEntrySchema.parse({
        id: "le_123",
        walletId: "wallet_platform",
        direction: "increase",
        amount: "0.01000000",
        reason: "platform_fee",
      }),
    ).toThrow();
  });
});
