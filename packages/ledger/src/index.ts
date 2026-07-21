import type { AttributionContext, FountLayerMode } from "@fountlayer/protocol";
import { formatMoney, parseMoney } from "@fountlayer/money";

export type MoneyDirection = "debit" | "credit";

export type LedgerWallets = {
  payerWalletId: string;
  platformRevenueWalletId: string;
  platformCostWalletId: string;
  providerPayableWalletId: string;
  developerMarginWalletId?: string;
  channelCommissionWalletId?: string;
};

export type UsageEventInput = {
  id: string;
  requestId: string;
  attribution: AttributionContext;
  provider?: string;
  model: string;
  routeId?: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  usageEstimated?: boolean;
  upstreamCost: string;
  wholesalePrice: string;
  retailPrice: string;
  faucetGrantId?: string;
  status?: "success" | "failed" | "refunded";
  createdAt?: string;
};

export type UsageEventRecord = {
  id: string;
  requestId: string;
  appId: string;
  channelId: string;
  endUserId: string;
  mode: FountLayerMode;
  provider?: string;
  model: string;
  routeId?: string;
  useCase: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  usageEstimated: boolean;
  upstreamCost: string;
  wholesalePrice: string;
  retailPrice: string;
  faucetGrantId?: string;
  status: "success" | "failed" | "refunded";
  createdAt: string;
};

export type LedgerEntryInput = {
  id: string;
  usageEventId: string;
  walletId: string;
  direction: MoneyDirection;
  amount: string;
  reason: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type LedgerEntryRecord = Required<Omit<LedgerEntryInput, "metadata">> & {
  metadata: Record<string, unknown>;
};

export type BalancedLedgerInput = {
  usageEventId: string;
  wallets: LedgerWallets;
  upstreamCost: string;
  retailPrice: string;
  developerMargin?: string;
  channelCommission?: string;
  idPrefix?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

function entry(input: LedgerEntryInput): LedgerEntryRecord {
  return {
    id: input.id,
    usageEventId: input.usageEventId,
    walletId: input.walletId,
    direction: input.direction,
    amount: formatMoney(parseMoney(input.amount)),
    reason: input.reason,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function createUsageEvent(input: UsageEventInput): UsageEventRecord {
  return {
    id: input.id,
    requestId: input.requestId,
    appId: input.attribution.appId,
    channelId: input.attribution.channelId,
    endUserId: input.attribution.endUserId,
    mode: input.attribution.mode,
    provider: input.provider,
    model: input.model,
    routeId: input.routeId,
    useCase: input.attribution.useCase,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cachedInputTokens: input.cachedInputTokens ?? 0,
    usageEstimated: input.usageEstimated ?? false,
    upstreamCost: formatMoney(parseMoney(input.upstreamCost)),
    wholesalePrice: formatMoney(parseMoney(input.wholesalePrice)),
    retailPrice: formatMoney(parseMoney(input.retailPrice)),
    faucetGrantId: input.faucetGrantId,
    status: input.status ?? "success",
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function createBalancedLedgerEntries(
  input: BalancedLedgerInput,
): LedgerEntryRecord[] {
  const idPrefix = input.idPrefix ?? input.usageEventId;
  const createdAt = input.createdAt ?? new Date().toISOString();
  const upstreamCost = parseMoney(input.upstreamCost);
  const retailPrice = parseMoney(input.retailPrice);
  const developerMargin = parseMoney(input.developerMargin ?? "0");
  const channelCommission = parseMoney(input.channelCommission ?? "0");
  const platformRevenue = retailPrice - developerMargin - channelCommission;

  if (platformRevenue < 0n) {
    throw new Error(
      "Developer margin and channel commission exceed retail price.",
    );
  }

  const entries: LedgerEntryRecord[] = [
    entry({
      id: `${idPrefix}_payer_debit`,
      usageEventId: input.usageEventId,
      walletId: input.wallets.payerWalletId,
      direction: "debit",
      amount: formatMoney(retailPrice),
      reason: "retail_charge",
      metadata: input.metadata,
      createdAt,
    }),
    entry({
      id: `${idPrefix}_platform_revenue_credit`,
      usageEventId: input.usageEventId,
      walletId: input.wallets.platformRevenueWalletId,
      direction: "credit",
      amount: formatMoney(platformRevenue),
      reason: "platform_revenue",
      metadata: input.metadata,
      createdAt,
    }),
    entry({
      id: `${idPrefix}_platform_cost_debit`,
      usageEventId: input.usageEventId,
      walletId: input.wallets.platformCostWalletId,
      direction: "debit",
      amount: formatMoney(upstreamCost),
      reason: "provider_cost",
      metadata: input.metadata,
      createdAt,
    }),
    entry({
      id: `${idPrefix}_provider_payable_credit`,
      usageEventId: input.usageEventId,
      walletId: input.wallets.providerPayableWalletId,
      direction: "credit",
      amount: formatMoney(upstreamCost),
      reason: "provider_payable",
      metadata: input.metadata,
      createdAt,
    }),
  ];

  if (developerMargin > 0n) {
    if (!input.wallets.developerMarginWalletId) {
      throw new Error(
        "Developer margin wallet is required when margin is positive.",
      );
    }

    entries.push(
      entry({
        id: `${idPrefix}_developer_margin_credit`,
        usageEventId: input.usageEventId,
        walletId: input.wallets.developerMarginWalletId,
        direction: "credit",
        amount: formatMoney(developerMargin),
        reason: "developer_margin",
        metadata: input.metadata,
        createdAt,
      }),
    );
  }

  if (channelCommission > 0n) {
    if (!input.wallets.channelCommissionWalletId) {
      throw new Error(
        "Channel commission wallet is required when commission is positive.",
      );
    }

    entries.push(
      entry({
        id: `${idPrefix}_channel_commission_credit`,
        usageEventId: input.usageEventId,
        walletId: input.wallets.channelCommissionWalletId,
        direction: "credit",
        amount: formatMoney(channelCommission),
        reason: "channel_commission",
        metadata: input.metadata,
        createdAt,
      }),
    );
  }

  assertLedgerBalanced(entries);
  return entries.filter((ledgerEntry) => parseMoney(ledgerEntry.amount) > 0n);
}

export function assertLedgerBalanced(entries: LedgerEntryRecord[]): void {
  const debits = entries
    .filter((ledgerEntry) => ledgerEntry.direction === "debit")
    .reduce((sum, ledgerEntry) => sum + parseMoney(ledgerEntry.amount), 0n);
  const credits = entries
    .filter((ledgerEntry) => ledgerEntry.direction === "credit")
    .reduce((sum, ledgerEntry) => sum + parseMoney(ledgerEntry.amount), 0n);

  if (debits !== credits) {
    throw new Error(
      `Ledger entries are not balanced: debits=${formatMoney(
        debits,
      )} credits=${formatMoney(credits)}`,
    );
  }
}

export function createRefundReversalEntries(
  entries: LedgerEntryRecord[],
  options: {
    idPrefix?: string;
    createdAt?: string;
    reason?: string;
  } = {},
): LedgerEntryRecord[] {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const reason = options.reason ?? "refund_reversal";
  const reversed = entries.map((original, index) =>
    entry({
      id: `${options.idPrefix ?? original.usageEventId}_refund_${index + 1}`,
      usageEventId: original.usageEventId,
      walletId: original.walletId,
      direction: original.direction === "debit" ? "credit" : "debit",
      amount: original.amount,
      reason,
      metadata: {
        ...original.metadata,
        reversesLedgerEntryId: original.id,
      },
      createdAt,
    }),
  );

  assertLedgerBalanced(reversed);
  return reversed;
}
