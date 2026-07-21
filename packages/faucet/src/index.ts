import type { AttributionContext } from "@fountlayer/protocol";
import { formatMoney, parseMoney } from "@fountlayer/money";

export type FaucetGrantStatus = "active" | "exhausted" | "expired" | "revoked";

export type FaucetGrantRecord = {
  id: string;
  appId: string;
  channelId?: string;
  endUserId?: string;
  remaining: string;
  allowedModels: string[];
  allowedUseCases: string[];
  dailyCap: string;
  expiresAt: string | Date;
  status: FaucetGrantStatus;
};

export type FaucetUsageRecord = {
  faucetGrantId: string;
  amount: string;
  createdAt: string | Date;
  status: "success" | "refunded";
};

export type FaucetGrantMatchInput = {
  grants: FaucetGrantRecord[];
  attribution: AttributionContext;
  model: string;
  requestedAmount: string;
  dailyUsageByGrantId?: Map<string, string>;
  now?: Date;
};

export type FaucetRejectionReason =
  | "not_active"
  | "no_balance"
  | "expired"
  | "scope_mismatch"
  | "model_not_allowed"
  | "use_case_not_allowed"
  | "daily_cap_exceeded"
  | "insufficient_remaining";

export type FaucetGrantMatch =
  | {
      matched: true;
      grant: FaucetGrantRecord;
    }
  | {
      matched: false;
      reasons: FaucetRejectionReason[];
    };

export type AtomicDeductionStatement = {
  sql: string;
  parameters: [grantId: string, amount: string, nowIso: string];
};

function utcDay(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

function scopeMatches(
  grant: FaucetGrantRecord,
  attribution: AttributionContext,
): boolean {
  return (
    grant.appId === attribution.appId &&
    (!grant.channelId || grant.channelId === attribution.channelId) &&
    (!grant.endUserId || grant.endUserId === attribution.endUserId)
  );
}

function collectRejectionReasons(
  grant: FaucetGrantRecord,
  input: Omit<FaucetGrantMatchInput, "grants"> & {
    now: Date;
    dailyUsageByGrantId: Map<string, string>;
  },
): FaucetRejectionReason[] {
  const reasons: FaucetRejectionReason[] = [];
  const remaining = parseMoney(grant.remaining);
  const requestedAmount = parseMoney(input.requestedAmount);
  const spentToday = parseMoney(input.dailyUsageByGrantId.get(grant.id) ?? "0");
  const dailyCap = parseMoney(grant.dailyCap);

  if (grant.status !== "active") {
    reasons.push("not_active");
  }

  if (remaining <= 0n) {
    reasons.push("no_balance");
  }

  if (new Date(grant.expiresAt).getTime() <= input.now.getTime()) {
    reasons.push("expired");
  }

  if (!scopeMatches(grant, input.attribution)) {
    reasons.push("scope_mismatch");
  }

  if (!grant.allowedModels.includes(input.model)) {
    reasons.push("model_not_allowed");
  }

  if (!grant.allowedUseCases.includes(input.attribution.useCase)) {
    reasons.push("use_case_not_allowed");
  }

  if (spentToday + requestedAmount > dailyCap) {
    reasons.push("daily_cap_exceeded");
  }

  if (requestedAmount > remaining) {
    reasons.push("insufficient_remaining");
  }

  return reasons;
}

export function findMatchingFaucetGrant(
  input: FaucetGrantMatchInput,
): FaucetGrantMatch {
  const now = input.now ?? new Date();
  const dailyUsageByGrantId =
    input.dailyUsageByGrantId ?? new Map<string, string>();
  const rejectionReasons = new Set<FaucetRejectionReason>();

  for (const grant of input.grants) {
    const reasons = collectRejectionReasons(grant, {
      attribution: input.attribution,
      model: input.model,
      requestedAmount: input.requestedAmount,
      now,
      dailyUsageByGrantId,
    });

    if (reasons.length === 0) {
      return {
        matched: true,
        grant,
      };
    }

    for (const reason of reasons) {
      rejectionReasons.add(reason);
    }
  }

  return {
    matched: false,
    reasons: [...rejectionReasons],
  };
}

export function calculateDailyGrantUsage(
  usageRecords: FaucetUsageRecord[],
  grantId: string,
  day: Date,
): string {
  const targetDay = utcDay(day);
  const total = usageRecords
    .filter(
      (record) =>
        record.faucetGrantId === grantId &&
        record.status === "success" &&
        utcDay(record.createdAt) === targetDay,
    )
    .reduce((sum, record) => sum + parseMoney(record.amount), 0n);

  return formatMoney(total);
}

export function deductFaucetGrant(
  grant: FaucetGrantRecord,
  amount: string,
): FaucetGrantRecord {
  const remaining = parseMoney(grant.remaining);
  const debit = parseMoney(amount);

  if (debit > remaining) {
    throw new Error(
      "Cannot deduct more than the faucet grant remaining balance.",
    );
  }

  return {
    ...grant,
    remaining: formatMoney(remaining - debit),
    status: remaining - debit === 0n ? "exhausted" : grant.status,
  };
}

export function buildAtomicFaucetDeductionStatement(
  grantId: string,
  amount: string,
  now: Date = new Date(),
): AtomicDeductionStatement {
  parseMoney(amount);

  return {
    sql: `
update faucet_grants
set
  remaining_numeric = remaining_numeric - $2,
  status = case
    when remaining_numeric - $2 = 0 then 'exhausted'
    else status
  end
where id = $1
  and status = 'active'
  and remaining_numeric >= $2
  and expires_at > $3
returning *;
`.trim(),
    parameters: [grantId, amount, now.toISOString()],
  };
}
