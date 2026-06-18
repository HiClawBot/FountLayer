import { createHash } from "node:crypto";

export type SettlementLedgerEntry = {
  amount: string;
  createdAt: string;
  direction: "debit" | "credit";
  id: string;
  reason: string;
  usageEventId?: string;
  walletId: string;
};

export type SettlementPeriod = {
  end: string;
  start: string;
};

export type WalletSettlementTotal = {
  credits: string;
  debits: string;
  net: string;
  walletId: string;
};

export type ReasonSettlementTotal = {
  amount: string;
  direction: "debit" | "credit";
  reason: string;
};

export type SettlementReport = {
  balanced: boolean;
  contentHash: string;
  entries: SettlementLedgerEntry[];
  period: SettlementPeriod;
  reasonTotals: ReasonSettlementTotal[];
  totalCredits: string;
  totalDebits: string;
  walletTotals: WalletSettlementTotal[];
};

const moneyScale = 100_000_000n;

function moneyToUnits(value: string): bigint {
  if (!/^\d+(?:\.\d{1,8})?$/.test(value)) {
    throw new Error(`Invalid settlement amount: ${value}`);
  }

  const [whole, fractional = ""] = value.split(".");

  if (!whole) {
    throw new Error(`Invalid settlement amount: ${value}`);
  }

  return BigInt(whole) * moneyScale + BigInt(fractional.padEnd(8, "0"));
}

function unitsToMoney(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / moneyScale;
  const fractional = (absolute % moneyScale).toString().padStart(8, "0");

  return `${sign}${whole}.${fractional}`;
}

function inPeriod(entry: SettlementLedgerEntry, period: SettlementPeriod) {
  const createdAt = Date.parse(entry.createdAt);

  return (
    createdAt >= Date.parse(period.start) && createdAt < Date.parse(period.end)
  );
}

function sortEntries(
  entries: SettlementLedgerEntry[],
): SettlementLedgerEntry[] {
  return [...entries].sort(
    (left, right) =>
      [
        left.createdAt.localeCompare(right.createdAt),
        left.walletId.localeCompare(right.walletId),
        left.reason.localeCompare(right.reason),
        left.id.localeCompare(right.id),
      ].find((comparison) => comparison !== 0) ?? 0,
  );
}

export function exportSettlementCsv(
  report: Omit<SettlementReport, "contentHash">,
): string {
  const rows = [
    [
      "entry_id",
      "created_at",
      "usage_event_id",
      "wallet_id",
      "direction",
      "amount",
      "reason",
    ],
    ...report.entries.map((entry) => [
      entry.id,
      entry.createdAt,
      entry.usageEventId ?? "",
      entry.walletId,
      entry.direction,
      entry.amount,
      entry.reason,
    ]),
  ];

  return `${rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n")}\n`;
}

export function hashSettlementCsv(csv: string): string {
  return createHash("sha256").update(csv).digest("hex");
}

export function createSettlementReport(input: {
  entries: SettlementLedgerEntry[];
  period: SettlementPeriod;
}): SettlementReport {
  const entries = sortEntries(
    input.entries.filter((entry) => inPeriod(entry, input.period)),
  );
  const walletUnits = new Map<string, { credits: bigint; debits: bigint }>();
  const reasonUnits = new Map<string, bigint>();
  let totalDebitUnits = 0n;
  let totalCreditUnits = 0n;

  for (const entry of entries) {
    const amount = moneyToUnits(entry.amount);
    const wallet = walletUnits.get(entry.walletId) ?? {
      credits: 0n,
      debits: 0n,
    };
    const reasonKey = `${entry.direction}:${entry.reason}`;

    if (entry.direction === "debit") {
      wallet.debits += amount;
      totalDebitUnits += amount;
    } else {
      wallet.credits += amount;
      totalCreditUnits += amount;
    }

    walletUnits.set(entry.walletId, wallet);
    reasonUnits.set(reasonKey, (reasonUnits.get(reasonKey) ?? 0n) + amount);
  }

  const reportWithoutHash = {
    balanced: totalDebitUnits === totalCreditUnits,
    entries,
    period: input.period,
    reasonTotals: [...reasonUnits.entries()]
      .map(([key, amount]) => {
        const [direction, reason] = key.split(":", 2) as [
          "debit" | "credit",
          string,
        ];

        return {
          amount: unitsToMoney(amount),
          direction,
          reason,
        };
      })
      .sort((left, right) =>
        `${left.direction}:${left.reason}`.localeCompare(
          `${right.direction}:${right.reason}`,
        ),
      ),
    totalCredits: unitsToMoney(totalCreditUnits),
    totalDebits: unitsToMoney(totalDebitUnits),
    walletTotals: [...walletUnits.entries()]
      .map(([walletId, totals]) => ({
        credits: unitsToMoney(totals.credits),
        debits: unitsToMoney(totals.debits),
        net: unitsToMoney(totals.credits - totals.debits),
        walletId,
      }))
      .sort((left, right) => left.walletId.localeCompare(right.walletId)),
  };
  const csv = exportSettlementCsv(reportWithoutHash);

  return {
    ...reportWithoutHash,
    contentHash: hashSettlementCsv(csv),
  };
}
