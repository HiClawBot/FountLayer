import {
  calculateDailyGrantUsage,
  findMatchingFaucetGrant,
  type FaucetRejectionReason,
} from "@fountlayer/faucet";
import type { FountLayerSql, FountLayerTransactionSql } from "@fountlayer/db";
import type { LedgerEntryRecord, UsageEventRecord } from "@fountlayer/ledger";
import type { AttributionContext } from "@fountlayer/protocol";

export type GatewayAppRecord = {
  id: string;
  status: "active" | "disabled";
  defaultRouteId: string;
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

export type GatewayAdminChannelRecord = {
  id: string;
  appId: string;
  name: string;
  type: string;
  status: string;
};

export type GatewayAdminRouteRecord = {
  id: string;
  alias: string;
  provider: string;
  model: string;
  adapter: string;
  status: string;
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
  id: string;
  owner: string;
  provider: string;
  storage: string;
  status: string;
  display: string;
};

export type GatewayProviderCredentialRecord = {
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

export type GatewaySessionRecord = {
  id: string;
  tokenHash: string;
  attribution: AttributionContext;
  expiresAt: string;
  revokedAt?: string;
  createdAt: string;
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

export type BillableCallRecord = {
  grantId: string;
  amount: string;
  usageEvent: UsageEventRecord;
  ledgerEntries: LedgerEntryRecord[];
  now?: Date;
};

export type BillableCallRecordResult = {
  usageEvent: UsageEventRecord;
  ledgerEntries: LedgerEntryRecord[];
  updatedGrant: GatewayGrantRecord;
};

export type GatewayStore = {
  createSession(input: {
    id: string;
    tokenHash: string;
    attribution: AttributionContext;
    expiresAt: string;
    createdAt?: string;
  }): Promise<GatewaySessionRecord>;
  getActiveSessionByTokenHash(
    tokenHash: string,
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
  recordBillableCall(
    input: BillableCallRecord,
  ): Promise<BillableCallRecordResult>;
  listApps(): Promise<GatewayAdminAppRecord[]>;
  listChannels(): Promise<GatewayAdminChannelRecord[]>;
  listFaucetGrants(): Promise<GatewayGrantRecord[]>;
  listRoutes(): Promise<GatewayAdminRouteRecord[]>;
  listProviderCredentials(): Promise<GatewayAdminCredentialRecord[]>;
  createProviderCredential(
    input: GatewayProviderCredentialWriteInput,
  ): Promise<GatewayAdminCredentialRecord>;
  rotateProviderCredential(
    input: GatewayProviderCredentialRotateInput,
  ): Promise<GatewayAdminCredentialRecord | undefined>;
  deleteProviderCredential(id: string): Promise<boolean>;
  listPricingPolicies(): Promise<GatewayAdminPricingPolicyRecord[]>;
  listUsageEvents(): Promise<UsageEventRecord[]>;
  listLedgerEntries(): Promise<LedgerEntryRecord[]>;
};

export type InMemoryGatewayState = {
  apps: Map<string, GatewayAppRecord>;
  channels: Map<string, GatewayChannelRecord>;
  faucetGrants: GatewayGrantRecord[];
  providerCredentials: GatewayProviderCredentialRecord[];
  routePolicies: GatewayRoutePolicyRecord[];
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

const defaultGrant: GatewayGrantRecord = {
  id: "grant_new_user",
  appId: "app_pdf_reader",
  channelId: "channel_desktop",
  endUserId: "user_hash_123",
  walletId: "wallet_faucet_new_user",
  remaining: "1.00000000",
  allowedModels: ["vertical/paper-summary", "demo-local-model"],
  allowedUseCases: ["paper_summary"],
  dailyCap: "0.25000000",
  expiresAt: "2026-07-17T00:00:00Z",
  status: "active",
};

export function createDefaultInMemoryGatewayState(): InMemoryGatewayState {
  return {
    apps: new Map([[defaultApp.id, { ...defaultApp }]]),
    channels: new Map([[defaultChannel.id, { ...defaultChannel }]]),
    faucetGrants: [
      {
        ...defaultGrant,
        allowedModels: [...defaultGrant.allowedModels],
        allowedUseCases: [...defaultGrant.allowedUseCases],
      },
    ],
    providerCredentials: [],
    routePolicies: [
      {
        ...defaultRoutePolicy,
        fallbackModels: [...defaultRoutePolicy.fallbackModels],
        modelAllowlist: [...defaultRoutePolicy.modelAllowlist],
      },
    ],
    usageEvents: [],
    ledgerEntries: [],
    sessions: [],
  };
}

function money(value: number): string {
  return Math.max(0, value).toFixed(8);
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

function percent(value: string): string {
  return `${Number(value) * 100}%`;
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
    id: credential.id,
    owner: `${credential.ownerType}:${credential.ownerId}`,
    provider: credential.provider,
    storage: `server-side encrypted:${credential.keyVersion}`,
    status: credential.status,
    display: credential.display,
  };
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
      Number(grant.remaining) > 0 &&
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

export function createInMemoryGatewayStore(
  state: InMemoryGatewayState = createDefaultInMemoryGatewayState(),
): GatewayStore {
  return {
    async createSession(input) {
      const session: GatewaySessionRecord = {
        id: input.id,
        tokenHash: input.tokenHash,
        attribution: input.attribution,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt ?? new Date().toISOString(),
      };

      state.sessions.push(session);
      return session;
    },

    async getActiveSessionByTokenHash(tokenHash, now = new Date()) {
      return state.sessions.find(
        (session) =>
          session.tokenHash === tokenHash &&
          !session.revokedAt &&
          Date.parse(session.expiresAt) > now.getTime(),
      );
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

    async recordBillableCall(input) {
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

      const remaining = Number(grant.remaining) - Number(input.amount);
      const updatedGrant: GatewayGrantRecord = {
        ...grant,
        remaining: money(remaining),
        status: remaining === 0 ? "exhausted" : grant.status,
      };
      const index = state.faucetGrants.findIndex(
        (candidate) => candidate.id === grant.id,
      );

      state.faucetGrants[index] = updatedGrant;
      state.usageEvents.push(input.usageEvent);
      state.ledgerEntries.push(...input.ledgerEntries);

      return {
        usageEvent: input.usageEvent,
        ledgerEntries: input.ledgerEntries,
        updatedGrant,
      };
    },

    async listApps() {
      return [{ ...defaultAdminApp }];
    },

    async listChannels() {
      return [{ ...defaultAdminChannel }];
    },

    async listFaucetGrants() {
      return state.faucetGrants;
    },

    async listRoutes() {
      return state.routePolicies.map((route) => ({
        id: route.id,
        alias: route.alias,
        provider: route.provider,
        model: route.model,
        adapter: route.adapter,
        status: route.status,
      }));
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
      return [{ ...defaultPricingPolicy }];
    },

    async listUsageEvents() {
      return state.usageEvents;
    },

    async listLedgerEntries() {
      return state.ledgerEntries;
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
  ledgerEntries: LedgerEntryRecord[],
): Promise<void> {
  for (const entry of ledgerEntries) {
    await sql`
      insert into ledger_entries (
        id,
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
    async createSession(input) {
      const rows = await sql<SessionRow[]>`
        with upsert_end_user as (
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
          returning id
        )
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

      return mapSessionRow(row);
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

    async getActiveApp(id) {
      const rows = await sql<
        Array<{
          id: string;
          status: GatewayAppRecord["status"];
          default_route_id: string | null;
        }>
      >`
        select id, status, default_route_id
        from apps
        where id = ${id} and status = 'active'
        limit 1
      `;
      const row = rows[0];

      return row
        ? {
            id: row.id,
            status: row.status,
            defaultRouteId: row.default_route_id ?? "route_default",
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

    async recordBillableCall(input) {
      return sql.begin(async (transaction) => {
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
        await insertLedgerEntries(transaction, input.ledgerEntries);

        return {
          usageEvent: input.usageEvent,
          ledgerEntries: input.ledgerEntries,
          updatedGrant,
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
        left join routes on routes.id = apps.default_route_id
        order by apps.created_at desc, apps.id asc
      `;

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        developer: row.developer,
        status: row.status,
        defaultRoute: row.default_route ?? "not configured",
      }));
    },

    async listChannels() {
      const rows = await sql<AdminChannelRow[]>`
        select id, app_id, name, type, status
        from channels
        order by created_at desc, id asc
      `;

      return rows.map((row) => ({
        id: row.id,
        appId: row.app_id,
        name: row.name,
        type: row.type,
        status: row.status,
      }));
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

    async listRoutes() {
      const rows = await sql<AdminRouteRow[]>`
        select id, app_id, alias, config, status
        from routes
        order by created_at desc, id asc
      `;

      return rows.map(mapAdminRouteRow);
    },

    async listProviderCredentials() {
      const rows = await sql<AdminCredentialRow[]>`
        select
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
  };
}
