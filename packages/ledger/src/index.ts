import type { AttributionContext, FountLayerMode } from "@fountlayer/protocol";

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

function decimal(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid non-negative ledger amount: ${value}`);
  }

  return parsed;
}

function money(value: number): string {
  return Math.max(0, value).toFixed(8);
}

function entry(input: LedgerEntryInput): LedgerEntryRecord {
  return {
    id: input.id,
    usageEventId: input.usageEventId,
    walletId: input.walletId,
    direction: input.direction,
    amount: money(decimal(input.amount)),
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
    upstreamCost: money(decimal(input.upstreamCost)),
    wholesalePrice: money(decimal(input.wholesalePrice)),
    retailPrice: money(decimal(input.retailPrice)),
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
  const upstreamCost = decimal(input.upstreamCost);
  const retailPrice = decimal(input.retailPrice);
  const developerMargin = decimal(input.developerMargin ?? "0");
  const channelCommission = decimal(input.channelCommission ?? "0");
  const platformRevenue = retailPrice - developerMargin - channelCommission;

  if (platformRevenue < 0) {
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
      amount: money(retailPrice),
      reason: "retail_charge",
      metadata: input.metadata,
      createdAt,
    }),
    entry({
      id: `${idPrefix}_platform_revenue_credit`,
      usageEventId: input.usageEventId,
      walletId: input.wallets.platformRevenueWalletId,
      direction: "credit",
      amount: money(platformRevenue),
      reason: "platform_revenue",
      metadata: input.metadata,
      createdAt,
    }),
    entry({
      id: `${idPrefix}_platform_cost_debit`,
      usageEventId: input.usageEventId,
      walletId: input.wallets.platformCostWalletId,
      direction: "debit",
      amount: money(upstreamCost),
      reason: "provider_cost",
      metadata: input.metadata,
      createdAt,
    }),
    entry({
      id: `${idPrefix}_provider_payable_credit`,
      usageEventId: input.usageEventId,
      walletId: input.wallets.providerPayableWalletId,
      direction: "credit",
      amount: money(upstreamCost),
      reason: "provider_payable",
      metadata: input.metadata,
      createdAt,
    }),
  ];

  if (developerMargin > 0) {
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
        amount: money(developerMargin),
        reason: "developer_margin",
        metadata: input.metadata,
        createdAt,
      }),
    );
  }

  if (channelCommission > 0) {
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
        amount: money(channelCommission),
        reason: "channel_commission",
        metadata: input.metadata,
        createdAt,
      }),
    );
  }

  assertLedgerBalanced(entries);
  return entries.filter((ledgerEntry) => decimal(ledgerEntry.amount) > 0);
}

export function assertLedgerBalanced(entries: LedgerEntryRecord[]): void {
  const debits = entries
    .filter((ledgerEntry) => ledgerEntry.direction === "debit")
    .reduce((sum, ledgerEntry) => sum + decimal(ledgerEntry.amount), 0);
  const credits = entries
    .filter((ledgerEntry) => ledgerEntry.direction === "credit")
    .reduce((sum, ledgerEntry) => sum + decimal(ledgerEntry.amount), 0);

  if (money(debits) !== money(credits)) {
    throw new Error(
      `Ledger entries are not balanced: debits=${money(debits)} credits=${money(
        credits,
      )}`,
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
