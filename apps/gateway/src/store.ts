import {
  calculateDailyGrantUsage,
  findMatchingFaucetGrant,
  type FaucetRejectionReason,
} from "@fountlayer/faucet";
import type { FountLayerSql, FountLayerTransactionSql } from "@fountlayer/db";
import type { LedgerEntryRecord, UsageEventRecord } from "@fountlayer/ledger";
import {
  compareMoney,
  formatFixed,
  parseFixed,
  rateScale,
  subtractMoney,
} from "@fountlayer/money";
import {
  defaultPricingPolicy as defaultRuntimePricingPolicy,
  demoModelPrices,
  type ModelPrice,
  type PricingPolicy,
} from "@fountlayer/pricing";
import {
  createDeletedEndUserId,
  createRequestMetadataRetentionWindow,
} from "@fountlayer/privacy";
import type { AttributionContext } from "@fountlayer/protocol";

export type GatewayAppRecord = {
  defaultPricingPolicyId?: string;
  id: string;
  status: "active" | "disabled";
  defaultRouteId?: string;
};

export type GatewayChannelRecord = {
  id: string;
  appId: string;
  status: "active" | "disabled";
};

export type GatewayAdminAppRecord = {
  id: string;
  name: string;
  developer: string;
  status: string;
  defaultRoute: string;
};

export type GatewayAdminAppCreateInput = {
  defaultPricingPolicyId?: string;
  defaultRouteId?: string;
  developerId: string;
  developerName: string;
  id: string;
  name: string;
  status: "active" | "disabled";
};

export type GatewayAdminAppUpdateInput = {
  defaultPricingPolicyId?: string;
  defaultRouteId?: string;
  name?: string;
  status?: "active" | "disabled";
};

export type GatewayAdminChannelRecord = {
  id: string;
  appId: string;
  name: string;
  type: string;
  status: string;
};

export type GatewayAdminChannelCreateInput = {
  appId: string;
  id: string;
  name: string;
  status: "active" | "disabled";
  type: string;
};

export type GatewayAdminChannelUpdateInput = {
  name?: string;
  status?: "active" | "disabled";
  type?: string;
};

export type GatewayAdminRouteRecord = {
  appId: string;
  id: string;
  alias: string;
  provider: string;
  model: string;
  adapter: string;
  status: string;
};

export type GatewayAdminRouteCreateInput = {
  adapter: string;
  alias: string;
  appId: string;
  fallbackModels?: string[];
  id: string;
  latencyPreference?: string;
  maxRetailPrice?: string;
  model: string;
  modelAllowlist: string[];
  provider: string;
  status: "active" | "disabled";
};

export type GatewayAdminRouteUpdateInput = {
  adapter?: string;
  alias?: string;
  appId?: string;
  fallbackModels?: string[];
  latencyPreference?: string;
  maxRetailPrice?: string;
  model?: string;
  modelAllowlist?: string[];
  provider?: string;
  status?: "active" | "disabled";
};

export type GatewayRoutePolicyRecord = {
  adapter: string;
  alias: string;
  appId: string;
  fallbackModels: string[];
  id: string;
  latencyPreference?: string;
  maxRetailPrice?: string;
  model: string;
  modelAllowlist: string[];
  provider: string;
  status: "active" | "disabled";
};

export type GatewayAdminCredentialRecord = {
  appId: string;
  id: string;
  owner: string;
  provider: string;
  storage: string;
  status: string;
  display: string;
};

export type GatewayProviderCredentialRecord = {
  appId: string;
  id: string;
  ownerType: string;
  ownerId: string;
  provider: string;
  encryptedApiKey: string;
  keyVersion: string;
  display: string;
  status: "active" | "revoked";
  budgetDaily?: string;
  budgetMonthly?: string;
  createdAt: string;
  updatedAt?: string;
};

export type GatewayProviderCredentialWriteInput = {
  appId: string;
  budgetDaily?: string;
  budgetMonthly?: string;
  display: string;
  encryptedApiKey: string;
  id: string;
  keyVersion: string;
  ownerId: string;
  ownerType: string;
  provider: string;
};

export type GatewayProviderCredentialRotateInput = {
  display: string;
  encryptedApiKey: string;
  id: string;
  keyVersion: string;
};

export type GatewayAdminPricingPolicyRecord = {
  id: string;
  appId: string;
  platformFeeRate: string;
  paymentFeeReserveRate: string;
  riskReserveRate: string;
  developerMarkupRate: string;
  channelMarkupRate: string;
  maxTotalMarkupRate: string;
};

export type GatewayAdminPricingPolicyCreateInput = {
  appId: string;
  channelMarkupRate: string;
  developerMarkupRate: string;
  id: string;
  maxTotalMarkupRate: string;
  name: string;
  paymentFeeReserveRate: string;
  platformFeeRate: string;
  riskReserveRate: string;
};

export type GatewayAdminPricingPolicyUpdateInput = {
  appId?: string;
  channelMarkupRate?: string;
  developerMarkupRate?: string;
  maxTotalMarkupRate?: string;
  name?: string;
  paymentFeeReserveRate?: string;
  platformFeeRate?: string;
  riskReserveRate?: string;
};

export type GatewayGrantRecord = {
  id: string;
  appId: string;
  channelId: string;
  endUserId: string;
  walletId: string;
  remaining: string;
  allowedModels: string[];
  allowedUseCases: string[];
  dailyCap: string;
  expiresAt: string;
  status: "active" | "exhausted" | "expired" | "revoked";
};

export type GatewayFaucetGrantCreateInput = {
  allowedModels: string[];
  allowedUseCases: string[];
  amount: string;
  appId: string;
  channelId: string;
  dailyCap: string;
  endUserId: string;
  expiresAt: string;
  id: string;
  remaining: string;
  sponsorId?: string;
  sponsorType: string;
  status: "active" | "exhausted" | "expired" | "revoked";
  walletId: string;
};

export type GatewayFaucetGrantUpdateInput = {
  allowedModels?: string[];
  allowedUseCases?: string[];
  amount?: string;
  dailyCap?: string;
  expiresAt?: string;
  remaining?: string;
  status?: "active" | "exhausted" | "expired" | "revoked";
};

export type GatewayWalletRecord = {
  appId: string;
  id: string;
  ownerType: string;
  ownerId: string;
  balance: string;
  currency: string;
};

export type GatewaySessionRecord = {
  id: string;
  tokenHash: string;
  attribution: AttributionContext;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
};

export type GatewaySessionTicketRedemptionResult =
  | {
      session: GatewaySessionRecord;
      status: "created";
    }
  | {
      status: "replayed";
    };

export type GatewayRateLimitScope = "end_user" | "session" | "session_creation";

export type GatewayRateLimitDecision =
  | {
      allowed: true;
      remaining: number;
      resetAt: string;
    }
  | {
      allowed: false;
      limit: number;
      remaining: 0;
      resetAt: string;
      scope: GatewayRateLimitScope;
    };

export type GatewayGrantMatch =
  | {
      matched: true;
      grant: GatewayGrantRecord;
    }
  | {
      matched: false;
      reasons: FaucetRejectionReason[];
    };

export type GatewayWalletMatch =
  | {
      matched: true;
      wallet: GatewayWalletRecord;
    }
  | {
      matched: false;
      reason: "wallet_not_found" | "insufficient_wallet_balance";
    };

export type GatewayIdempotencyReservation = {
  idempotencyKey: string;
  lockedUntil: string;
  requestHash: string;
  reservationId: string;
  sessionId: string;
};

export type GatewayIdempotencyBeginResult =
  | { status: "acquired" }
  | { status: "in_progress" }
  | { status: "conflict" }
  | { status: "completed"; usageEventId: string };

export type GatewayIdempotencyRecord = GatewayIdempotencyReservation & {
  completedAt?: string;
  createdAt: string;
  status: "completed" | "processing";
  usageEventId?: string;
};

export type BillableCallRecord = {
  grantId: string;
  amount: string;
  usageEvent: UsageEventRecord;
  ledgerEntries: LedgerEntryRecord[];
  idempotency?: GatewayIdempotencyReservation;
  now?: Date;
};

export type ProviderCostCallRecord = Pick<
  BillableCallRecord,
  "idempotency" | "ledgerEntries" | "usageEvent"
>;

export type BillableCallRecordResult = {
  usageEvent: UsageEventRecord;
  ledgerEntries: LedgerEntryRecord[];
  updatedGrant: GatewayGrantRecord;
};

export type WalletBillableCallRecordResult = {
  usageEvent: UsageEventRecord;
  ledgerEntries: LedgerEntryRecord[];
  updatedWallet: GatewayWalletRecord;
};

export type RequestMetadataPurgeResult = {
  cutoff: string;
  ledgerEntriesUpdated: number;
  retentionDays: number;
};

export type EndUserAnonymizationResult = {
  appId: string;
  endUserRecordsDeleted: number;
  faucetGrantsAnonymized: number;
  faucetGrantsRevoked: number;
  ledgerEntriesScrubbed: number;
  providerCredentialsRevoked: number;
  sessionsRevoked: number;
  tombstoneEndUserId: string;
  usageEventsAnonymized: number;
  walletsAnonymized: number;
};

export type GatewayStoreHealth = {
  component: "memory" | "postgres";
  status: "ok";
};

export type GatewayStore = {
  healthCheck(): Promise<GatewayStoreHealth>;
  redeemSessionTicket(input: {
    id: string;
    tokenHash: string;
    ticketExpiresAt: string;
    ticketIdHash: string;
    attribution: AttributionContext;
    expiresAt: string;
    createdAt?: string;
  }): Promise<GatewaySessionTicketRedemptionResult>;
  consumeRateLimit(input: {
    keyHash: string;
    limit: number;
    now?: Date;
    scope: GatewayRateLimitScope;
    windowMs: number;
  }): Promise<GatewayRateLimitDecision>;
  getActiveSessionByTokenHash(
    tokenHash: string,
    now?: Date,
  ): Promise<GatewaySessionRecord | undefined>;
  revokeSession(
    id: string,
    now?: Date,
  ): Promise<GatewaySessionRecord | undefined>;
  getActiveApp(id: string): Promise<GatewayAppRecord | undefined>;
  getActiveChannel(
    appId: string,
    channelId: string,
  ): Promise<GatewayChannelRecord | undefined>;
  getRoutePolicy(
    appId: string,
    alias: string,
  ): Promise<GatewayRoutePolicyRecord | undefined>;
  getModelPrice(
    provider: string,
    model: string,
    at?: Date,
  ): Promise<ModelPrice | undefined>;
  getPricingPolicy(appId: string): Promise<PricingPolicy | undefined>;
  listActiveGrants(
    attribution: AttributionContext,
    model?: string,
  ): Promise<GatewayGrantRecord[]>;
  findPayingGrant(input: {
    attribution: AttributionContext;
    model: string;
    requestedAmount: string;
    now?: Date;
  }): Promise<GatewayGrantMatch>;
  findPayingWallet(input: {
    attribution: AttributionContext;
    requestedAmount: string;
  }): Promise<GatewayWalletMatch>;
  beginIdempotentRequest(
    input: GatewayIdempotencyReservation & { now?: Date },
  ): Promise<GatewayIdempotencyBeginResult>;
  releaseIdempotentRequest(
    input: Pick<
      GatewayIdempotencyReservation,
      "idempotencyKey" | "reservationId" | "sessionId"
    >,
  ): Promise<void>;
  getWallet(
    attribution: AttributionContext,
  ): Promise<GatewayWalletRecord | undefined>;
  recordBillableCall(
    input: BillableCallRecord,
  ): Promise<BillableCallRecordResult>;
  recordProviderCostCall(input: ProviderCostCallRecord): Promise<void>;
  recordWalletBillableCall(
    input: Omit<BillableCallRecord, "grantId"> & { walletId: string },
  ): Promise<WalletBillableCallRecordResult>;
  listApps(): Promise<GatewayAdminAppRecord[]>;
  createApp(input: GatewayAdminAppCreateInput): Promise<GatewayAdminAppRecord>;
  updateApp(
    id: string,
    input: GatewayAdminAppUpdateInput,
  ): Promise<GatewayAdminAppRecord | undefined>;
  listChannels(): Promise<GatewayAdminChannelRecord[]>;
  createChannel(
    input: GatewayAdminChannelCreateInput,
  ): Promise<GatewayAdminChannelRecord>;
  updateChannel(
    id: string,
    input: GatewayAdminChannelUpdateInput,
  ): Promise<GatewayAdminChannelRecord | undefined>;
  listFaucetGrants(): Promise<GatewayGrantRecord[]>;
  createFaucetGrant(
    input: GatewayFaucetGrantCreateInput,
  ): Promise<GatewayGrantRecord>;
  updateFaucetGrant(
    id: string,
    input: GatewayFaucetGrantUpdateInput,
  ): Promise<GatewayGrantRecord | undefined>;
  listRoutes(): Promise<GatewayAdminRouteRecord[]>;
  createRoute(
    input: GatewayAdminRouteCreateInput,
  ): Promise<GatewayAdminRouteRecord>;
  updateRoute(
    id: string,
    input: GatewayAdminRouteUpdateInput,
  ): Promise<GatewayAdminRouteRecord | undefined>;
  listProviderCredentials(): Promise<GatewayAdminCredentialRecord[]>;
  createProviderCredential(
    input: GatewayProviderCredentialWriteInput,
  ): Promise<GatewayAdminCredentialRecord>;
  rotateProviderCredential(
    input: GatewayProviderCredentialRotateInput,
  ): Promise<GatewayAdminCredentialRecord | undefined>;
  deleteProviderCredential(id: string): Promise<boolean>;
  listPricingPolicies(): Promise<GatewayAdminPricingPolicyRecord[]>;
  createPricingPolicy(
    input: GatewayAdminPricingPolicyCreateInput,
  ): Promise<GatewayAdminPricingPolicyRecord>;
  updatePricingPolicy(
    id: string,
    input: GatewayAdminPricingPolicyUpdateInput,
  ): Promise<GatewayAdminPricingPolicyRecord | undefined>;
  listUsageEvents(): Promise<UsageEventRecord[]>;
  listLedgerEntries(): Promise<LedgerEntryRecord[]>;
  purgeExpiredRequestMetadata(input: {
    now?: Date;
    retentionDays: number;
  }): Promise<RequestMetadataPurgeResult>;
  anonymizeEndUser(input: {
    appId: string;
    endUserId: string;
    now?: Date;
  }): Promise<EndUserAnonymizationResult>;
};

export type InMemoryGatewayState = {
  adminApps: Map<string, GatewayAdminAppRecord>;
  adminChannels: Map<string, GatewayAdminChannelRecord>;
  apps: Map<string, GatewayAppRecord>;
  channels: Map<string, GatewayChannelRecord>;
  faucetGrants: GatewayGrantRecord[];
  idempotencyRecords: Map<string, GatewayIdempotencyRecord>;
  modelPrices: ModelPrice[];
  pricingPolicyConfigs: Map<string, PricingPolicy>;
  rateLimitCounters: Map<
    string,
    { count: number; resetAt: string; scope: GatewayRateLimitScope }
  >;
  pricingPolicies: GatewayAdminPricingPolicyRecord[];
  providerCredentials: GatewayProviderCredentialRecord[];
  routePolicies: GatewayRoutePolicyRecord[];
  sessionTicketRedemptions: Map<string, string>;
  wallets: Map<string, GatewayWalletRecord>;
  usageEvents: UsageEventRecord[];
  ledgerEntries: LedgerEntryRecord[];
  sessions: GatewaySessionRecord[];
};

type GrantRow = {
  id: string;
  app_id: string;
  channel_id: string;
  end_user_id: string;
  wallet_id: string;
  remaining: string;
  allowed_models: unknown;
  allowed_use_cases: unknown;
  daily_cap: string;
  expires_at: string | Date;
  status: GatewayGrantRecord["status"];
};

type UsageEventRow = {
  id: string;
  request_id: string;
  app_id: string;
  channel_id: string;
  end_user_id: string;
  mode: UsageEventRecord["mode"];
  provider: string | null;
  model: string;
  route_id: string | null;
  use_case: string;
  input_tokens: number | null;
  output_tokens: number | null;
  cached_input_tokens: number | null;
  usage_estimated: boolean | null;
  upstream_cost: string;
  wholesale_price: string;
  retail_price: string;
  faucet_grant_id: string | null;
  status: UsageEventRecord["status"];
  created_at: string | Date;
};

type LedgerEntryRow = {
  id: string;
  usage_event_id: string;
  wallet_id: string;
  direction: LedgerEntryRecord["direction"];
  amount: string;
  reason: string;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
};

type SessionRow = {
  id: string;
  app_id: string;
  channel_id: string;
  end_user_id: string;
  use_case: string;
  mode: AttributionContext["mode"];
  token_hash: string;
  expires_at: string | Date;
  revoked_at: string | Date | null;
  created_at: string | Date;
};

type RateLimitRow = {
  count: number;
  reset_at: string | Date;
};

type WalletRow = {
  app_id: string;
  id: string;
  owner_type: string;
  owner_id: string;
  currency: string;
  balance: string;
};

type IdempotencyRow = {
  completed_at: string | Date | null;
  created_at: string | Date;
  idempotency_key: string;
  locked_until: string | Date;
  request_hash: string;
  reservation_id: string;
  session_id: string;
  status: GatewayIdempotencyRecord["status"];
  usage_event_id: string | null;
};

type AdminAppRow = {
  id: string;
  name: string;
  developer: string;
  status: string;
  default_route: string | null;
};

type AdminChannelRow = {
  id: string;
  app_id: string;
  name: string;
  type: string;
  status: string;
};

type AdminRouteRow = {
  app_id: string;
  id: string;
  alias: string;
  config: Record<string, unknown>;
  status: string;
};

type AdminCredentialRow = {
  app_id: string;
  display: string;
  encrypted_api_key: string;
  id: string;
  key_version: string;
  owner_type: string;
  owner_id: string;
  provider: string;
  budget_daily: string | null;
  budget_monthly: string | null;
  status: string;
};

type AdminPricingPolicyRow = {
  id: string;
  app_id: string | null;
  platform_fee_rate: string;
  payment_fee_reserve_rate: string;
  risk_reserve_rate: string;
  developer_markup_rate: string;
  channel_markup_rate: string;
  max_total_markup_rate: string;
};

type JsonValue =
  | null
  | string
  | number
  | boolean
  | Date
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue | undefined };

const defaultApp: GatewayAppRecord = {
  defaultPricingPolicyId: "policy_default",
  id: "app_pdf_reader",
  status: "active",
  defaultRouteId: "route_paper_summary",
};

const defaultChannel: GatewayChannelRecord = {
  id: "channel_desktop",
  appId: "app_pdf_reader",
  status: "active",
};

const defaultAdminApp: GatewayAdminAppRecord = {
  id: "app_pdf_reader",
  name: "PDF Reader Demo",
  developer: "Demo Developer",
  status: "active",
  defaultRoute: "vertical/paper-summary",
};

const defaultAdminChannel: GatewayAdminChannelRecord = {
  id: "channel_desktop",
  appId: "app_pdf_reader",
  name: "Desktop App",
  type: "direct",
  status: "active",
};

const defaultRoutePolicy: GatewayRoutePolicyRecord = {
  adapter: "local",
  alias: "vertical/paper-summary",
  appId: "app_pdf_reader",
  fallbackModels: ["demo-local-model"],
  id: "route_paper_summary",
  latencyPreference: "balanced",
  maxRetailPrice: "0.25000000",
  model: "demo-local-model",
  modelAllowlist: ["demo-local-model"],
  provider: "demo",
  status: "active",
};

const defaultCredential: GatewayAdminCredentialRecord = {
  appId: "app_pdf_reader",
  id: "cred_local_placeholder",
  owner: "self-hosted gateway",
  provider: "demo",
  storage: "server-side encrypted",
  status: "placeholder",
  display: "not configured",
};

const defaultPricingPolicy: GatewayAdminPricingPolicyRecord = {
  id: "policy_default",
  appId: "app_pdf_reader",
  platformFeeRate: "25%",
  paymentFeeReserveRate: "3%",
  riskReserveRate: "5%",
  developerMarkupRate: "0%",
  channelMarkupRate: "0%",
  maxTotalMarkupRate: "100%",
};

const defaultGrantLifetimeMs = 30 * 24 * 60 * 60 * 1000;

const defaultGrant: Omit<GatewayGrantRecord, "expiresAt"> = {
  id: "grant_new_user",
  appId: "app_pdf_reader",
  channelId: "channel_desktop",
  endUserId: "user_hash_123",
  walletId: "wallet_faucet_new_user",
  remaining: "1.00000000",
  allowedModels: ["vertical/paper-summary", "demo-local-model"],
  allowedUseCases: ["paper_summary"],
  dailyCap: "0.25000000",
  status: "active",
};

const defaultUserWallet: GatewayWalletRecord = {
  appId: "app_pdf_reader",
  id: "wallet_user_demo",
  ownerType: "end_user",
  ownerId: "user_hash_123",
  balance: "0.00000000",
  currency: "USD",
};

export function createDefaultInMemoryGatewayState(
  now = new Date(),
): InMemoryGatewayState {
  return {
    adminApps: new Map([[defaultAdminApp.id, { ...defaultAdminApp }]]),
    adminChannels: new Map([
      [defaultAdminChannel.id, { ...defaultAdminChannel }],
    ]),
    apps: new Map([[defaultApp.id, { ...defaultApp }]]),
    channels: new Map([[defaultChannel.id, { ...defaultChannel }]]),
    faucetGrants: [
      {
        ...defaultGrant,
        allowedModels: [...defaultGrant.allowedModels],
        allowedUseCases: [...defaultGrant.allowedUseCases],
        expiresAt: new Date(
          now.getTime() + defaultGrantLifetimeMs,
        ).toISOString(),
      },
    ],
    idempotencyRecords: new Map(),
    modelPrices: demoModelPrices.map((price) => ({ ...price })),
    pricingPolicyConfigs: new Map([
      ["policy_default", { ...defaultRuntimePricingPolicy }],
    ]),
    rateLimitCounters: new Map(),
    pricingPolicies: [{ ...defaultPricingPolicy }],
    providerCredentials: [],
    routePolicies: [
      {
        ...defaultRoutePolicy,
        fallbackModels: [...defaultRoutePolicy.fallbackModels],
        modelAllowlist: [...defaultRoutePolicy.modelAllowlist],
      },
    ],
    sessionTicketRedemptions: new Map(),
    wallets: new Map([[defaultUserWallet.id, { ...defaultUserWallet }]]),
    usageEvents: [],
    ledgerEntries: [],
    sessions: [],
  };
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function utcDayBounds(now: Date): {
  start: Date;
  end: Date;
} {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toJsonValue(value: Record<string, unknown>): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function mapGrantRow(row: GrantRow): GatewayGrantRecord {
  return {
    id: row.id,
    appId: row.app_id,
    channelId: row.channel_id,
    endUserId: row.end_user_id,
    walletId: row.wallet_id,
    remaining: row.remaining,
    allowedModels: asStringArray(row.allowed_models),
    allowedUseCases: asStringArray(row.allowed_use_cases),
    dailyCap: row.daily_cap,
    expiresAt: toIso(row.expires_at),
    status: row.status,
  };
}

function mapUsageEventRow(row: UsageEventRow): UsageEventRecord {
  return {
    id: row.id,
    requestId: row.request_id,
    appId: row.app_id,
    channelId: row.channel_id,
    endUserId: row.end_user_id,
    mode: row.mode,
    provider: row.provider ?? undefined,
    model: row.model,
    routeId: row.route_id ?? undefined,
    useCase: row.use_case,
    inputTokens: row.input_tokens ?? 0,
    outputTokens: row.output_tokens ?? 0,
    cachedInputTokens: row.cached_input_tokens ?? 0,
    usageEstimated: row.usage_estimated ?? false,
    upstreamCost: row.upstream_cost,
    wholesalePrice: row.wholesale_price,
    retailPrice: row.retail_price,
    faucetGrantId: row.faucet_grant_id ?? undefined,
    status: row.status,
    createdAt: toIso(row.created_at),
  };
}

function mapLedgerEntryRow(row: LedgerEntryRow): LedgerEntryRecord {
  return {
    id: row.id,
    usageEventId: row.usage_event_id,
    walletId: row.wallet_id,
    direction: row.direction,
    amount: row.amount,
    reason: row.reason,
    metadata: row.metadata ?? {},
    createdAt: toIso(row.created_at),
  };
}

function mapSessionRow(row: SessionRow): GatewaySessionRecord {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    attribution: {
      appId: row.app_id,
      channelId: row.channel_id,
      endUserId: row.end_user_id,
      useCase: row.use_case,
      mode: row.mode,
    },
    expiresAt: toIso(row.expires_at),
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : undefined,
    createdAt: toIso(row.created_at),
  };
}

function mapWalletRow(row: WalletRow): GatewayWalletRecord {
  return {
    appId: row.app_id,
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    balance: row.balance,
    currency: row.currency,
  };
}

function getMemoryWallet(
  state: InMemoryGatewayState,
  attribution: AttributionContext,
): GatewayWalletRecord | undefined {
  return [...state.wallets.values()].find(
    (candidate) =>
      candidate.appId === attribution.appId &&
      candidate.ownerType === "end_user" &&
      candidate.ownerId === attribution.endUserId,
  );
}

function memoryIdempotencyKey(sessionId: string, idempotencyKey: string) {
  return `${sessionId}\0${idempotencyKey}`;
}

function requireMemoryIdempotencyReservation(
  state: InMemoryGatewayState,
  input: GatewayIdempotencyReservation | undefined,
): void {
  if (!input) {
    return;
  }

  const record = state.idempotencyRecords.get(
    memoryIdempotencyKey(input.sessionId, input.idempotencyKey),
  );

  if (
    !record ||
    record.status !== "processing" ||
    record.requestHash !== input.requestHash ||
    record.reservationId !== input.reservationId
  ) {
    throw new Error("Idempotency reservation is no longer active.");
  }
}

function completeMemoryIdempotencyReservation(
  state: InMemoryGatewayState,
  input: GatewayIdempotencyReservation | undefined,
  usageEventId: string,
): void {
  if (!input) {
    return;
  }

  const key = memoryIdempotencyKey(input.sessionId, input.idempotencyKey);
  const record = state.idempotencyRecords.get(key);

  if (!record) {
    throw new Error("Idempotency reservation disappeared before completion.");
  }

  state.idempotencyRecords.set(key, {
    ...record,
    completedAt: new Date().toISOString(),
    status: "completed",
    usageEventId,
  });
}

async function getPostgresWallet(
  sql: FountLayerSql,
  attribution: AttributionContext,
): Promise<GatewayWalletRecord | undefined> {
  const rows = await sql<WalletRow[]>`
    select
      app_id,
      id,
      owner_type,
      owner_id,
      currency,
      balance_numeric::text as balance
    from wallets
    where app_id = ${attribution.appId}
      and owner_type = 'end_user'
      and owner_id = ${attribution.endUserId}
    limit 1
  `;

  return rows[0] ? mapWalletRow(rows[0]) : undefined;
}

async function beginPostgresIdempotentRequest(
  sql: FountLayerSql,
  input: GatewayIdempotencyReservation & { now?: Date },
): Promise<GatewayIdempotencyBeginResult> {
  return sql.begin(async (transaction) => {
    const now = input.now ?? new Date();
    const inserted = await transaction<IdempotencyRow[]>`
      insert into idempotency_records (
        session_id,
        idempotency_key,
        request_hash,
        reservation_id,
        status,
        locked_until
      )
      values (
        ${input.sessionId},
        ${input.idempotencyKey},
        ${input.requestHash},
        ${input.reservationId},
        'processing',
        ${input.lockedUntil}
      )
      on conflict (session_id, idempotency_key) do nothing
      returning *
    `;

    if (inserted.length > 0) {
      return { status: "acquired" };
    }

    const rows = await transaction<IdempotencyRow[]>`
      select *
      from idempotency_records
      where session_id = ${input.sessionId}
        and idempotency_key = ${input.idempotencyKey}
      for update
    `;
    const existing = rows[0];

    if (!existing) {
      throw new Error("Idempotency record disappeared during acquisition.");
    }

    if (existing.request_hash !== input.requestHash) {
      return { status: "conflict" };
    }

    if (existing.status === "completed") {
      if (!existing.usage_event_id) {
        throw new Error("Completed idempotency record has no usage event.");
      }

      return {
        status: "completed",
        usageEventId: existing.usage_event_id,
      };
    }

    if (Date.parse(toIso(existing.locked_until)) > now.getTime()) {
      return { status: "in_progress" };
    }

    await transaction`
      update idempotency_records
      set
        reservation_id = ${input.reservationId},
        locked_until = ${input.lockedUntil}
      where session_id = ${input.sessionId}
        and idempotency_key = ${input.idempotencyKey}
        and status = 'processing'
    `;

    return { status: "acquired" };
  });
}

async function requirePostgresIdempotencyReservation(
  sql: FountLayerTransactionSql,
  input: GatewayIdempotencyReservation | undefined,
): Promise<void> {
  if (!input) {
    return;
  }

  const rows = await sql<Array<{ reservation_id: string }>>`
    select reservation_id
    from idempotency_records
    where session_id = ${input.sessionId}
      and idempotency_key = ${input.idempotencyKey}
      and request_hash = ${input.requestHash}
      and reservation_id = ${input.reservationId}
      and status = 'processing'
      and locked_until > now()
    for update
  `;

  if (!rows[0]) {
    throw new Error("Idempotency reservation is no longer active.");
  }
}

async function completePostgresIdempotencyReservation(
  sql: FountLayerTransactionSql,
  input: GatewayIdempotencyReservation | undefined,
  usageEventId: string,
): Promise<void> {
  if (!input) {
    return;
  }

  const rows = await sql<Array<{ usage_event_id: string }>>`
    update idempotency_records
    set
      status = 'completed',
      usage_event_id = ${usageEventId},
      completed_at = now()
    where session_id = ${input.sessionId}
      and idempotency_key = ${input.idempotencyKey}
      and request_hash = ${input.requestHash}
      and reservation_id = ${input.reservationId}
      and status = 'processing'
    returning usage_event_id
  `;

  if (!rows[0]) {
    throw new Error("Idempotency reservation could not be completed.");
  }
}

function percent(value: string): string {
  const formatted = formatFixed(parseFixed(value, rateScale) * 100n, rateScale)
    .replace(/0+$/u, "")
    .replace(/\.$/u, "");

  return `${formatted}%`;
}

function stringFromConfig(
  config: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = config[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function optionalStringFromConfig(
  config: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = config[key];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArrayFromConfig(
  config: Record<string, unknown>,
  key: string,
  fallback: string[],
): string[] {
  const value = config[key];
  const strings = asStringArray(value);

  return strings.length > 0 ? strings : fallback;
}

function mapAdminRouteRow(row: AdminRouteRow): GatewayAdminRouteRecord {
  return {
    appId: row.app_id,
    id: row.id,
    alias: row.alias,
    provider: stringFromConfig(row.config, "provider", "unknown"),
    model: stringFromConfig(row.config, "model", "unknown"),
    adapter: stringFromConfig(row.config, "adapter", "unknown"),
    status: row.status,
  };
}

function mapRoutePolicyRow(row: AdminRouteRow): GatewayRoutePolicyRecord {
  const model = stringFromConfig(row.config, "model", "unknown");

  return {
    adapter: stringFromConfig(row.config, "adapter", "unknown"),
    alias: row.alias,
    appId: row.app_id,
    fallbackModels: stringArrayFromConfig(row.config, "fallbackModels", [
      model,
    ]),
    id: row.id,
    latencyPreference: optionalStringFromConfig(
      row.config,
      "latencyPreference",
    ),
    maxRetailPrice: optionalStringFromConfig(row.config, "maxRetailPrice"),
    model,
    modelAllowlist: stringArrayFromConfig(row.config, "modelAllowlist", [
      model,
    ]),
    provider: stringFromConfig(row.config, "provider", "unknown"),
    status: row.status === "active" ? "active" : "disabled",
  };
}

function mapAdminPricingPolicyRow(
  row: AdminPricingPolicyRow,
): GatewayAdminPricingPolicyRecord {
  return {
    id: row.id,
    appId: row.app_id ?? "platform",
    platformFeeRate: percent(row.platform_fee_rate),
    paymentFeeReserveRate: percent(row.payment_fee_reserve_rate),
    riskReserveRate: percent(row.risk_reserve_rate),
    developerMarkupRate: percent(row.developer_markup_rate),
    channelMarkupRate: percent(row.channel_markup_rate),
    maxTotalMarkupRate: percent(row.max_total_markup_rate),
  };
}

function mapProviderCredentialRecord(
  credential: GatewayProviderCredentialRecord,
): GatewayAdminCredentialRecord {
  return {
    appId: credential.appId,
    id: credential.id,
    owner: `${credential.ownerType}:${credential.ownerId}`,
    provider: credential.provider,
    storage: `server-side encrypted:${credential.keyVersion}`,
    status: credential.status,
    display: credential.display,
  };
}

function mapAdminAppRow(row: AdminAppRow): GatewayAdminAppRecord {
  return {
    id: row.id,
    name: row.name,
    developer: row.developer,
    status: row.status,
    defaultRoute: row.default_route ?? "not configured",
  };
}

function mapAdminChannelRow(row: AdminChannelRow): GatewayAdminChannelRecord {
  return {
    id: row.id,
    appId: row.app_id,
    name: row.name,
    type: row.type,
    status: row.status,
  };
}

function routeConfigFromPolicy(
  route: GatewayRoutePolicyRecord,
): Record<string, unknown> {
  return {
    adapter: route.adapter,
    fallbackModels: route.fallbackModels,
    latencyPreference: route.latencyPreference,
    maxRetailPrice: route.maxRetailPrice,
    model: route.model,
    modelAllowlist: route.modelAllowlist,
    provider: route.provider,
  };
}

function adminRouteFromPolicy(
  route: GatewayRoutePolicyRecord,
): GatewayAdminRouteRecord {
  return {
    adapter: route.adapter,
    alias: route.alias,
    appId: route.appId,
    id: route.id,
    model: route.model,
    provider: route.provider,
    status: route.status,
  };
}

function defaultRouteLabel(
  state: InMemoryGatewayState,
  appId: string,
  defaultRouteId?: string,
): string {
  if (!defaultRouteId) {
    return "not configured";
  }

  return (
    state.routePolicies.find(
      (route) => route.appId === appId && route.id === defaultRouteId,
    )?.alias ?? "not configured"
  );
}

function cloneGrant(grant: GatewayGrantRecord): GatewayGrantRecord {
  return {
    ...grant,
    allowedModels: [...grant.allowedModels],
    allowedUseCases: [...grant.allowedUseCases],
  };
}

async function getPostgresAdminApp(
  sql: FountLayerSql,
  id: string,
): Promise<GatewayAdminAppRecord | undefined> {
  const rows = await sql<AdminAppRow[]>`
    select
      apps.id,
      apps.name,
      developers.name as developer,
      apps.status,
      routes.alias as default_route
    from apps
    join developers on developers.id = apps.developer_id
    left join routes
      on routes.app_id = apps.id
     and routes.id = apps.default_route_id
    where apps.id = ${id}
    limit 1
  `;
  const row = rows[0];

  return row ? mapAdminAppRow(row) : undefined;
}

async function getPostgresAdminChannel(
  sql: FountLayerSql,
  id: string,
): Promise<GatewayAdminChannelRecord | undefined> {
  const rows = await sql<AdminChannelRow[]>`
    select id, app_id, name, type, status
    from channels
    where id = ${id}
    limit 1
  `;
  const row = rows[0];

  return row ? mapAdminChannelRow(row) : undefined;
}

async function getPostgresFaucetGrant(
  sql: FountLayerSql,
  id: string,
): Promise<GatewayGrantRecord | undefined> {
  const rows = await sql<GrantRow[]>`
    select
      id,
      app_id,
      channel_id,
      end_user_id,
      wallet_id,
      remaining_numeric::text as remaining,
      allowed_models,
      allowed_use_cases,
      daily_cap_numeric::text as daily_cap,
      expires_at,
      status
    from faucet_grants
    where id = ${id}
    limit 1
  `;
  const row = rows[0];

  return row ? mapGrantRow(row) : undefined;
}

async function getPostgresAdminRoute(
  sql: FountLayerSql,
  id: string,
): Promise<GatewayAdminRouteRecord | undefined> {
  const rows = await sql<AdminRouteRow[]>`
    select id, app_id, alias, config, status
    from routes
    where id = ${id}
    limit 1
  `;
  const row = rows[0];

  return row ? mapAdminRouteRow(row) : undefined;
}

async function getPostgresAdminPricingPolicy(
  sql: FountLayerSql,
  id: string,
): Promise<GatewayAdminPricingPolicyRecord | undefined> {
  const rows = await sql<AdminPricingPolicyRow[]>`
    select
      id,
      app_id,
      platform_fee_rate::text as platform_fee_rate,
      payment_fee_reserve_rate::text as payment_fee_reserve_rate,
      risk_reserve_rate::text as risk_reserve_rate,
      developer_markup_rate::text as developer_markup_rate,
      channel_markup_rate::text as channel_markup_rate,
      max_total_markup_rate::text as max_total_markup_rate
    from pricing_policies
    where id = ${id}
    limit 1
  `;
  const row = rows[0];

  return row ? mapAdminPricingPolicyRow(row) : undefined;
}

function findGatewayGrantMatch(input: {
  grants: GatewayGrantRecord[];
  attribution: AttributionContext;
  model: string;
  requestedAmount: string;
  dailyUsageByGrantId?: Map<string, string>;
  now?: Date;
}): GatewayGrantMatch {
  const match = findMatchingFaucetGrant(input);

  if (!match.matched) {
    return match;
  }

  const grant = input.grants.find(
    (candidate) => candidate.id === match.grant.id,
  );

  if (!grant) {
    return {
      matched: false,
      reasons: ["scope_mismatch"],
    };
  }

  return {
    matched: true,
    grant,
  };
}

function listMemoryCandidateGrants(
  state: InMemoryGatewayState,
  attribution: AttributionContext,
  model?: string,
  now = new Date(),
): GatewayGrantRecord[] {
  return state.faucetGrants.filter((grant) => {
    const modelAllowed = model ? grant.allowedModels.includes(model) : true;

    return (
      grant.appId === attribution.appId &&
      grant.channelId === attribution.channelId &&
      grant.endUserId === attribution.endUserId &&
      grant.allowedUseCases.includes(attribution.useCase) &&
      modelAllowed &&
      grant.status === "active" &&
      compareMoney(grant.remaining, "0.00000000") > 0 &&
      Date.parse(grant.expiresAt) > now.getTime()
    );
  });
}

function memoryDailyUsageByGrantId(
  state: InMemoryGatewayState,
  grants: GatewayGrantRecord[],
  now = new Date(),
): Map<string, string> {
  const usage = new Map<string, string>();

  for (const grant of grants) {
    usage.set(
      grant.id,
      calculateDailyGrantUsage(
        state.usageEvents
          .filter((event) => event.faucetGrantId === grant.id)
          .map((event) => ({
            faucetGrantId: grant.id,
            amount: event.retailPrice,
            createdAt: event.createdAt,
            status: event.status === "refunded" ? "refunded" : "success",
          })),
        grant.id,
        now,
      ),
    );
  }

  return usage;
}

function scrubLedgerMetadataEndUser(
  metadata: Record<string, unknown>,
  input: {
    appId: string;
    endUserId: string;
    tombstoneEndUserId: string;
  },
): {
  changed: boolean;
  metadata: Record<string, unknown>;
} {
  if (
    metadata["appId"] !== input.appId ||
    metadata["endUserId"] !== input.endUserId
  ) {
    return {
      changed: false,
      metadata,
    };
  }

  return {
    changed: true,
    metadata: {
      ...metadata,
      endUserId: input.tombstoneEndUserId,
    },
  };
}

function countRows(rows: unknown[]): number {
  return rows.length;
}

export function createInMemoryGatewayStore(
  state: InMemoryGatewayState = createDefaultInMemoryGatewayState(),
): GatewayStore {
  return {
    async healthCheck() {
      return {
        component: "memory",
        status: "ok",
      };
    },

    async redeemSessionTicket(input) {
      const now = new Date(input.createdAt ?? new Date().toISOString());

      for (const [ticketIdHash, expiresAt] of state.sessionTicketRedemptions) {
        if (Date.parse(expiresAt) <= now.getTime()) {
          state.sessionTicketRedemptions.delete(ticketIdHash);
        }
      }

      if (state.sessionTicketRedemptions.has(input.ticketIdHash)) {
        return { status: "replayed" };
      }

      const session: GatewaySessionRecord = {
        id: input.id,
        tokenHash: input.tokenHash,
        attribution: input.attribution,
        expiresAt: input.expiresAt,
        createdAt: now.toISOString(),
      };

      state.sessionTicketRedemptions.set(
        input.ticketIdHash,
        input.ticketExpiresAt,
      );
      state.sessions.push(session);
      return { session, status: "created" };
    },

    async consumeRateLimit(input) {
      const now = input.now ?? new Date();
      const existing = state.rateLimitCounters.get(input.keyHash);
      const counter =
        existing && Date.parse(existing.resetAt) > now.getTime()
          ? existing
          : {
              count: 0,
              resetAt: new Date(now.getTime() + input.windowMs).toISOString(),
              scope: input.scope,
            };

      if (counter.count >= input.limit) {
        state.rateLimitCounters.set(input.keyHash, counter);
        return {
          allowed: false,
          limit: input.limit,
          remaining: 0,
          resetAt: counter.resetAt,
          scope: input.scope,
        };
      }

      counter.count += 1;
      state.rateLimitCounters.set(input.keyHash, counter);

      return {
        allowed: true,
        remaining: Math.max(0, input.limit - counter.count),
        resetAt: counter.resetAt,
      };
    },

    async getActiveSessionByTokenHash(tokenHash, now = new Date()) {
      return state.sessions.find(
        (session) =>
          session.tokenHash === tokenHash &&
          !session.revokedAt &&
          Date.parse(session.expiresAt) > now.getTime(),
      );
    },

    async revokeSession(id, now = new Date()) {
      const index = state.sessions.findIndex((session) => session.id === id);

      if (index === -1) {
        return undefined;
      }

      const session = state.sessions[index]!;
      const revokedAt = session.revokedAt ?? now.toISOString();
      const revokedSession = {
        ...session,
        revokedAt,
      };

      state.sessions[index] = revokedSession;
      return revokedSession;
    },

    async getActiveApp(id) {
      const app = state.apps.get(id);
      return app?.status === "active" ? app : undefined;
    },

    async getActiveChannel(appId, channelId) {
      const channel = state.channels.get(channelId);
      return channel?.appId === appId && channel.status === "active"
        ? channel
        : undefined;
    },

    async getRoutePolicy(appId, alias) {
      return state.routePolicies.find(
        (route) =>
          route.appId === appId &&
          route.alias === alias &&
          route.status === "active",
      );
    },

    async getModelPrice(provider, model, at = new Date()) {
      const price = state.modelPrices
        .filter(
          (price) =>
            price.provider === provider &&
            price.model === model &&
            (!price.effectiveAt || price.effectiveAt.getTime() <= at.getTime()),
        )
        .sort(
          (left, right) =>
            (right.effectiveAt?.getTime() ?? 0) -
            (left.effectiveAt?.getTime() ?? 0),
        )[0];

      return price
        ? {
            ...price,
            effectiveAt: price.effectiveAt
              ? new Date(price.effectiveAt)
              : undefined,
          }
        : undefined;
    },

    async getPricingPolicy(appId) {
      const app = state.apps.get(appId);
      const policyRecord = app?.defaultPricingPolicyId
        ? state.pricingPolicies.find(
            (candidate) =>
              candidate.appId === appId &&
              candidate.id === app.defaultPricingPolicyId,
          )
        : undefined;
      const policy = policyRecord
        ? state.pricingPolicyConfigs.get(policyRecord.id)
        : undefined;

      return policy ? { ...policy } : undefined;
    },

    async listActiveGrants(attribution, model) {
      return listMemoryCandidateGrants(state, attribution, model);
    },

    async findPayingGrant({ attribution, model, requestedAmount, now }) {
      const grants = listMemoryCandidateGrants(state, attribution, model, now);
      return findGatewayGrantMatch({
        grants,
        attribution,
        model,
        requestedAmount,
        dailyUsageByGrantId: memoryDailyUsageByGrantId(state, grants, now),
        now,
      });
    },

    async findPayingWallet({ attribution, requestedAmount }) {
      const wallet = getMemoryWallet(state, attribution);

      if (!wallet) {
        return {
          matched: false,
          reason: "wallet_not_found",
        };
      }

      if (compareMoney(wallet.balance, requestedAmount) < 0) {
        return {
          matched: false,
          reason: "insufficient_wallet_balance",
        };
      }

      return {
        matched: true,
        wallet,
      };
    },

    async getWallet(attribution) {
      const wallet = getMemoryWallet(state, attribution);

      return wallet ? { ...wallet } : undefined;
    },

    async beginIdempotentRequest(input) {
      const key = memoryIdempotencyKey(input.sessionId, input.idempotencyKey);
      const existing = state.idempotencyRecords.get(key);
      const now = input.now ?? new Date();

      if (!existing) {
        state.idempotencyRecords.set(key, {
          ...input,
          createdAt: now.toISOString(),
          status: "processing",
        });
        return { status: "acquired" };
      }

      if (existing.requestHash !== input.requestHash) {
        return { status: "conflict" };
      }

      if (existing.status === "completed") {
        if (!existing.usageEventId) {
          throw new Error("Completed idempotency record has no usage event.");
        }

        return {
          status: "completed",
          usageEventId: existing.usageEventId,
        };
      }

      if (Date.parse(existing.lockedUntil) > now.getTime()) {
        return { status: "in_progress" };
      }

      state.idempotencyRecords.set(key, {
        ...existing,
        lockedUntil: input.lockedUntil,
        reservationId: input.reservationId,
      });
      return { status: "acquired" };
    },

    async releaseIdempotentRequest(input) {
      const key = memoryIdempotencyKey(input.sessionId, input.idempotencyKey);
      const existing = state.idempotencyRecords.get(key);

      if (
        existing?.status === "processing" &&
        existing.reservationId === input.reservationId
      ) {
        state.idempotencyRecords.delete(key);
      }
    },

    async recordBillableCall(input) {
      requireMemoryIdempotencyReservation(state, input.idempotency);
      const grant = state.faucetGrants.find(
        (candidate) => candidate.id === input.grantId,
      );

      if (!grant) {
        throw new Error("Faucet grant no longer exists.");
      }

      const match = findGatewayGrantMatch({
        grants: [grant],
        attribution: {
          appId: input.usageEvent.appId,
          channelId: input.usageEvent.channelId,
          endUserId: input.usageEvent.endUserId,
          useCase: input.usageEvent.useCase,
          mode: input.usageEvent.mode,
        },
        model: input.usageEvent.model,
        requestedAmount: input.amount,
        dailyUsageByGrantId: memoryDailyUsageByGrantId(
          state,
          [grant],
          input.now,
        ),
        now: input.now,
      });

      if (!match.matched) {
        throw new Error(`Faucet grant rejected: ${match.reasons.join(", ")}`);
      }

      const remaining = subtractMoney(grant.remaining, input.amount);
      const updatedGrant: GatewayGrantRecord = {
        ...grant,
        remaining,
        status:
          compareMoney(remaining, "0.00000000") === 0
            ? "exhausted"
            : grant.status,
      };
      const index = state.faucetGrants.findIndex(
        (candidate) => candidate.id === grant.id,
      );

      state.faucetGrants[index] = updatedGrant;
      state.usageEvents.push(input.usageEvent);
      state.ledgerEntries.push(...input.ledgerEntries);
      completeMemoryIdempotencyReservation(
        state,
        input.idempotency,
        input.usageEvent.id,
      );

      return {
        usageEvent: input.usageEvent,
        ledgerEntries: input.ledgerEntries,
        updatedGrant,
      };
    },

    async recordProviderCostCall(input) {
      requireMemoryIdempotencyReservation(state, input.idempotency);
      state.usageEvents.push(input.usageEvent);
      state.ledgerEntries.push(...input.ledgerEntries);
      completeMemoryIdempotencyReservation(
        state,
        input.idempotency,
        input.usageEvent.id,
      );
    },

    async recordWalletBillableCall(input) {
      requireMemoryIdempotencyReservation(state, input.idempotency);
      const wallet = state.wallets.get(input.walletId);

      if (!wallet || wallet.appId !== input.usageEvent.appId) {
        throw new Error("Wallet no longer exists.");
      }

      if (compareMoney(wallet.balance, input.amount) < 0) {
        throw new Error("Wallet balance is insufficient.");
      }

      const updatedWallet: GatewayWalletRecord = {
        ...wallet,
        balance: subtractMoney(wallet.balance, input.amount),
      };

      state.wallets.set(wallet.id, updatedWallet);
      state.usageEvents.push(input.usageEvent);
      state.ledgerEntries.push(...input.ledgerEntries);
      completeMemoryIdempotencyReservation(
        state,
        input.idempotency,
        input.usageEvent.id,
      );

      return {
        usageEvent: input.usageEvent,
        ledgerEntries: input.ledgerEntries,
        updatedWallet,
      };
    },

    async listApps() {
      return [...state.adminApps.values()].map((app) => ({ ...app }));
    },

    async createApp(input) {
      const app: GatewayAppRecord = {
        defaultPricingPolicyId: input.defaultPricingPolicyId,
        id: input.id,
        status: input.status,
        defaultRouteId: input.defaultRouteId,
      };
      const adminApp: GatewayAdminAppRecord = {
        id: input.id,
        name: input.name,
        developer: input.developerName,
        status: input.status,
        defaultRoute: defaultRouteLabel(state, input.id, input.defaultRouteId),
      };

      state.apps.set(input.id, app);
      state.adminApps.set(input.id, adminApp);

      return { ...adminApp };
    },

    async updateApp(id, input) {
      const app = state.apps.get(id);
      const adminApp = state.adminApps.get(id);

      if (!app || !adminApp) {
        return undefined;
      }

      const defaultRouteId = input.defaultRouteId ?? app.defaultRouteId;
      const status = input.status ?? app.status;
      const updatedApp: GatewayAppRecord = {
        ...app,
        defaultPricingPolicyId:
          input.defaultPricingPolicyId ?? app.defaultPricingPolicyId,
        defaultRouteId,
        status,
      };
      const updatedAdminApp: GatewayAdminAppRecord = {
        ...adminApp,
        defaultRoute: defaultRouteLabel(state, id, defaultRouteId),
        name: input.name ?? adminApp.name,
        status,
      };

      state.apps.set(id, updatedApp);
      state.adminApps.set(id, updatedAdminApp);

      return { ...updatedAdminApp };
    },

    async listChannels() {
      return [...state.adminChannels.values()].map((channel) => ({
        ...channel,
      }));
    },

    async createChannel(input) {
      const channel: GatewayChannelRecord = {
        appId: input.appId,
        id: input.id,
        status: input.status,
      };
      const adminChannel: GatewayAdminChannelRecord = {
        appId: input.appId,
        id: input.id,
        name: input.name,
        status: input.status,
        type: input.type,
      };

      state.channels.set(input.id, channel);
      state.adminChannels.set(input.id, adminChannel);

      return { ...adminChannel };
    },

    async updateChannel(id, input) {
      const channel = state.channels.get(id);
      const adminChannel = state.adminChannels.get(id);

      if (!channel || !adminChannel) {
        return undefined;
      }

      const status = input.status ?? channel.status;
      const updatedChannel: GatewayChannelRecord = {
        ...channel,
        status,
      };
      const updatedAdminChannel: GatewayAdminChannelRecord = {
        ...adminChannel,
        name: input.name ?? adminChannel.name,
        status,
        type: input.type ?? adminChannel.type,
      };

      state.channels.set(id, updatedChannel);
      state.adminChannels.set(id, updatedAdminChannel);

      return { ...updatedAdminChannel };
    },

    async listFaucetGrants() {
      return state.faucetGrants.map(cloneGrant);
    },

    async createFaucetGrant(input) {
      const grant: GatewayGrantRecord = {
        allowedModels: [...input.allowedModels],
        allowedUseCases: [...input.allowedUseCases],
        appId: input.appId,
        channelId: input.channelId,
        dailyCap: input.dailyCap,
        endUserId: input.endUserId,
        expiresAt: input.expiresAt,
        id: input.id,
        remaining: input.remaining,
        status: input.status,
        walletId: input.walletId,
      };

      if (!state.wallets.has(input.walletId)) {
        state.wallets.set(input.walletId, {
          appId: input.appId,
          balance: "0.00000000",
          currency: "USD",
          id: input.walletId,
          ownerId: input.id,
          ownerType: "faucet_grant",
        });
      }

      state.faucetGrants.push(grant);

      return cloneGrant(grant);
    },

    async updateFaucetGrant(id, input) {
      const index = state.faucetGrants.findIndex((grant) => grant.id === id);
      const grant = state.faucetGrants[index];

      if (index === -1 || !grant) {
        return undefined;
      }

      const updatedGrant: GatewayGrantRecord = {
        ...grant,
        allowedModels: input.allowedModels
          ? [...input.allowedModels]
          : [...grant.allowedModels],
        allowedUseCases: input.allowedUseCases
          ? [...input.allowedUseCases]
          : [...grant.allowedUseCases],
        dailyCap: input.dailyCap ?? grant.dailyCap,
        expiresAt: input.expiresAt ?? grant.expiresAt,
        remaining: input.remaining ?? grant.remaining,
        status: input.status ?? grant.status,
      };

      state.faucetGrants[index] = updatedGrant;

      return cloneGrant(updatedGrant);
    },

    async listRoutes() {
      return state.routePolicies.map(adminRouteFromPolicy);
    },

    async createRoute(input) {
      const route: GatewayRoutePolicyRecord = {
        adapter: input.adapter,
        alias: input.alias,
        appId: input.appId,
        fallbackModels: input.fallbackModels
          ? [...input.fallbackModels]
          : [input.model],
        id: input.id,
        latencyPreference: input.latencyPreference,
        maxRetailPrice: input.maxRetailPrice,
        model: input.model,
        modelAllowlist: [...input.modelAllowlist],
        provider: input.provider,
        status: input.status,
      };

      state.routePolicies.push(route);

      return adminRouteFromPolicy(route);
    },

    async updateRoute(id, input) {
      const index = state.routePolicies.findIndex((route) => route.id === id);
      const route = state.routePolicies[index];

      if (index === -1 || !route) {
        return undefined;
      }

      const model = input.model ?? route.model;
      const updatedRoute: GatewayRoutePolicyRecord = {
        ...route,
        adapter: input.adapter ?? route.adapter,
        alias: input.alias ?? route.alias,
        appId: input.appId ?? route.appId,
        fallbackModels: input.fallbackModels
          ? [...input.fallbackModels]
          : [...route.fallbackModels],
        latencyPreference: input.latencyPreference ?? route.latencyPreference,
        maxRetailPrice: input.maxRetailPrice ?? route.maxRetailPrice,
        model,
        modelAllowlist: input.modelAllowlist
          ? [...input.modelAllowlist]
          : [...route.modelAllowlist],
        provider: input.provider ?? route.provider,
        status: input.status ?? route.status,
      };

      state.routePolicies[index] = updatedRoute;

      return adminRouteFromPolicy(updatedRoute);
    },

    async listProviderCredentials() {
      return state.providerCredentials.length > 0
        ? state.providerCredentials.map(mapProviderCredentialRecord)
        : [{ ...defaultCredential }];
    },

    async createProviderCredential(input) {
      const now = new Date().toISOString();
      const credential: GatewayProviderCredentialRecord = {
        ...input,
        status: "active",
        createdAt: now,
      };

      state.providerCredentials.push(credential);

      return mapProviderCredentialRecord(credential);
    },

    async rotateProviderCredential(input) {
      const index = state.providerCredentials.findIndex(
        (candidate) => candidate.id === input.id,
      );

      if (index === -1) {
        return undefined;
      }

      const credential = state.providerCredentials[index];

      if (!credential) {
        return undefined;
      }

      const updatedCredential: GatewayProviderCredentialRecord = {
        ...credential,
        display: input.display,
        encryptedApiKey: input.encryptedApiKey,
        keyVersion: input.keyVersion,
        status: "active",
        updatedAt: new Date().toISOString(),
      };

      state.providerCredentials[index] = updatedCredential;

      return mapProviderCredentialRecord(updatedCredential);
    },

    async deleteProviderCredential(id) {
      const originalLength = state.providerCredentials.length;
      state.providerCredentials = state.providerCredentials.filter(
        (credential) => credential.id !== id,
      );

      return state.providerCredentials.length !== originalLength;
    },

    async listPricingPolicies() {
      return state.pricingPolicies.map((policy) => ({ ...policy }));
    },

    async createPricingPolicy(input) {
      const policy: GatewayAdminPricingPolicyRecord = {
        appId: input.appId,
        channelMarkupRate: percent(input.channelMarkupRate),
        developerMarkupRate: percent(input.developerMarkupRate),
        id: input.id,
        maxTotalMarkupRate: percent(input.maxTotalMarkupRate),
        paymentFeeReserveRate: percent(input.paymentFeeReserveRate),
        platformFeeRate: percent(input.platformFeeRate),
        riskReserveRate: percent(input.riskReserveRate),
      };

      state.pricingPolicies.push(policy);
      state.pricingPolicyConfigs.set(input.id, {
        channelMarkupRate: input.channelMarkupRate,
        developerMarkupRate: input.developerMarkupRate,
        maxTotalMarkupRate: input.maxTotalMarkupRate,
        paymentFeeReserveRate: input.paymentFeeReserveRate,
        platformFeeRate: input.platformFeeRate,
        riskReserveRate: input.riskReserveRate,
      });

      return { ...policy };
    },

    async updatePricingPolicy(id, input) {
      const index = state.pricingPolicies.findIndex(
        (policy) => policy.id === id,
      );
      const policy = state.pricingPolicies[index];
      const runtimePolicy = state.pricingPolicyConfigs.get(id);

      if (index === -1 || !policy || !runtimePolicy) {
        return undefined;
      }

      const updatedPolicy: GatewayAdminPricingPolicyRecord = {
        ...policy,
        appId: input.appId ?? policy.appId,
        channelMarkupRate: input.channelMarkupRate
          ? percent(input.channelMarkupRate)
          : policy.channelMarkupRate,
        developerMarkupRate: input.developerMarkupRate
          ? percent(input.developerMarkupRate)
          : policy.developerMarkupRate,
        maxTotalMarkupRate: input.maxTotalMarkupRate
          ? percent(input.maxTotalMarkupRate)
          : policy.maxTotalMarkupRate,
        paymentFeeReserveRate: input.paymentFeeReserveRate
          ? percent(input.paymentFeeReserveRate)
          : policy.paymentFeeReserveRate,
        platformFeeRate: input.platformFeeRate
          ? percent(input.platformFeeRate)
          : policy.platformFeeRate,
        riskReserveRate: input.riskReserveRate
          ? percent(input.riskReserveRate)
          : policy.riskReserveRate,
      };

      state.pricingPolicies[index] = updatedPolicy;
      state.pricingPolicyConfigs.set(id, {
        channelMarkupRate:
          input.channelMarkupRate ?? runtimePolicy.channelMarkupRate,
        developerMarkupRate:
          input.developerMarkupRate ?? runtimePolicy.developerMarkupRate,
        maxTotalMarkupRate:
          input.maxTotalMarkupRate ?? runtimePolicy.maxTotalMarkupRate,
        paymentFeeReserveRate:
          input.paymentFeeReserveRate ?? runtimePolicy.paymentFeeReserveRate,
        platformFeeRate: input.platformFeeRate ?? runtimePolicy.platformFeeRate,
        riskReserveRate: input.riskReserveRate ?? runtimePolicy.riskReserveRate,
      });

      return { ...updatedPolicy };
    },

    async listUsageEvents() {
      return state.usageEvents;
    },

    async listLedgerEntries() {
      return state.ledgerEntries;
    },

    async purgeExpiredRequestMetadata(input) {
      const retention = createRequestMetadataRetentionWindow(input);
      let ledgerEntriesUpdated = 0;

      state.ledgerEntries = state.ledgerEntries.map((entry) => {
        if (
          Date.parse(entry.createdAt) >= retention.cutoff.getTime() ||
          Object.keys(entry.metadata).length === 0
        ) {
          return entry;
        }

        ledgerEntriesUpdated += 1;
        return {
          ...entry,
          metadata: {},
        };
      });

      return {
        cutoff: retention.cutoffIso,
        ledgerEntriesUpdated,
        retentionDays: retention.retentionDays,
      };
    },

    async anonymizeEndUser(input) {
      const tombstoneEndUserId = createDeletedEndUserId(input);
      const nowIso = (input.now ?? new Date()).toISOString();
      let sessionsRevoked = 0;
      let faucetGrantsAnonymized = 0;
      let faucetGrantsRevoked = 0;
      let usageEventsAnonymized = 0;
      let ledgerEntriesScrubbed = 0;
      let walletsAnonymized = 0;
      let providerCredentialsRevoked = 0;

      state.sessions = state.sessions.map((session) => {
        if (
          session.attribution.appId !== input.appId ||
          session.attribution.endUserId !== input.endUserId
        ) {
          return session;
        }

        sessionsRevoked += session.revokedAt ? 0 : 1;
        return {
          ...session,
          attribution: {
            ...session.attribution,
            endUserId: tombstoneEndUserId,
          },
          revokedAt: session.revokedAt ?? nowIso,
        };
      });

      state.faucetGrants = state.faucetGrants.map((grant) => {
        if (
          grant.appId !== input.appId ||
          grant.endUserId !== input.endUserId
        ) {
          return grant;
        }

        faucetGrantsAnonymized += 1;
        faucetGrantsRevoked += grant.status === "active" ? 1 : 0;
        return {
          ...grant,
          endUserId: tombstoneEndUserId,
          status: grant.status === "active" ? "revoked" : grant.status,
        };
      });

      state.usageEvents = state.usageEvents.map((event) => {
        if (
          event.appId !== input.appId ||
          event.endUserId !== input.endUserId
        ) {
          return event;
        }

        usageEventsAnonymized += 1;
        return {
          ...event,
          endUserId: tombstoneEndUserId,
        };
      });

      state.ledgerEntries = state.ledgerEntries.map((entry) => {
        const scrubbed = scrubLedgerMetadataEndUser(entry.metadata, {
          appId: input.appId,
          endUserId: input.endUserId,
          tombstoneEndUserId,
        });

        if (!scrubbed.changed) {
          return entry;
        }

        ledgerEntriesScrubbed += 1;
        return {
          ...entry,
          metadata: scrubbed.metadata,
        };
      });

      for (const [id, wallet] of state.wallets) {
        if (
          wallet.appId !== input.appId ||
          wallet.ownerType !== "end_user" ||
          wallet.ownerId !== input.endUserId
        ) {
          continue;
        }

        walletsAnonymized += 1;
        state.wallets.set(id, {
          ...wallet,
          ownerId: tombstoneEndUserId,
        });
      }

      state.providerCredentials = state.providerCredentials.map(
        (credential) => {
          if (
            credential.appId !== input.appId ||
            credential.ownerType !== "end_user" ||
            credential.ownerId !== input.endUserId
          ) {
            return credential;
          }

          providerCredentialsRevoked += 1;
          return {
            ...credential,
            ownerId: tombstoneEndUserId,
            status: "revoked",
          };
        },
      );

      return {
        appId: input.appId,
        endUserRecordsDeleted: 0,
        faucetGrantsAnonymized,
        faucetGrantsRevoked,
        ledgerEntriesScrubbed,
        providerCredentialsRevoked,
        sessionsRevoked,
        tombstoneEndUserId,
        usageEventsAnonymized,
        walletsAnonymized,
      };
    },
  };
}

async function listPostgresCandidateGrants(
  sql: FountLayerSql | FountLayerTransactionSql,
  attribution: AttributionContext,
  options: {
    model?: string;
    lock?: boolean;
  } = {},
): Promise<GatewayGrantRecord[]> {
  const rows = options.lock
    ? await sql<GrantRow[]>`
        select
          id,
          app_id,
          channel_id,
          end_user_id,
          wallet_id,
          remaining_numeric::text as remaining,
          allowed_models,
          allowed_use_cases,
          daily_cap_numeric::text as daily_cap,
          expires_at,
          status
        from faucet_grants
        where app_id = ${attribution.appId}
          and channel_id = ${attribution.channelId}
          and end_user_id = ${attribution.endUserId}
          and status = 'active'
          and remaining_numeric > 0
          and expires_at > now()
        for update
      `
    : await sql<GrantRow[]>`
        select
          id,
          app_id,
          channel_id,
          end_user_id,
          wallet_id,
          remaining_numeric::text as remaining,
          allowed_models,
          allowed_use_cases,
          daily_cap_numeric::text as daily_cap,
          expires_at,
          status
        from faucet_grants
        where app_id = ${attribution.appId}
          and channel_id = ${attribution.channelId}
          and end_user_id = ${attribution.endUserId}
          and status = 'active'
          and remaining_numeric > 0
          and expires_at > now()
      `;
  const grants = rows.map(mapGrantRow);

  return options.model
    ? grants.filter((grant) =>
        grant.allowedModels.includes(options.model ?? ""),
      )
    : grants;
}

async function postgresDailyUsageByGrantId(
  sql: FountLayerSql | FountLayerTransactionSql,
  attribution: AttributionContext,
  now = new Date(),
): Promise<Map<string, string>> {
  const { start, end } = utcDayBounds(now);
  const rows = await sql<Array<{ faucet_grant_id: string; amount: string }>>`
    select
      faucet_grant_id,
      coalesce(sum(retail_price_numeric), 0)::text as amount
    from usage_events
    where app_id = ${attribution.appId}
      and channel_id = ${attribution.channelId}
      and end_user_id = ${attribution.endUserId}
      and status = 'success'
      and faucet_grant_id is not null
      and created_at >= ${start.toISOString()}
      and created_at < ${end.toISOString()}
    group by faucet_grant_id
  `;

  return new Map(rows.map((row) => [row.faucet_grant_id, row.amount]));
}

async function insertUsageEvent(
  sql: FountLayerTransactionSql,
  usageEvent: UsageEventRecord,
): Promise<void> {
  await sql`
    insert into usage_events (
      id,
      request_id,
      app_id,
      channel_id,
      end_user_id,
      mode,
      provider,
      model,
      route_id,
      use_case,
      input_tokens,
      output_tokens,
      cached_input_tokens,
      usage_estimated,
      upstream_cost_numeric,
      wholesale_price_numeric,
      retail_price_numeric,
      faucet_grant_id,
      status,
      created_at
    )
    values (
      ${usageEvent.id},
      ${usageEvent.requestId},
      ${usageEvent.appId},
      ${usageEvent.channelId},
      ${usageEvent.endUserId},
      ${usageEvent.mode},
      ${usageEvent.provider ?? null},
      ${usageEvent.model},
      ${usageEvent.routeId ?? null},
      ${usageEvent.useCase},
      ${usageEvent.inputTokens},
      ${usageEvent.outputTokens},
      ${usageEvent.cachedInputTokens},
      ${usageEvent.usageEstimated},
      ${usageEvent.upstreamCost},
      ${usageEvent.wholesalePrice},
      ${usageEvent.retailPrice},
      ${usageEvent.faucetGrantId ?? null},
      ${usageEvent.status},
      ${usageEvent.createdAt}
    )
  `;
}

async function insertLedgerEntries(
  sql: FountLayerTransactionSql,
  appId: string,
  ledgerEntries: LedgerEntryRecord[],
): Promise<void> {
  for (const entry of ledgerEntries) {
    await sql`
      insert into ledger_entries (
        id,
        app_id,
        usage_event_id,
        wallet_id,
        direction,
        amount_numeric,
        reason,
        metadata,
        created_at
      )
      values (
        ${entry.id},
        ${appId},
        ${entry.usageEventId},
        ${entry.walletId},
        ${entry.direction},
        ${entry.amount},
        ${entry.reason},
        ${sql.json(toJsonValue(entry.metadata))},
        ${entry.createdAt}
      )
    `;
  }
}

export function createPostgresGatewayStore(sql: FountLayerSql): GatewayStore {
  return {
    async healthCheck() {
      await sql`select 1 as ok`;

      return {
        component: "postgres",
        status: "ok",
      };
    },

    async redeemSessionTicket(input) {
      return sql.begin(async (transaction) => {
        await transaction`
          delete from session_ticket_redemptions
          where expires_at <= ${input.createdAt ?? new Date().toISOString()}
        `;

        const redeemed = await transaction<Array<{ ticket_id_hash: string }>>`
          insert into session_ticket_redemptions (
            ticket_id_hash,
            app_id,
            expires_at,
            redeemed_at
          )
          values (
            ${input.ticketIdHash},
            ${input.attribution.appId},
            ${input.ticketExpiresAt},
            ${input.createdAt ?? new Date().toISOString()}
          )
          on conflict (ticket_id_hash) do nothing
          returning ticket_id_hash
        `;

        if (redeemed.length === 0) {
          return { status: "replayed" } as const;
        }

        await transaction`
          insert into end_users (
            id,
            app_id,
            external_user_hash
          )
          values (
            ${input.attribution.endUserId},
            ${input.attribution.appId},
            ${input.attribution.endUserId}
          )
          on conflict (id) do update set
            external_user_hash = excluded.external_user_hash
        `;

        const rows = await transaction<SessionRow[]>`
          insert into sessions (
            id,
            app_id,
            channel_id,
            end_user_id,
            use_case,
            mode,
            token_hash,
            expires_at,
            created_at
          )
          values (
            ${input.id},
            ${input.attribution.appId},
            ${input.attribution.channelId},
            ${input.attribution.endUserId},
            ${input.attribution.useCase},
            ${input.attribution.mode},
            ${input.tokenHash},
            ${input.expiresAt},
            ${input.createdAt ?? new Date().toISOString()}
          )
          returning
            id,
            app_id,
            channel_id,
            end_user_id,
            use_case,
            mode,
            token_hash,
            expires_at,
            revoked_at,
            created_at
        `;
        const row = rows[0];

        if (!row) {
          throw new Error("Session was not created.");
        }

        return { session: mapSessionRow(row), status: "created" } as const;
      });
    },

    async consumeRateLimit(input) {
      return sql.begin(async (transaction) => {
        const now = input.now ?? new Date();
        const initialResetAt = new Date(
          now.getTime() + input.windowMs,
        ).toISOString();

        await transaction`
          delete from rate_limit_counters
          where reset_at <= ${now.toISOString()}
            and key_hash <> ${input.keyHash}
        `;

        await transaction`
          insert into rate_limit_counters (
            key_hash,
            scope,
            count,
            reset_at,
            updated_at
          )
          values (
            ${input.keyHash},
            ${input.scope},
            0,
            ${initialResetAt},
            ${now.toISOString()}
          )
          on conflict (key_hash) do nothing
        `;

        const rows = await transaction<RateLimitRow[]>`
          select count, reset_at
          from rate_limit_counters
          where key_hash = ${input.keyHash}
          for update
        `;
        const existing = rows[0];

        if (!existing) {
          throw new Error("Rate-limit counter disappeared during acquisition.");
        }

        const expired = Date.parse(toIso(existing.reset_at)) <= now.getTime();
        const count = expired ? 0 : existing.count;
        const resetAt = expired ? initialResetAt : toIso(existing.reset_at);

        if (count >= input.limit) {
          return {
            allowed: false,
            limit: input.limit,
            remaining: 0,
            resetAt,
            scope: input.scope,
          } as const;
        }

        const nextCount = count + 1;
        await transaction`
          update rate_limit_counters
          set
            count = ${nextCount},
            reset_at = ${resetAt},
            scope = ${input.scope},
            updated_at = ${now.toISOString()}
          where key_hash = ${input.keyHash}
        `;

        return {
          allowed: true,
          remaining: Math.max(0, input.limit - nextCount),
          resetAt,
        } as const;
      });
    },

    async getActiveSessionByTokenHash(tokenHash, now = new Date()) {
      const rows = await sql<SessionRow[]>`
        select
          id,
          app_id,
          channel_id,
          end_user_id,
          use_case,
          mode,
          token_hash,
          expires_at,
          revoked_at,
          created_at
        from sessions
        where token_hash = ${tokenHash}
          and expires_at > ${now.toISOString()}
          and revoked_at is null
        limit 1
      `;
      const row = rows[0];

      return row ? mapSessionRow(row) : undefined;
    },

    async revokeSession(id, now = new Date()) {
      const rows = await sql<SessionRow[]>`
        update sessions
        set revoked_at = coalesce(revoked_at, ${now.toISOString()})
        where id = ${id}
        returning
          id,
          app_id,
          channel_id,
          end_user_id,
          use_case,
          mode,
          token_hash,
          expires_at,
          revoked_at,
          created_at
      `;
      const row = rows[0];

      return row ? mapSessionRow(row) : undefined;
    },

    async getActiveApp(id) {
      const rows = await sql<
        Array<{
          id: string;
          status: GatewayAppRecord["status"];
          default_pricing_policy_id: string | null;
          default_route_id: string | null;
        }>
      >`
        select id, status, default_route_id, default_pricing_policy_id
        from apps
        where id = ${id} and status = 'active'
        limit 1
      `;
      const row = rows[0];

      return row
        ? {
            defaultPricingPolicyId: row.default_pricing_policy_id ?? undefined,
            id: row.id,
            status: row.status,
            defaultRouteId: row.default_route_id ?? undefined,
          }
        : undefined;
    },

    async getActiveChannel(appId, channelId) {
      const rows = await sql<
        Array<{
          id: string;
          app_id: string;
          status: GatewayChannelRecord["status"];
        }>
      >`
        select id, app_id, status
        from channels
        where id = ${channelId}
          and app_id = ${appId}
          and status = 'active'
        limit 1
      `;
      const row = rows[0];

      return row
        ? {
            id: row.id,
            appId: row.app_id,
            status: row.status,
          }
        : undefined;
    },

    async getRoutePolicy(appId, alias) {
      const rows = await sql<AdminRouteRow[]>`
        select id, app_id, alias, config, status
        from routes
        where app_id = ${appId}
          and alias = ${alias}
          and status = 'active'
        limit 1
      `;
      const row = rows[0];

      return row ? mapRoutePolicyRow(row) : undefined;
    },

    async getModelPrice(provider, model, at = new Date()) {
      const rows = await sql<
        Array<{
          cached_input_per_mtok: string | null;
          currency: string;
          effective_at: string | Date | null;
          input_per_mtok: string;
          model: string;
          output_per_mtok: string;
          provider: string;
        }>
      >`
        select
          provider,
          model,
          input_per_mtok::text as input_per_mtok,
          output_per_mtok::text as output_per_mtok,
          cached_input_per_mtok::text as cached_input_per_mtok,
          currency,
          effective_at
        from model_prices
        where provider = ${provider}
          and model = ${model}
          and (effective_at is null or effective_at <= ${at.toISOString()})
        order by effective_at desc nulls last, created_at desc, id desc
        limit 1
      `;
      const row = rows[0];

      return row
        ? {
            cachedInputPerMtok: row.cached_input_per_mtok ?? undefined,
            currency: row.currency,
            effectiveAt: row.effective_at
              ? new Date(row.effective_at)
              : undefined,
            inputPerMtok: row.input_per_mtok,
            model: row.model,
            outputPerMtok: row.output_per_mtok,
            provider: row.provider,
          }
        : undefined;
    },

    async getPricingPolicy(appId) {
      const rows = await sql<AdminPricingPolicyRow[]>`
        select
          policies.id,
          policies.app_id,
          policies.platform_fee_rate::text as platform_fee_rate,
          policies.payment_fee_reserve_rate::text as payment_fee_reserve_rate,
          policies.risk_reserve_rate::text as risk_reserve_rate,
          policies.developer_markup_rate::text as developer_markup_rate,
          policies.channel_markup_rate::text as channel_markup_rate,
          policies.max_total_markup_rate::text as max_total_markup_rate
        from apps
        join pricing_policies policies
          on policies.app_id = apps.id
         and policies.id = apps.default_pricing_policy_id
        where apps.id = ${appId}
        limit 1
      `;
      const row = rows[0];

      return row
        ? {
            channelMarkupRate: row.channel_markup_rate,
            developerMarkupRate: row.developer_markup_rate,
            maxTotalMarkupRate: row.max_total_markup_rate,
            paymentFeeReserveRate: row.payment_fee_reserve_rate,
            platformFeeRate: row.platform_fee_rate,
            riskReserveRate: row.risk_reserve_rate,
          }
        : undefined;
    },

    async listActiveGrants(attribution, model) {
      return listPostgresCandidateGrants(sql, attribution, { model });
    },

    async findPayingGrant({ attribution, model, requestedAmount, now }) {
      const grants = await listPostgresCandidateGrants(sql, attribution, {
        model,
      });

      return findGatewayGrantMatch({
        grants,
        attribution,
        model,
        requestedAmount,
        dailyUsageByGrantId: await postgresDailyUsageByGrantId(
          sql,
          attribution,
          now,
        ),
        now,
      });
    },

    async findPayingWallet({ attribution, requestedAmount }) {
      const wallet = await getPostgresWallet(sql, attribution);

      if (!wallet) {
        return {
          matched: false,
          reason: "wallet_not_found",
        };
      }

      if (compareMoney(wallet.balance, requestedAmount) < 0) {
        return {
          matched: false,
          reason: "insufficient_wallet_balance",
        };
      }

      return {
        matched: true,
        wallet,
      };
    },

    async getWallet(attribution) {
      return getPostgresWallet(sql, attribution);
    },

    async beginIdempotentRequest(input) {
      return beginPostgresIdempotentRequest(sql, input);
    },

    async releaseIdempotentRequest(input) {
      await sql`
        delete from idempotency_records
        where session_id = ${input.sessionId}
          and idempotency_key = ${input.idempotencyKey}
          and reservation_id = ${input.reservationId}
          and status = 'processing'
      `;
    },

    async recordBillableCall(input) {
      return sql.begin(async (transaction) => {
        await requirePostgresIdempotencyReservation(
          transaction,
          input.idempotency,
        );
        const attribution = {
          appId: input.usageEvent.appId,
          channelId: input.usageEvent.channelId,
          endUserId: input.usageEvent.endUserId,
          useCase: input.usageEvent.useCase,
          mode: input.usageEvent.mode,
        };
        const grants = (
          await listPostgresCandidateGrants(transaction, attribution, {
            model: input.usageEvent.model,
            lock: true,
          })
        ).filter((grant) => grant.id === input.grantId);
        const match = findGatewayGrantMatch({
          grants,
          attribution,
          model: input.usageEvent.model,
          requestedAmount: input.amount,
          dailyUsageByGrantId: await postgresDailyUsageByGrantId(
            transaction,
            attribution,
            input.now,
          ),
          now: input.now,
        });

        if (!match.matched) {
          throw new Error(`Faucet grant rejected: ${match.reasons.join(", ")}`);
        }

        const updatedRows = await transaction<GrantRow[]>`
          update faucet_grants
          set
            remaining_numeric = remaining_numeric - ${input.amount},
            status = case
              when remaining_numeric - ${input.amount} = 0 then 'exhausted'
              else status
            end
          where id = ${match.grant.id}
            and status = 'active'
            and remaining_numeric >= ${input.amount}
            and expires_at > ${input.now?.toISOString() ?? new Date().toISOString()}
          returning
            id,
            app_id,
            channel_id,
            end_user_id,
            wallet_id,
            remaining_numeric::text as remaining,
            allowed_models,
            allowed_use_cases,
            daily_cap_numeric::text as daily_cap,
            expires_at,
            status
        `;
        const updatedGrant = updatedRows[0]
          ? mapGrantRow(updatedRows[0])
          : undefined;

        if (!updatedGrant) {
          throw new Error("Faucet grant could not be deducted atomically.");
        }

        await insertUsageEvent(transaction, input.usageEvent);
        await insertLedgerEntries(
          transaction,
          input.usageEvent.appId,
          input.ledgerEntries,
        );
        await completePostgresIdempotencyReservation(
          transaction,
          input.idempotency,
          input.usageEvent.id,
        );

        return {
          usageEvent: input.usageEvent,
          ledgerEntries: input.ledgerEntries,
          updatedGrant,
        };
      });
    },

    async recordProviderCostCall(input) {
      await sql.begin(async (transaction) => {
        await requirePostgresIdempotencyReservation(
          transaction,
          input.idempotency,
        );
        await insertUsageEvent(transaction, input.usageEvent);
        await insertLedgerEntries(
          transaction,
          input.usageEvent.appId,
          input.ledgerEntries,
        );
        await completePostgresIdempotencyReservation(
          transaction,
          input.idempotency,
          input.usageEvent.id,
        );
      });
    },

    async recordWalletBillableCall(input) {
      return sql.begin(async (transaction) => {
        await requirePostgresIdempotencyReservation(
          transaction,
          input.idempotency,
        );
        const lockedRows = await transaction<WalletRow[]>`
          select
            app_id,
            id,
            owner_type,
            owner_id,
            currency,
            balance_numeric::text as balance
          from wallets
          where app_id = ${input.usageEvent.appId}
            and id = ${input.walletId}
          for update
        `;
        const wallet = lockedRows[0] ? mapWalletRow(lockedRows[0]) : undefined;

        if (!wallet) {
          throw new Error("Wallet no longer exists.");
        }

        if (compareMoney(wallet.balance, input.amount) < 0) {
          throw new Error("Wallet balance is insufficient.");
        }

        const updatedRows = await transaction<WalletRow[]>`
          update wallets
          set balance_numeric = balance_numeric - ${input.amount}
          where app_id = ${input.usageEvent.appId}
            and id = ${input.walletId}
            and balance_numeric >= ${input.amount}
          returning
            app_id,
            id,
            owner_type,
            owner_id,
            currency,
            balance_numeric::text as balance
        `;
        const updatedWallet = updatedRows[0]
          ? mapWalletRow(updatedRows[0])
          : undefined;

        if (!updatedWallet) {
          throw new Error("Wallet could not be deducted atomically.");
        }

        await insertUsageEvent(transaction, input.usageEvent);
        await insertLedgerEntries(
          transaction,
          input.usageEvent.appId,
          input.ledgerEntries,
        );
        await completePostgresIdempotencyReservation(
          transaction,
          input.idempotency,
          input.usageEvent.id,
        );

        return {
          usageEvent: input.usageEvent,
          ledgerEntries: input.ledgerEntries,
          updatedWallet,
        };
      });
    },

    async listApps() {
      const rows = await sql<AdminAppRow[]>`
        select
          apps.id,
          apps.name,
          developers.name as developer,
          apps.status,
          routes.alias as default_route
        from apps
        join developers on developers.id = apps.developer_id
        left join routes
          on routes.app_id = apps.id
         and routes.id = apps.default_route_id
        order by apps.created_at desc, apps.id asc
      `;

      return rows.map(mapAdminAppRow);
    },

    async createApp(input) {
      await sql.begin(async (transaction) => {
        await transaction`
          insert into developers (id, name)
          values (${input.developerId}, ${input.developerName})
          on conflict (id) do update set
            name = excluded.name
        `;

        await transaction`
          insert into apps (
            id,
            developer_id,
            name,
            default_route_id,
            default_pricing_policy_id,
            status
          )
          values (
            ${input.id},
            ${input.developerId},
            ${input.name},
            ${input.defaultRouteId ?? null},
            ${input.defaultPricingPolicyId ?? null},
            ${input.status}
          )
        `;
      });

      const app = await getPostgresAdminApp(sql, input.id);

      if (!app) {
        throw new Error("App was not created.");
      }

      return app;
    },

    async updateApp(id, input) {
      const rows = await sql<Array<{ id: string }>>`
        update apps
        set
          name = coalesce(${input.name ?? null}, name),
          default_route_id = coalesce(${input.defaultRouteId ?? null}, default_route_id),
          default_pricing_policy_id = coalesce(${input.defaultPricingPolicyId ?? null}, default_pricing_policy_id),
          status = coalesce(${input.status ?? null}, status)
        where id = ${id}
        returning id
      `;

      if (rows.length === 0) {
        return undefined;
      }

      return getPostgresAdminApp(sql, id);
    },

    async listChannels() {
      const rows = await sql<AdminChannelRow[]>`
        select id, app_id, name, type, status
        from channels
        order by created_at desc, id asc
      `;

      return rows.map(mapAdminChannelRow);
    },

    async createChannel(input) {
      await sql`
        insert into channels (id, app_id, name, type, status)
        values (${input.id}, ${input.appId}, ${input.name}, ${input.type}, ${input.status})
      `;

      const channel = await getPostgresAdminChannel(sql, input.id);

      if (!channel) {
        throw new Error("Channel was not created.");
      }

      return channel;
    },

    async updateChannel(id, input) {
      const rows = await sql<Array<{ id: string }>>`
        update channels
        set
          name = coalesce(${input.name ?? null}, name),
          type = coalesce(${input.type ?? null}, type),
          status = coalesce(${input.status ?? null}, status)
        where id = ${id}
        returning id
      `;

      if (rows.length === 0) {
        return undefined;
      }

      return getPostgresAdminChannel(sql, id);
    },

    async listFaucetGrants() {
      const rows = await sql<GrantRow[]>`
        select
          id,
          app_id,
          channel_id,
          end_user_id,
          wallet_id,
          remaining_numeric::text as remaining,
          allowed_models,
          allowed_use_cases,
          daily_cap_numeric::text as daily_cap,
          expires_at,
          status
        from faucet_grants
        order by created_at desc, id asc
      `;

      return rows.map(mapGrantRow);
    },

    async createFaucetGrant(input) {
      await sql.begin(async (transaction) => {
        await transaction`
          insert into end_users (id, app_id, external_user_hash)
          values (${input.endUserId}, ${input.appId}, ${input.endUserId})
          on conflict (id) do update set
            external_user_hash = excluded.external_user_hash
        `;

        await transaction`
          insert into wallets (
            id,
            app_id,
            owner_type,
            owner_id,
            currency,
            balance_numeric
          )
          values (
            ${input.walletId},
            ${input.appId},
            'faucet_grant',
            ${input.id},
            'USD',
            0
          )
          on conflict (id) do update set
            app_id = excluded.app_id,
            owner_type = excluded.owner_type,
            owner_id = excluded.owner_id,
            currency = excluded.currency
        `;

        await transaction`
          insert into faucet_grants (
            id,
            sponsor_type,
            sponsor_id,
            app_id,
            channel_id,
            end_user_id,
            wallet_id,
            amount_numeric,
            remaining_numeric,
            allowed_models,
            allowed_use_cases,
            daily_cap_numeric,
            expires_at,
            status
          )
          values (
            ${input.id},
            ${input.sponsorType},
            ${input.sponsorId ?? null},
            ${input.appId},
            ${input.channelId},
            ${input.endUserId},
            ${input.walletId},
            ${input.amount},
            ${input.remaining},
            ${transaction.json(input.allowedModels)},
            ${transaction.json(input.allowedUseCases)},
            ${input.dailyCap},
            ${input.expiresAt},
            ${input.status}
          )
        `;
      });

      const grant = await getPostgresFaucetGrant(sql, input.id);

      if (!grant) {
        throw new Error("Faucet grant was not created.");
      }

      return grant;
    },

    async updateFaucetGrant(id, input) {
      const current = await getPostgresFaucetGrant(sql, id);

      if (!current) {
        return undefined;
      }

      const rows = await sql<GrantRow[]>`
        update faucet_grants
        set
          amount_numeric = coalesce(${input.amount ?? null}, amount_numeric),
          remaining_numeric = coalesce(${input.remaining ?? null}, remaining_numeric),
          allowed_models = ${sql.json(input.allowedModels ?? current.allowedModels)},
          allowed_use_cases = ${sql.json(input.allowedUseCases ?? current.allowedUseCases)},
          daily_cap_numeric = coalesce(${input.dailyCap ?? null}, daily_cap_numeric),
          expires_at = coalesce(${input.expiresAt ?? null}, expires_at),
          status = coalesce(${input.status ?? null}, status)
        where id = ${id}
        returning
          id,
          app_id,
          channel_id,
          end_user_id,
          wallet_id,
          remaining_numeric::text as remaining,
          allowed_models,
          allowed_use_cases,
          daily_cap_numeric::text as daily_cap,
          expires_at,
          status
      `;
      const row = rows[0];

      return row ? mapGrantRow(row) : undefined;
    },

    async listRoutes() {
      const rows = await sql<AdminRouteRow[]>`
        select id, app_id, alias, config, status
        from routes
        order by created_at desc, id asc
      `;

      return rows.map(mapAdminRouteRow);
    },

    async createRoute(input) {
      await sql`
        insert into routes (id, app_id, alias, config, status)
        values (
          ${input.id},
          ${input.appId},
          ${input.alias},
          ${sql.json(
            toJsonValue(
              routeConfigFromPolicy({
                adapter: input.adapter,
                alias: input.alias,
                appId: input.appId,
                fallbackModels: input.fallbackModels ?? [input.model],
                id: input.id,
                latencyPreference: input.latencyPreference,
                maxRetailPrice: input.maxRetailPrice,
                model: input.model,
                modelAllowlist: input.modelAllowlist,
                provider: input.provider,
                status: input.status,
              }),
            ),
          )},
          ${input.status}
        )
      `;

      const route = await getPostgresAdminRoute(sql, input.id);

      if (!route) {
        throw new Error("Route was not created.");
      }

      return route;
    },

    async updateRoute(id, input) {
      const rows = await sql<AdminRouteRow[]>`
        select id, app_id, alias, config, status
        from routes
        where id = ${id}
        limit 1
      `;
      const row = rows[0];

      if (!row) {
        return undefined;
      }

      const current = mapRoutePolicyRow(row);
      const model = input.model ?? current.model;
      const updated: GatewayRoutePolicyRecord = {
        ...current,
        adapter: input.adapter ?? current.adapter,
        alias: input.alias ?? current.alias,
        appId: input.appId ?? current.appId,
        fallbackModels: input.fallbackModels
          ? [...input.fallbackModels]
          : [...current.fallbackModels],
        latencyPreference: input.latencyPreference ?? current.latencyPreference,
        maxRetailPrice: input.maxRetailPrice ?? current.maxRetailPrice,
        model,
        modelAllowlist: input.modelAllowlist
          ? [...input.modelAllowlist]
          : [...current.modelAllowlist],
        provider: input.provider ?? current.provider,
        status: input.status ?? current.status,
      };

      await sql`
        update routes
        set
          app_id = ${updated.appId},
          alias = ${updated.alias},
          config = ${sql.json(toJsonValue(routeConfigFromPolicy(updated)))},
          status = ${updated.status}
        where id = ${id}
      `;

      return getPostgresAdminRoute(sql, id);
    },

    async listProviderCredentials() {
      const rows = await sql<AdminCredentialRow[]>`
        select
          app_id,
          id,
          owner_type,
          owner_id,
          provider,
          encrypted_api_key,
          key_version,
          display,
          budget_daily_numeric::text as budget_daily,
          budget_monthly_numeric::text as budget_monthly,
          status
        from provider_credentials
        order by created_at desc, id asc
      `;

      if (rows.length === 0) {
        return [{ ...defaultCredential }];
      }

      return rows.map((row) =>
        mapProviderCredentialRecord({
          appId: row.app_id,
          id: row.id,
          ownerType: row.owner_type,
          ownerId: row.owner_id,
          provider: row.provider,
          encryptedApiKey: row.encrypted_api_key,
          keyVersion: row.key_version,
          display: row.display,
          status:
            row.status === "revoked" || row.status === "active"
              ? row.status
              : "revoked",
          budgetDaily: row.budget_daily ?? undefined,
          budgetMonthly: row.budget_monthly ?? undefined,
          createdAt: new Date().toISOString(),
        }),
      );
    },

    async createProviderCredential(input) {
      const rows = await sql<AdminCredentialRow[]>`
        insert into provider_credentials (
          id,
          app_id,
          owner_type,
          owner_id,
          provider,
          encrypted_api_key,
          key_version,
          display,
          budget_daily_numeric,
          budget_monthly_numeric,
          status
        )
        values (
          ${input.id},
          ${input.appId},
          ${input.ownerType},
          ${input.ownerId},
          ${input.provider},
          ${input.encryptedApiKey},
          ${input.keyVersion},
          ${input.display},
          ${input.budgetDaily ?? null},
          ${input.budgetMonthly ?? null},
          'active'
        )
        returning
          app_id,
          id,
          owner_type,
          owner_id,
          provider,
          encrypted_api_key,
          key_version,
          display,
          budget_daily_numeric::text as budget_daily,
          budget_monthly_numeric::text as budget_monthly,
          status
      `;
      const row = rows[0];

      if (!row) {
        throw new Error("Provider credential was not created.");
      }

      return mapProviderCredentialRecord({
        appId: row.app_id,
        id: row.id,
        ownerType: row.owner_type,
        ownerId: row.owner_id,
        provider: row.provider,
        encryptedApiKey: row.encrypted_api_key,
        keyVersion: row.key_version,
        display: row.display,
        status: row.status === "active" ? "active" : "revoked",
        budgetDaily: row.budget_daily ?? undefined,
        budgetMonthly: row.budget_monthly ?? undefined,
        createdAt: new Date().toISOString(),
      });
    },

    async rotateProviderCredential(input) {
      const rows = await sql<AdminCredentialRow[]>`
        update provider_credentials
        set
          encrypted_api_key = ${input.encryptedApiKey},
          key_version = ${input.keyVersion},
          display = ${input.display},
          status = 'active'
        where id = ${input.id}
        returning
          app_id,
          id,
          owner_type,
          owner_id,
          provider,
          encrypted_api_key,
          key_version,
          display,
          budget_daily_numeric::text as budget_daily,
          budget_monthly_numeric::text as budget_monthly,
          status
      `;
      const row = rows[0];

      return row
        ? mapProviderCredentialRecord({
            appId: row.app_id,
            id: row.id,
            ownerType: row.owner_type,
            ownerId: row.owner_id,
            provider: row.provider,
            encryptedApiKey: row.encrypted_api_key,
            keyVersion: row.key_version,
            display: row.display,
            status: row.status === "active" ? "active" : "revoked",
            budgetDaily: row.budget_daily ?? undefined,
            budgetMonthly: row.budget_monthly ?? undefined,
            createdAt: new Date().toISOString(),
          })
        : undefined;
    },

    async deleteProviderCredential(id) {
      const rows = await sql<Array<{ id: string }>>`
        delete from provider_credentials
        where id = ${id}
        returning id
      `;

      return rows.length > 0;
    },

    async listPricingPolicies() {
      const rows = await sql<AdminPricingPolicyRow[]>`
        select
          id,
          app_id,
          platform_fee_rate::text as platform_fee_rate,
          payment_fee_reserve_rate::text as payment_fee_reserve_rate,
          risk_reserve_rate::text as risk_reserve_rate,
          developer_markup_rate::text as developer_markup_rate,
          channel_markup_rate::text as channel_markup_rate,
          max_total_markup_rate::text as max_total_markup_rate
        from pricing_policies
        order by created_at desc, id asc
      `;

      return rows.map(mapAdminPricingPolicyRow);
    },

    async createPricingPolicy(input) {
      await sql`
        insert into pricing_policies (
          id,
          app_id,
          name,
          platform_fee_rate,
          payment_fee_reserve_rate,
          risk_reserve_rate,
          developer_markup_rate,
          channel_markup_rate,
          max_total_markup_rate
        )
        values (
          ${input.id},
          ${input.appId},
          ${input.name},
          ${input.platformFeeRate},
          ${input.paymentFeeReserveRate},
          ${input.riskReserveRate},
          ${input.developerMarkupRate},
          ${input.channelMarkupRate},
          ${input.maxTotalMarkupRate}
        )
      `;

      const policy = await getPostgresAdminPricingPolicy(sql, input.id);

      if (!policy) {
        throw new Error("Pricing policy was not created.");
      }

      return policy;
    },

    async updatePricingPolicy(id, input) {
      const rows = await sql<Array<{ id: string }>>`
        update pricing_policies
        set
          app_id = coalesce(${input.appId ?? null}, app_id),
          name = coalesce(${input.name ?? null}, name),
          platform_fee_rate = coalesce(${input.platformFeeRate ?? null}, platform_fee_rate),
          payment_fee_reserve_rate = coalesce(${input.paymentFeeReserveRate ?? null}, payment_fee_reserve_rate),
          risk_reserve_rate = coalesce(${input.riskReserveRate ?? null}, risk_reserve_rate),
          developer_markup_rate = coalesce(${input.developerMarkupRate ?? null}, developer_markup_rate),
          channel_markup_rate = coalesce(${input.channelMarkupRate ?? null}, channel_markup_rate),
          max_total_markup_rate = coalesce(${input.maxTotalMarkupRate ?? null}, max_total_markup_rate)
        where id = ${id}
        returning id
      `;

      if (rows.length === 0) {
        return undefined;
      }

      return getPostgresAdminPricingPolicy(sql, id);
    },

    async listUsageEvents() {
      const rows = await sql<UsageEventRow[]>`
        select
          id,
          request_id,
          app_id,
          channel_id,
          end_user_id,
          mode,
          provider,
          model,
          route_id,
          use_case,
          input_tokens,
          output_tokens,
          cached_input_tokens,
          usage_estimated,
          upstream_cost_numeric::text as upstream_cost,
          wholesale_price_numeric::text as wholesale_price,
          retail_price_numeric::text as retail_price,
          faucet_grant_id,
          status,
          created_at
        from usage_events
        order by created_at desc
      `;

      return rows.map(mapUsageEventRow);
    },

    async listLedgerEntries() {
      const rows = await sql<LedgerEntryRow[]>`
        select
          id,
          usage_event_id,
          wallet_id,
          direction,
          amount_numeric::text as amount,
          reason,
          metadata,
          created_at
        from ledger_entries
        order by created_at desc, id asc
      `;

      return rows.map(mapLedgerEntryRow);
    },

    async purgeExpiredRequestMetadata(input) {
      const retention = createRequestMetadataRetentionWindow(input);
      const rows = await sql<Array<{ id: string }>>`
        update ledger_entries
        set metadata = '{}'::jsonb
        where created_at < ${retention.cutoffIso}
          and metadata is not null
          and metadata <> '{}'::jsonb
        returning id
      `;

      return {
        cutoff: retention.cutoffIso,
        ledgerEntriesUpdated: countRows(rows),
        retentionDays: retention.retentionDays,
      };
    },

    async anonymizeEndUser(input) {
      const tombstoneEndUserId = createDeletedEndUserId(input);
      const nowIso = (input.now ?? new Date()).toISOString();

      return sql.begin(async (transaction) => {
        await transaction`
          insert into end_users (
            id,
            app_id,
            external_user_hash
          )
          values (
            ${tombstoneEndUserId},
            ${input.appId},
            ${tombstoneEndUserId}
          )
          on conflict (id) do update set
            external_user_hash = excluded.external_user_hash
        `;

        const sessions = await transaction<Array<{ id: string }>>`
          update sessions
          set
            end_user_id = ${tombstoneEndUserId},
            revoked_at = coalesce(revoked_at, ${nowIso})
          where app_id = ${input.appId}
            and end_user_id = ${input.endUserId}
          returning id
        `;
        const grantStats = await transaction<
          Array<{ anonymized: number | string; revoked: number | string }>
        >`
          with target as (
            select id, status
            from faucet_grants
            where app_id = ${input.appId}
              and end_user_id = ${input.endUserId}
          ),
          updated as (
            update faucet_grants
            set
              end_user_id = ${tombstoneEndUserId},
              status = case
                when faucet_grants.status = 'active' then 'revoked'
                else faucet_grants.status
              end
            from target
            where faucet_grants.id = target.id
            returning target.status as previous_status
          )
          select
            count(*)::int as anonymized,
            count(*) filter (where previous_status = 'active')::int as revoked
          from updated
        `;
        const usageEvents = await transaction<Array<{ id: string }>>`
          update usage_events
          set end_user_id = ${tombstoneEndUserId}
          where app_id = ${input.appId}
            and end_user_id = ${input.endUserId}
          returning id
        `;
        const ledgerEntries = await transaction<Array<{ id: string }>>`
          update ledger_entries
          set metadata = metadata || jsonb_build_object('endUserId', ${tombstoneEndUserId})
          where app_id = ${input.appId}
            and metadata ->> 'endUserId' = ${input.endUserId}
          returning id
        `;
        const wallets = await transaction<Array<{ id: string }>>`
          update wallets
          set owner_id = ${tombstoneEndUserId}
          where app_id = ${input.appId}
            and owner_type = 'end_user'
            and owner_id = ${input.endUserId}
          returning id
        `;
        const providerCredentials = await transaction<Array<{ id: string }>>`
          update provider_credentials
          set
            owner_id = ${tombstoneEndUserId},
            status = 'revoked'
          where app_id = ${input.appId}
            and owner_type = 'end_user'
            and owner_id = ${input.endUserId}
          returning id
        `;
        const endUsers = await transaction<Array<{ id: string }>>`
          delete from end_users
          where id = ${input.endUserId}
            and app_id = ${input.appId}
          returning id
        `;
        const stats = grantStats[0];

        return {
          appId: input.appId,
          endUserRecordsDeleted: countRows(endUsers),
          faucetGrantsAnonymized: Number(stats?.anonymized ?? 0),
          faucetGrantsRevoked: Number(stats?.revoked ?? 0),
          ledgerEntriesScrubbed: countRows(ledgerEntries),
          providerCredentialsRevoked: countRows(providerCredentials),
          sessionsRevoked: countRows(sessions),
          tombstoneEndUserId,
          usageEventsAnonymized: countRows(usageEvents),
          walletsAnonymized: countRows(wallets),
        };
      });
    },
  };
}
