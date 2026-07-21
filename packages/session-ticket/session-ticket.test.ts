import { describe, expect, it } from "vitest";

import {
  createSessionTicket,
  decodeSessionTicket,
  sessionTicketPrefix,
  sessionTicketTtlSeconds,
  verifySessionTicket,
} from "./src/index";

const secret = "session-ticket-test-secret-with-32-characters";
const attribution = {
  appId: "app_test",
  channelId: "channel_web",
  endUserId: "user_hash_test",
  mode: "managed" as const,
  useCase: "paper_summary",
};
const now = Date.UTC(2026, 6, 21, 12, 0, 0);

describe("session tickets", () => {
  it("signs and verifies a bounded app-scoped ticket", async () => {
    const ticket = await createSessionTicket({
      attribution,
      nowMs: now,
      secret,
      ticketId: "ticket_test_identifier",
    });

    expect(ticket).toMatch(new RegExp(`^${sessionTicketPrefix}\\.`));
    await expect(
      verifySessionTicket({ nowMs: now, secret, ticket }),
    ).resolves.toEqual({
      claims: {
        attribution,
        aud: "fountlayer-session",
        exp: Math.floor(now / 1000) + sessionTicketTtlSeconds,
        iat: Math.floor(now / 1000),
        jti: "ticket_test_identifier",
        v: 1,
      },
      valid: true,
    });
    expect(decodeSessionTicket(ticket).attribution).toEqual(attribution);
  });

  it("rejects tampered, expired, and wrong-secret tickets", async () => {
    const ticket = await createSessionTicket({
      attribution,
      nowMs: now,
      secret,
    });

    await expect(
      verifySessionTicket({ nowMs: now, secret, ticket: `${ticket}tampered` }),
    ).resolves.toEqual({ reason: "invalid", valid: false });
    await expect(
      verifySessionTicket({
        nowMs: now,
        secret: `${secret}-wrong`,
        ticket,
      }),
    ).resolves.toEqual({ reason: "invalid", valid: false });
    await expect(
      verifySessionTicket({
        nowMs: now + (sessionTicketTtlSeconds + 1) * 1000,
        secret,
        ticket,
      }),
    ).resolves.toEqual({ reason: "expired", valid: false });
  });

  it("rejects weak secrets and oversized lifetimes", async () => {
    await expect(
      createSessionTicket({ attribution, secret: "too-short" }),
    ).rejects.toThrow("at least 32 characters");
    await expect(
      createSessionTicket({
        attribution,
        secret,
        ttlSeconds: sessionTicketTtlSeconds + 1,
      }),
    ).rejects.toThrow("TTL must be between");
  });
});
