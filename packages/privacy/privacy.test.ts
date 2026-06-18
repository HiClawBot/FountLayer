import { describe, expect, it } from "vitest";

import {
  createDeletedEndUserId,
  createRequestMetadataRetentionWindow,
} from "./src/index";

describe("privacy helpers", () => {
  it("creates deterministic tombstone end-user ids without raw identifiers", () => {
    const tombstone = createDeletedEndUserId({
      appId: "app_pdf_reader",
      endUserId: "user_hash_123",
    });

    expect(tombstone).toMatch(/^deleted_user_[a-f0-9]{24}$/);
    expect(tombstone).toBe(
      createDeletedEndUserId({
        appId: "app_pdf_reader",
        endUserId: "user_hash_123",
      }),
    );
    expect(tombstone).not.toContain("user_hash_123");
  });

  it("creates request metadata retention cutoff windows", () => {
    const window = createRequestMetadataRetentionWindow({
      now: new Date("2026-06-18T12:00:00.000Z"),
      retentionDays: 7,
    });

    expect(window.cutoffIso).toBe("2026-06-11T12:00:00.000Z");
    expect(window.nowIso).toBe("2026-06-18T12:00:00.000Z");
    expect(window.retentionDays).toBe(7);
  });

  it("rejects invalid retention windows", () => {
    expect(() =>
      createRequestMetadataRetentionWindow({ retentionDays: -1 }),
    ).toThrow("retentionDays");
    expect(() =>
      createRequestMetadataRetentionWindow({ retentionDays: 3651 }),
    ).toThrow("retentionDays");
  });
});
