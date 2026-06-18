import { createHash } from "node:crypto";

const dayMs = 24 * 60 * 60 * 1000;
const maxRetentionDays = 3650;

export type RequestMetadataRetentionWindow = {
  cutoff: Date;
  cutoffIso: string;
  nowIso: string;
  retentionDays: number;
};

export function createRequestMetadataRetentionWindow(input: {
  now?: Date;
  retentionDays: number;
}): RequestMetadataRetentionWindow {
  if (
    !Number.isInteger(input.retentionDays) ||
    input.retentionDays < 0 ||
    input.retentionDays > maxRetentionDays
  ) {
    throw new Error(
      `retentionDays must be an integer from 0 to ${maxRetentionDays}.`,
    );
  }

  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - input.retentionDays * dayMs);

  return {
    cutoff,
    cutoffIso: cutoff.toISOString(),
    nowIso: now.toISOString(),
    retentionDays: input.retentionDays,
  };
}

export function createDeletedEndUserId(input: {
  appId: string;
  endUserId: string;
}): string {
  if (input.appId.trim().length === 0 || input.endUserId.trim().length === 0) {
    throw new Error("appId and endUserId are required.");
  }

  const hash = createHash("sha256")
    .update("fountlayer:end-user-delete:v1")
    .update("\0")
    .update(input.appId)
    .update("\0")
    .update(input.endUserId)
    .digest("hex")
    .slice(0, 24);

  return `deleted_user_${hash}`;
}
