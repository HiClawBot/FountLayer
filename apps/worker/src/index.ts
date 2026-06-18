import {
  createSettlementReport,
  exportSettlementCsv,
  type SettlementLedgerEntry,
  type SettlementPeriod,
  type SettlementReport,
} from "@fountlayer/settlement";

export const workerAppName = "fountlayer-worker";
export const settlementExportJobType = "settlement.export";

export type WorkerJobStatus = "failed" | "queued" | "running" | "succeeded";

export type WorkerJobRecord<
  TPayload = unknown,
  TResult = unknown,
  TType extends string = string,
> = {
  attempts: number;
  createdAt: string;
  error?: string;
  id: string;
  payload: TPayload;
  result?: TResult;
  status: WorkerJobStatus;
  type: TType;
  updatedAt: string;
};

export type WorkerJobHandler<TPayload = unknown, TResult = unknown> = (
  payload: TPayload,
) => Promise<TResult> | TResult;

export type SettlementExportJobPayload = {
  entries: SettlementLedgerEntry[];
  period: SettlementPeriod;
};

export type SettlementExportJobResult = {
  contentHash: string;
  csv: string;
  report: SettlementReport;
};

export function describeWorker(): string {
  return "FountLayer Worker for settlement and async jobs.";
}

export class InMemoryJobQueue {
  private readonly handlers = new Map<string, WorkerJobHandler>();
  private readonly jobs: WorkerJobRecord[] = [];

  enqueue<TPayload, TType extends string = string>(input: {
    createdAt?: string;
    id: string;
    payload: TPayload;
    type: TType;
  }): WorkerJobRecord<TPayload, unknown, TType> {
    const now = input.createdAt ?? new Date().toISOString();
    const job: WorkerJobRecord<TPayload, unknown, TType> = {
      attempts: 0,
      createdAt: now,
      id: input.id,
      payload: input.payload,
      status: "queued",
      type: input.type,
      updatedAt: now,
    };

    this.jobs.push(job as WorkerJobRecord);
    return job;
  }

  getJob(id: string): WorkerJobRecord | undefined {
    return this.jobs.find((job) => job.id === id);
  }

  listJobs(): WorkerJobRecord[] {
    return [...this.jobs];
  }

  registerHandler<TPayload, TResult>(
    type: string,
    handler: WorkerJobHandler<TPayload, TResult>,
  ): void {
    this.handlers.set(type, handler as WorkerJobHandler);
  }

  async drain(input: { maxJobs?: number; now?: string } = {}): Promise<{
    failed: number;
    processed: number;
    succeeded: number;
  }> {
    const maxJobs = input.maxJobs ?? Number.POSITIVE_INFINITY;
    const queuedJobs = this.jobs
      .filter((job) => job.status === "queued")
      .slice(0, maxJobs);
    let failed = 0;
    let succeeded = 0;

    for (const job of queuedJobs) {
      const handler = this.handlers.get(job.type);

      job.attempts += 1;
      job.status = "running";
      job.updatedAt = input.now ?? new Date().toISOString();

      try {
        if (!handler) {
          throw new Error("No handler registered.");
        }

        job.result = await handler(job.payload);
        job.status = "succeeded";
        job.error = undefined;
        succeeded += 1;
      } catch {
        job.status = "failed";
        job.error = "job_failed";
        failed += 1;
      } finally {
        job.updatedAt = input.now ?? new Date().toISOString();
      }
    }

    return {
      failed,
      processed: queuedJobs.length,
      succeeded,
    };
  }
}

export function createSettlementExportJobHandler(): WorkerJobHandler<
  SettlementExportJobPayload,
  SettlementExportJobResult
> {
  return (payload) => {
    const report = createSettlementReport(payload);
    const csv = exportSettlementCsv(report);

    return {
      contentHash: report.contentHash,
      csv,
      report,
    };
  };
}

export function createFountLayerWorker(): InMemoryJobQueue {
  const queue = new InMemoryJobQueue();

  queue.registerHandler(
    settlementExportJobType,
    createSettlementExportJobHandler(),
  );

  return queue;
}
