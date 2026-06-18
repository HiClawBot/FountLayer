import { describe, expect, it } from "vitest";

import {
  InMemoryJobQueue,
  createFountLayerWorker,
  describeWorker,
  settlementExportJobType,
  type SettlementExportJobResult,
} from "./src/index";

const entries = [
  {
    amount: "0.00340000",
    createdAt: "2026-06-18T00:00:01.000Z",
    direction: "debit" as const,
    id: "le_1",
    reason: "retail_charge",
    usageEventId: "ue_1",
    walletId: "wallet_user_demo",
  },
  {
    amount: "0.00340000",
    createdAt: "2026-06-18T00:00:01.000Z",
    direction: "credit" as const,
    id: "le_2",
    reason: "platform_revenue",
    usageEventId: "ue_1",
    walletId: "wallet_platform_revenue",
  },
];

describe("worker jobs", () => {
  it("runs settlement export jobs through the in-memory queue", async () => {
    const worker = createFountLayerWorker();

    worker.enqueue({
      id: "job_settlement_1",
      payload: {
        entries,
        period: {
          start: "2026-06-18T00:00:00.000Z",
          end: "2026-06-19T00:00:00.000Z",
        },
      },
      type: settlementExportJobType,
    });

    const drained = await worker.drain({
      now: "2026-06-18T01:00:00.000Z",
    });
    const job = worker.getJob("job_settlement_1");
    const result = job?.result as SettlementExportJobResult | undefined;

    expect(describeWorker()).toContain("async jobs");
    expect(drained).toEqual({
      failed: 0,
      processed: 1,
      succeeded: 1,
    });
    expect(job?.status).toBe("succeeded");
    expect(job?.attempts).toBe(1);
    expect(result?.report.balanced).toBe(true);
    expect(result?.contentHash).toHaveLength(64);
    expect(result?.csv).toContain('"entry_id","created_at","usage_event_id"');
  });

  it("records generic job failures without leaking thrown details", async () => {
    const queue = new InMemoryJobQueue();

    queue.registerHandler("failing.export", async () => {
      throw new Error("provider-secret-placeholder should not leak");
    });
    queue.enqueue({
      id: "job_failure_1",
      payload: {},
      type: "failing.export",
    });

    const drained = await queue.drain();
    const job = queue.getJob("job_failure_1");

    expect(drained).toEqual({
      failed: 1,
      processed: 1,
      succeeded: 0,
    });
    expect(job?.status).toBe("failed");
    expect(job?.error).toBe("job_failed");
    expect(JSON.stringify(job)).not.toContain("provider-secret-placeholder");
  });
});
