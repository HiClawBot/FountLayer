import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";

import {
  type AdapterChatOutput,
  type LLMAdapter,
  estimateAdapterUsage,
} from "@fountlayer/adapter-core";
import { type CredentialCipher, maskCredential } from "@fountlayer/credentials";
import {
  createBalancedLedgerEntries,
  createUsageEvent,
} from "@fountlayer/ledger";
import {
  createTelemetryEvent,
  createTelemetryMetric,
  createTelemetrySpan,
  type TelemetrySink,
} from "@fountlayer/observability";
import {
  demoModelPrices,
  estimateChatTokens,
  findModelPrice,
  priceByokRequest,
  priceLocalRequest,
  priceManagedRequest,
} from "@fountlayer/pricing";
import {
  type AttributionContext,
  chatRequestSchema,
  parseAttributionHeaders,
  sessionRequestSchema,
} from "@fountlayer/protocol";
import {
  CircuitOpenError,
  type CircuitBreaker,
  type RetryOptions,
  executeWithCircuitBreaker,
  executeWithRetry,
} from "@fountlayer/reliability";

import {
  createInMemoryGatewayStore,
  type GatewayAdminAppCreateInput,
  type GatewayAdminAppUpdateInput,
  type GatewayAdminChannelCreateInput,
  type GatewayAdminChannelUpdateInput,
  type GatewayAdminPricingPolicyCreateInput,
  type GatewayAdminPricingPolicyUpdateInput,
  type GatewayAdminRouteCreateInput,
  type GatewayAdminRouteUpdateInput,
  type GatewayFaucetGrantCreateInput,
  type GatewayFaucetGrantUpdateInput,
  type GatewayGrantRecord,
  type GatewayRoutePolicyRecord,
  type GatewaySessionRecord,
  type GatewayStore,
  type GatewayWalletRecord,
} from "./store.js";

type AuthContext = {
  sessionId: string;
  tokenHash: string;
  expiresAt: string;
  scheme: "Bearer";
};

type AdminAuthContext = {
  tokenHash: string;
  scheme: "Bearer";
};

type ParsedAuthorization = {
  token: string;
  scheme: "Bearer";
};

type GatewayServerOptions = {
  logger?: boolean;
  allowHostedByokCredentials?: boolean;
  adapter?: LLMAdapter;
  adapterCircuitBreaker?: CircuitBreaker;
  adapterRetry?: RetryOptions;
  adminTokenHashes?: readonly string[];
  credentialCipher?: CredentialCipher;
  dependencyHealthChecks?: Record<string, GatewayDependencyHealthCheck>;
  privacy?: GatewayPrivacyOptions;
  rateLimits?: GatewayRateLimitOptions;
  telemetrySink?: TelemetrySink;
};

export type GatewayRateLimitOptions = {
  billableWindowMs?: number;
  endUserBillableRequestsPerWindow?: number;
  sessionBillableRequestsPerWindow?: number;
};

export type GatewayPrivacyOptions = {
  requestMetadataRetentionDays?: number;
};

export type GatewayDependencyHealthCheck = () => Promise<void>;

type GatewayDependencyHealthResult = {
  component?: string;
  name: string;
  status: "error" | "ok";
};

declare module "fastify" {
  interface FastifyRequest {
    attribution?: AttributionContext;
    auth?: AuthContext;
    adminAuth?: AdminAuthContext;
  }
}

const defaultWallets = {
  payerWalletId: "wallet_faucet_new_user",
  platformRevenueWalletId: "wallet_platform_revenue",
  platformCostWalletId: "wallet_platform_cost",
  providerPayableWalletId: "wallet_provider_payable",
};

const defaultRateLimits = {
  billableWindowMs: 60 * 60 * 1000,
  endUserBillableRequestsPerWindow: 120,
  sessionBillableRequestsPerWindow: 60,
};

type RateLimitScope = "session" | "end_user";

type RateLimitDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      limit: number;
      remaining: number;
      resetAt: number;
      scope: RateLimitScope;
    };

type RateLimitCounter = {
  count: number;
  resetAt: number;
};

type ChatCompletionResponse = {
  billing: {
    currency: string;
    faucet_remaining?: string;
    ledger_entry_count: number;
    paid_by: "faucet_grant" | "wallet";
    retail_price: string;
    upstream_cost: string;
    usage_event_id: string;
    wallet_balance?: string;
  };
  choices: Array<{
    finish_reason: string;
    index: number;
    message: {
      content: string;
      role: "assistant";
    };
  }>;
  id: string;
  model: string;
  object: "chat.completion";
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
};

type PaymentSource =
  | {
      type: "faucet_grant";
      grant: GatewayGrantRecord;
    }
  | {
      type: "wallet";
      wallet: GatewayWalletRecord;
    };

type ProviderCredentialCreateBody = {
  apiKey: string;
  budgetDaily?: string;
  budgetMonthly?: string;
  ownerId: string;
  ownerType: string;
  provider: string;
};

type ProviderCredentialRotateBody = {
  apiKey: string;
};

type AdminWriteStatus = "active" | "disabled";
type FaucetGrantStatus = "active" | "exhausted" | "expired" | "revoked";

type PrivacyEndUserAnonymizeBody = {
  appId: string;
  endUserId: string;
};

type AdminListFilter<T> = {
  query: string;
  read: (item: T) => unknown;
};

type AdminListPage = {
  limit: number;
  offset: number;
  returned: number;
  total: number;
};

type AdminListResult<T> = {
  items: T[];
  page: AdminListPage;
};

function recordFromBody(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function requiredBodyString(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function optionalBodyString(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string.`);
  }

  return value.trim();
}

function optionalMoneyString(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !/^\d+(\.\d{1,8})?$/.test(value)) {
    throw new Error(`${key} must be a decimal string with up to 8 places.`);
  }

  return value;
}

function requiredMoneyString(body: Record<string, unknown>, key: string) {
  const value = optionalMoneyString(body, key);

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function optionalDecimalString(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = body[key];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !/^\d+(\.\d{1,8})?$/.test(value)) {
    throw new Error(`${key} must be a decimal string with up to 8 places.`);
  }

  return value;
}

function requiredStringArray(
  body: Record<string, unknown>,
  key: string,
): string[] {
  const value = body[key];

  if (!Array.isArray(value)) {
    throw new Error(`${key} must be a non-empty string array.`);
  }

  const strings = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);

  if (strings.length !== value.length || strings.length === 0) {
    throw new Error(`${key} must be a non-empty string array.`);
  }

  return strings;
}

function optionalStringArray(
  body: Record<string, unknown>,
  key: string,
): string[] | undefined {
  return body[key] === undefined ? undefined : requiredStringArray(body, key);
}

function optionalAdminStatus(
  body: Record<string, unknown>,
  key: string,
): AdminWriteStatus | undefined {
  const value = optionalBodyString(body, key);

  if (value === undefined) {
    return undefined;
  }

  if (value !== "active" && value !== "disabled") {
    throw new Error(`${key} must be active or disabled.`);
  }

  return value;
}

function optionalFaucetGrantStatus(
  body: Record<string, unknown>,
  key: string,
): FaucetGrantStatus | undefined {
  const value = optionalBodyString(body, key);

  if (value === undefined) {
    return undefined;
  }

  if (
    value !== "active" &&
    value !== "exhausted" &&
    value !== "expired" &&
    value !== "revoked"
  ) {
    throw new Error(`${key} must be active, exhausted, expired, or revoked.`);
  }

  return value;
}

function optionalDateString(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = optionalBodyString(body, key);

  if (value === undefined) {
    return undefined;
  }

  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${key} must be a valid date string.`);
  }

  return new Date(value).toISOString();
}

function requiredDateString(body: Record<string, unknown>, key: string) {
  const value = optionalDateString(body, key);

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function hasWriteFields(value: Record<string, unknown>): boolean {
  return Object.values(value).some((item) => item !== undefined);
}

function parseProviderCredentialCreateBody(
  value: unknown,
): ProviderCredentialCreateBody | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const ownerType = requiredBodyString(body, "ownerType");
  const ownerId = requiredBodyString(body, "ownerId");
  const provider = requiredBodyString(body, "provider");
  const apiKey = requiredBodyString(body, "apiKey");

  if (!ownerType || !ownerId || !provider || !apiKey) {
    return undefined;
  }

  return {
    apiKey,
    budgetDaily: optionalMoneyString(body, "budgetDaily"),
    budgetMonthly: optionalMoneyString(body, "budgetMonthly"),
    ownerId,
    ownerType,
    provider,
  };
}

function parseProviderCredentialRotateBody(
  value: unknown,
): ProviderCredentialRotateBody | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const apiKey = requiredBodyString(body, "apiKey");

  if (!apiKey) {
    return undefined;
  }

  return {
    apiKey,
  };
}

function parseAdminAppCreateBody(
  value: unknown,
): GatewayAdminAppCreateInput | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const developerId = requiredBodyString(body, "developerId");
  const developerName = requiredBodyString(body, "developerName");
  const id = requiredBodyString(body, "id");
  const name = requiredBodyString(body, "name");

  if (!developerId || !developerName || !id || !name) {
    return undefined;
  }

  return {
    defaultPricingPolicyId: optionalBodyString(body, "defaultPricingPolicyId"),
    defaultRouteId: optionalBodyString(body, "defaultRouteId"),
    developerId,
    developerName,
    id,
    name,
    status: optionalAdminStatus(body, "status") ?? "active",
  };
}

function parseAdminAppUpdateBody(
  value: unknown,
): GatewayAdminAppUpdateInput | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const input: GatewayAdminAppUpdateInput = {
    defaultPricingPolicyId: optionalBodyString(body, "defaultPricingPolicyId"),
    defaultRouteId: optionalBodyString(body, "defaultRouteId"),
    name: optionalBodyString(body, "name"),
    status: optionalAdminStatus(body, "status"),
  };

  return hasWriteFields(input) ? input : undefined;
}

function parseAdminChannelCreateBody(
  value: unknown,
): GatewayAdminChannelCreateInput | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const appId = requiredBodyString(body, "appId");
  const id = requiredBodyString(body, "id");
  const name = requiredBodyString(body, "name");
  const type = requiredBodyString(body, "type");

  if (!appId || !id || !name || !type) {
    return undefined;
  }

  return {
    appId,
    id,
    name,
    status: optionalAdminStatus(body, "status") ?? "active",
    type,
  };
}

function parseAdminChannelUpdateBody(
  value: unknown,
): GatewayAdminChannelUpdateInput | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const input: GatewayAdminChannelUpdateInput = {
    name: optionalBodyString(body, "name"),
    status: optionalAdminStatus(body, "status"),
    type: optionalBodyString(body, "type"),
  };

  return hasWriteFields(input) ? input : undefined;
}

function parseAdminRouteCreateBody(
  value: unknown,
): GatewayAdminRouteCreateInput | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const adapter = requiredBodyString(body, "adapter");
  const alias = requiredBodyString(body, "alias");
  const appId = requiredBodyString(body, "appId");
  const id = requiredBodyString(body, "id");
  const model = requiredBodyString(body, "model");
  const provider = requiredBodyString(body, "provider");

  if (!adapter || !alias || !appId || !id || !model || !provider) {
    return undefined;
  }

  return {
    adapter,
    alias,
    appId,
    fallbackModels: optionalStringArray(body, "fallbackModels"),
    id,
    latencyPreference: optionalBodyString(body, "latencyPreference"),
    maxRetailPrice: optionalMoneyString(body, "maxRetailPrice"),
    model,
    modelAllowlist: requiredStringArray(body, "modelAllowlist"),
    provider,
    status: optionalAdminStatus(body, "status") ?? "active",
  };
}

function parseAdminRouteUpdateBody(
  value: unknown,
): GatewayAdminRouteUpdateInput | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const input: GatewayAdminRouteUpdateInput = {
    adapter: optionalBodyString(body, "adapter"),
    alias: optionalBodyString(body, "alias"),
    appId: optionalBodyString(body, "appId"),
    fallbackModels: optionalStringArray(body, "fallbackModels"),
    latencyPreference: optionalBodyString(body, "latencyPreference"),
    maxRetailPrice: optionalMoneyString(body, "maxRetailPrice"),
    model: optionalBodyString(body, "model"),
    modelAllowlist: optionalStringArray(body, "modelAllowlist"),
    provider: optionalBodyString(body, "provider"),
    status: optionalAdminStatus(body, "status"),
  };

  return hasWriteFields(input) ? input : undefined;
}

function parseFaucetGrantCreateBody(
  value: unknown,
): GatewayFaucetGrantCreateInput | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const appId = requiredBodyString(body, "appId");
  const channelId = requiredBodyString(body, "channelId");
  const endUserId = requiredBodyString(body, "endUserId");
  const id = requiredBodyString(body, "id");
  const remaining = requiredMoneyString(body, "remaining");

  if (!appId || !channelId || !endUserId || !id) {
    return undefined;
  }

  return {
    allowedModels: requiredStringArray(body, "allowedModels"),
    allowedUseCases: requiredStringArray(body, "allowedUseCases"),
    amount: optionalMoneyString(body, "amount") ?? remaining,
    appId,
    channelId,
    dailyCap: requiredMoneyString(body, "dailyCap"),
    endUserId,
    expiresAt: requiredDateString(body, "expiresAt"),
    id,
    remaining,
    sponsorId: optionalBodyString(body, "sponsorId"),
    sponsorType: optionalBodyString(body, "sponsorType") ?? "platform",
    status: optionalFaucetGrantStatus(body, "status") ?? "active",
    walletId: optionalBodyString(body, "walletId") ?? `wallet_${id}`,
  };
}

function parseFaucetGrantUpdateBody(
  value: unknown,
): GatewayFaucetGrantUpdateInput | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const input: GatewayFaucetGrantUpdateInput = {
    allowedModels: optionalStringArray(body, "allowedModels"),
    allowedUseCases: optionalStringArray(body, "allowedUseCases"),
    amount: optionalMoneyString(body, "amount"),
    dailyCap: optionalMoneyString(body, "dailyCap"),
    expiresAt: optionalDateString(body, "expiresAt"),
    remaining: optionalMoneyString(body, "remaining"),
    status: optionalFaucetGrantStatus(body, "status"),
  };

  return hasWriteFields(input) ? input : undefined;
}

function parsePricingPolicyCreateBody(
  value: unknown,
): GatewayAdminPricingPolicyCreateInput | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const id = requiredBodyString(body, "id");
  const name = requiredBodyString(body, "name");

  if (!id || !name) {
    return undefined;
  }

  return {
    appId: optionalBodyString(body, "appId"),
    channelMarkupRate:
      optionalDecimalString(body, "channelMarkupRate") ?? "0.000000",
    developerMarkupRate:
      optionalDecimalString(body, "developerMarkupRate") ?? "0.000000",
    id,
    maxTotalMarkupRate:
      optionalDecimalString(body, "maxTotalMarkupRate") ?? "1.000000",
    name,
    paymentFeeReserveRate:
      optionalDecimalString(body, "paymentFeeReserveRate") ?? "0.030000",
    platformFeeRate:
      optionalDecimalString(body, "platformFeeRate") ?? "0.250000",
    riskReserveRate:
      optionalDecimalString(body, "riskReserveRate") ?? "0.050000",
  };
}

function parsePricingPolicyUpdateBody(
  value: unknown,
): GatewayAdminPricingPolicyUpdateInput | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const input: GatewayAdminPricingPolicyUpdateInput = {
    appId: optionalBodyString(body, "appId"),
    channelMarkupRate: optionalDecimalString(body, "channelMarkupRate"),
    developerMarkupRate: optionalDecimalString(body, "developerMarkupRate"),
    maxTotalMarkupRate: optionalDecimalString(body, "maxTotalMarkupRate"),
    name: optionalBodyString(body, "name"),
    paymentFeeReserveRate: optionalDecimalString(body, "paymentFeeReserveRate"),
    platformFeeRate: optionalDecimalString(body, "platformFeeRate"),
    riskReserveRate: optionalDecimalString(body, "riskReserveRate"),
  };

  return hasWriteFields(input) ? input : undefined;
}

function parseRetentionDays(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 3650) {
    throw new Error("retentionDays must be an integer from 0 to 3650.");
  }

  return parsed;
}

function parsePrivacyEndUserAnonymizeBody(
  value: unknown,
): PrivacyEndUserAnonymizeBody | undefined {
  const body = recordFromBody(value);

  if (!body) {
    return undefined;
  }

  const appId = requiredBodyString(body, "appId");
  const endUserId = requiredBodyString(body, "endUserId");

  if (!appId || !endUserId) {
    return undefined;
  }

  return {
    appId,
    endUserId,
  };
}

function credentialIdFromParams(params: unknown): string | undefined {
  const record = recordFromBody(params);
  const id = record?.id;

  return typeof id === "string" && id.trim().length > 0 ? id.trim() : undefined;
}

function adminIdFromParams(params: unknown): string | undefined {
  return credentialIdFromParams(params);
}

function adminSessionResponse(session: GatewaySessionRecord) {
  return {
    app_id: session.attribution.appId,
    channel_id: session.attribution.channelId,
    created_at: session.createdAt,
    end_user_id: session.attribution.endUserId,
    expires_at: session.expiresAt,
    id: session.id,
    mode: session.attribution.mode,
    revoked_at: session.revokedAt ?? null,
    use_case: session.attribution.useCase,
  };
}

function createRateLimiter(now = () => Date.now()) {
  const counters = new Map<string, RateLimitCounter>();

  return {
    consume(input: {
      key: string;
      limit: number;
      scope: RateLimitScope;
      windowMs: number;
    }): RateLimitDecision {
      if (input.limit <= 0) {
        return { allowed: true };
      }

      const currentTime = now();
      const existing = counters.get(input.key);
      const counter =
        existing && existing.resetAt > currentTime
          ? existing
          : { count: 0, resetAt: currentTime + input.windowMs };

      if (counter.count >= input.limit) {
        counters.set(input.key, counter);
        return {
          allowed: false,
          limit: input.limit,
          remaining: 0,
          resetAt: counter.resetAt,
          scope: input.scope,
        };
      }

      counter.count += 1;
      counters.set(input.key, counter);

      return { allowed: true };
    },
  };
}

function parseIdempotencyKey(value: string | string[] | undefined) {
  const key = Array.isArray(value) ? value[0] : value;

  return typeof key === "string" && key.trim().length > 0
    ? key.trim()
    : undefined;
}

class DemoLocalAdapter implements LLMAdapter {
  async chat(
    input: Parameters<LLMAdapter["chat"]>[0],
  ): Promise<AdapterChatOutput> {
    const lastUserMessage = [...input.messages]
      .reverse()
      .find((message) => message.role === "user");
    const content = `Demo summary: ${(lastUserMessage?.content ?? "").slice(0, 120)}`;
    const usage = estimateAdapterUsage(input, content);

    return {
      id: input.requestId ?? `req_${randomUUID()}`,
      model: input.model,
      content,
      finishReason: "stop",
      usage,
      raw: {
        demo: true,
      },
    };
  }

  async *streamChat(input: Parameters<LLMAdapter["streamChat"]>[0]) {
    const output = await this.chat(input);
    yield {
      id: output.id,
      model: output.model,
      contentDelta: output.content,
      finishReason: output.finishReason,
    };
    yield {
      done: true,
    };
  }
}

function jsonError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): FastifyReply {
  return reply.code(statusCode).send({
    error: {
      code,
      message,
      details,
    },
  });
}

function queryString(
  query: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = query[key];
  const candidate = Array.isArray(value) ? value[0] : value;

  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim()
    : undefined;
}

function parseAdminListInteger(
  query: Record<string, unknown>,
  key: string,
  defaultValue: number,
): number {
  const value = queryString(query, key);

  if (!value) {
    return defaultValue;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`${key} must be a non-negative integer.`);
  }

  return Number(value);
}

function normalizeForAdminFilter(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function matchesAdminFilter(value: unknown, expected: string): boolean {
  return normalizeForAdminFilter(value) === expected.toLowerCase();
}

function applyAdminListQuery<T>(
  request: FastifyRequest,
  records: T[],
  filters: Array<AdminListFilter<T>>,
  searchFields: Array<(item: T) => unknown>,
): AdminListResult<T> {
  const query = recordFromBody(request.query) ?? {};
  const limit = Math.min(parseAdminListInteger(query, "limit", 100), 500);
  const offset = parseAdminListInteger(query, "offset", 0);
  const search = queryString(query, "q")?.toLowerCase();

  let items = records.filter((item) =>
    filters.every((filter) => {
      const expected = queryString(query, filter.query);

      return (
        expected === undefined ||
        matchesAdminFilter(filter.read(item), expected)
      );
    }),
  );

  const createdFrom = queryString(query, "created_from");
  const createdTo = queryString(query, "created_to");

  if (createdFrom || createdTo) {
    const from = createdFrom
      ? Date.parse(createdFrom)
      : Number.NEGATIVE_INFINITY;
    const to = createdTo ? Date.parse(createdTo) : Number.POSITIVE_INFINITY;

    if (Number.isNaN(from) || Number.isNaN(to)) {
      throw new Error(
        "created_from and created_to must be valid date strings.",
      );
    }

    items = items.filter((item) => {
      const createdAt = Date.parse(
        String((item as { createdAt?: string }).createdAt ?? ""),
      );

      return !Number.isNaN(createdAt) && createdAt >= from && createdAt <= to;
    });
  }

  if (search) {
    items = items.filter((item) =>
      searchFields.some((field) =>
        normalizeForAdminFilter(field(item)).includes(search),
      ),
    );
  }

  const total = items.length;
  const pagedItems = items.slice(offset, offset + limit);

  return {
    items: pagedItems,
    page: {
      limit,
      offset,
      returned: pagedItems.length,
      total,
    },
  };
}

function adminListResponse<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  key: string,
  records: T[],
  filters: Array<AdminListFilter<T>>,
  searchFields: Array<(item: T) => unknown>,
) {
  try {
    const result = applyAdminListQuery(request, records, filters, searchFields);

    return {
      [key]: result.items,
      page: result.page,
    };
  } catch (error) {
    return jsonError(
      reply,
      400,
      "invalid_admin_list_query",
      "Admin list query is invalid.",
      error instanceof Error ? error.message : undefined,
    );
  }
}

function parseAuthorizationHeader(
  authorization: string | undefined,
): ParsedAuthorization | undefined {
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);

  if (scheme !== "Bearer" || !token) {
    return undefined;
  }

  return {
    scheme,
    token,
  };
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isValidSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function safeEqualHex(left: string, right: string): boolean {
  if (!isValidSha256Hex(left) || !isValidSha256Hex(right)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

async function requireAttribution(
  request: FastifyRequest,
  reply: FastifyReply,
  store: GatewayStore,
): Promise<AttributionContext | undefined> {
  let attribution: AttributionContext;

  try {
    attribution = parseAttributionHeaders(request.headers);
  } catch (error) {
    jsonError(
      reply,
      400,
      "missing_attribution",
      "Missing or invalid FountLayer attribution headers.",
      error instanceof Error ? error.message : undefined,
    );
    return undefined;
  }

  try {
    const app = await store.getActiveApp(attribution.appId);

    if (!app) {
      jsonError(
        reply,
        403,
        "unknown_app",
        "The requested app is not registered or active.",
      );
      return undefined;
    }

    const channel = await store.getActiveChannel(app.id, attribution.channelId);

    if (!channel) {
      jsonError(
        reply,
        403,
        "unknown_channel",
        "The requested channel is not registered or active for this app.",
      );
      return undefined;
    }

    request.attribution = attribution;
    return attribution;
  } catch (error) {
    jsonError(
      reply,
      500,
      "store_error",
      "Gateway store failed while validating attribution.",
      error instanceof Error ? error.message : undefined,
    );
    return undefined;
  }
}

async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  store: GatewayStore,
): Promise<AuthContext | undefined> {
  const parsed = parseAuthorizationHeader(request.headers.authorization);

  if (!parsed) {
    jsonError(
      reply,
      401,
      "missing_auth",
      "Expected Authorization: Bearer <token>.",
    );
    return undefined;
  }

  const tokenHash = hashSessionToken(parsed.token);
  let session;

  try {
    session = await store.getActiveSessionByTokenHash(tokenHash);
  } catch (error) {
    jsonError(
      reply,
      500,
      "store_error",
      "Gateway store failed while validating session token.",
      error instanceof Error ? error.message : undefined,
    );
    return undefined;
  }

  if (!session) {
    jsonError(
      reply,
      401,
      "invalid_auth",
      "Session token is invalid, expired, or revoked.",
    );
    return undefined;
  }

  const attribution = requireRequestAttribution(request);
  const mismatches = Object.entries(session.attribution).filter(
    ([key, value]) => attribution[key as keyof AttributionContext] !== value,
  );

  if (mismatches.length > 0) {
    jsonError(
      reply,
      403,
      "session_attribution_mismatch",
      "Session token attribution does not match request attribution.",
      mismatches.map(([field]) => field),
    );
    return undefined;
  }

  const auth = {
    scheme: parsed.scheme,
    sessionId: session.id,
    tokenHash,
    expiresAt: session.expiresAt,
  } as const;

  request.auth = auth;
  return auth;
}

async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  adminTokenHashes: readonly string[],
): Promise<AdminAuthContext | undefined> {
  const configuredHashes = adminTokenHashes.filter(isValidSha256Hex);

  if (configuredHashes.length === 0) {
    jsonError(
      reply,
      503,
      "admin_auth_not_configured",
      "Admin API authentication is not configured.",
    );
    return undefined;
  }

  const parsed = parseAuthorizationHeader(request.headers.authorization);

  if (!parsed) {
    jsonError(
      reply,
      401,
      "missing_admin_auth",
      "Expected Authorization: Bearer <admin token>.",
    );
    return undefined;
  }

  const tokenHash = hashSessionToken(parsed.token);
  const matched = configuredHashes.some((configuredHash) =>
    safeEqualHex(tokenHash, configuredHash),
  );

  if (!matched) {
    jsonError(reply, 401, "invalid_admin_auth", "Admin token is invalid.");
    return undefined;
  }

  const adminAuth = {
    scheme: parsed.scheme,
    tokenHash,
  } as const;

  request.adminAuth = adminAuth;
  return adminAuth;
}

function assertAttributionMatch(
  body: AttributionContext,
  headers: AttributionContext,
  reply: FastifyReply,
): boolean {
  const mismatches = Object.entries(body).filter(
    ([key, value]) => headers[key as keyof AttributionContext] !== value,
  );

  if (mismatches.length > 0) {
    jsonError(
      reply,
      400,
      "attribution_mismatch",
      "Session body attribution must match request headers.",
      mismatches.map(([field]) => field),
    );
    return false;
  }

  return true;
}

function formatMoney(amount: number): string {
  return Math.max(0, amount).toFixed(8);
}

function requireRequestAttribution(
  request: FastifyRequest,
): AttributionContext {
  if (!request.attribution) {
    throw new Error("Attribution middleware did not run.");
  }

  return request.attribution;
}

function requireRequestAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) {
    throw new Error("Auth middleware did not run.");
  }

  return request.auth;
}

function resolvePriceBreakdown(
  attribution: AttributionContext,
  request: {
    messages: Array<{ content: string }>;
  },
  routePolicy: GatewayRoutePolicyRecord,
  tokenEstimate = estimateChatTokens(request.messages),
) {
  const modelPrice = findModelPrice(
    demoModelPrices,
    routePolicy.provider,
    routePolicy.model,
  );

  if (!modelPrice) {
    return undefined;
  }

  return attribution.mode === "byok"
    ? priceByokRequest(tokenEstimate)
    : attribution.mode === "local"
      ? priceLocalRequest(tokenEstimate)
      : priceManagedRequest({
          modelPrice,
          tokenEstimate,
        });
}

async function resolveRoutePolicy(
  store: GatewayStore,
  attribution: AttributionContext,
  requestedAlias: string,
  reply: FastifyReply,
  telemetrySink?: TelemetrySink,
): Promise<GatewayRoutePolicyRecord | undefined> {
  const routePolicy = await store.getRoutePolicy(
    attribution.appId,
    requestedAlias,
  );

  if (!routePolicy) {
    await recordTelemetry(telemetrySink, "gateway.chat.denied", {
      appId: attribution.appId,
      channelId: attribution.channelId,
      endUserId: attribution.endUserId,
      mode: attribution.mode,
      reason: "unknown_route",
      routeAlias: requestedAlias,
      useCase: attribution.useCase,
    });
    jsonError(
      reply,
      400,
      "unknown_route",
      "No active route policy is configured for this model alias.",
    );
    return undefined;
  }

  if (!routePolicy.modelAllowlist.includes(routePolicy.model)) {
    await recordTelemetry(telemetrySink, "gateway.chat.denied", {
      appId: attribution.appId,
      channelId: attribution.channelId,
      endUserId: attribution.endUserId,
      mode: attribution.mode,
      reason: "route_policy_rejected",
      routeAlias: routePolicy.alias,
      routeId: routePolicy.id,
      routedModel: routePolicy.model,
      useCase: attribution.useCase,
    });
    jsonError(
      reply,
      403,
      "route_policy_rejected",
      "Route policy target model is not in its model allowlist.",
      {
        model: routePolicy.model,
        route: routePolicy.alias,
      },
    );
    return undefined;
  }

  return routePolicy;
}

async function rejectRouteSpendCap(
  attribution: AttributionContext,
  routePolicy: GatewayRoutePolicyRecord,
  retailPrice: string,
  reply: FastifyReply,
  telemetrySink?: TelemetrySink,
): Promise<boolean> {
  if (
    routePolicy.maxRetailPrice === undefined ||
    Number(retailPrice) <= Number(routePolicy.maxRetailPrice)
  ) {
    return false;
  }

  await recordTelemetry(telemetrySink, "gateway.chat.denied", {
    appId: attribution.appId,
    channelId: attribution.channelId,
    endUserId: attribution.endUserId,
    mode: attribution.mode,
    reason: "route_spend_cap_exceeded",
    retailPrice,
    routeAlias: routePolicy.alias,
    routeId: routePolicy.id,
    useCase: attribution.useCase,
  });
  jsonError(
    reply,
    402,
    "route_spend_cap_exceeded",
    "Route policy max retail price would be exceeded.",
    {
      max_retail_price: routePolicy.maxRetailPrice,
      retail_price: retailPrice,
      route: routePolicy.alias,
    },
  );
  return true;
}

async function recordTelemetry(
  sink: TelemetrySink | undefined,
  name: string,
  attributes: Record<string, unknown>,
) {
  await sink?.record(createTelemetryEvent(name, attributes));
}

async function recordMetric(
  sink: TelemetrySink | undefined,
  name: string,
  value: number,
  attributes: Record<string, unknown>,
  unit?: string,
) {
  await sink?.recordMetric?.(
    createTelemetryMetric(name, value, attributes, { unit }),
  );
}

async function recordSpan(
  sink: TelemetrySink | undefined,
  name: string,
  startedAt: number,
  status: "error" | "ok",
  attributes: Record<string, unknown>,
) {
  await sink?.recordSpan?.(
    createTelemetrySpan(name, {
      attributes,
      durationMs: Date.now() - startedAt,
      status,
    }),
  );
}

async function runDependencyHealthChecks(
  store: GatewayStore,
  dependencyHealthChecks: Record<string, GatewayDependencyHealthCheck>,
): Promise<GatewayDependencyHealthResult[]> {
  const checks: GatewayDependencyHealthResult[] = [];

  try {
    const storeHealth = await store.healthCheck();
    checks.push({
      component: storeHealth.component,
      name: "store",
      status: storeHealth.status,
    });
  } catch {
    checks.push({
      name: "store",
      status: "error",
    });
  }

  for (const [name, check] of Object.entries(dependencyHealthChecks)) {
    try {
      await check();
      checks.push({
        name,
        status: "ok",
      });
    } catch {
      checks.push({
        name,
        status: "error",
      });
    }
  }

  return checks;
}

export function buildGatewayServer(
  store: GatewayStore = createInMemoryGatewayStore(),
  options: GatewayServerOptions = {},
): FastifyInstance {
  const adapter = options.adapter ?? new DemoLocalAdapter();
  const adapterCircuitBreaker = options.adapterCircuitBreaker;
  const adapterRetry = options.adapterRetry ?? { maxAttempts: 1 };
  const allowHostedByokCredentials =
    options.allowHostedByokCredentials ?? false;
  const adminTokenHashes = options.adminTokenHashes ?? [];
  const credentialCipher = options.credentialCipher;
  const dependencyHealthChecks = options.dependencyHealthChecks ?? {};
  const privacy = options.privacy ?? {};
  const telemetrySink = options.telemetrySink;
  const rateLimits = {
    ...defaultRateLimits,
    ...options.rateLimits,
  };
  const rateLimiter = createRateLimiter();
  const idempotencyCache = new Map<string, ChatCompletionResponse>();
  const server = Fastify({
    logger: options.logger
      ? {
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              "req.headers['proxy-authorization']",
              "req.headers['x-api-key']",
              "req.headers['x-litellm-api-key']",
            ],
            remove: true,
          },
        }
      : false,
  });

  server.addHook("onRequest", async (request, reply) => {
    reply.header("x-fl-request-id", request.id);
    reply.header("access-control-allow-origin", "*");
    reply.header(
      "access-control-allow-headers",
      [
        "authorization",
        "content-type",
        "idempotency-key",
        "x-fl-app-id",
        "x-fl-channel-id",
        "x-fl-end-user-id",
        "x-fl-use-case",
        "x-fl-mode",
      ].join(", "),
    );
    reply.header("access-control-expose-headers", "x-fl-request-id");
    reply.header(
      "access-control-allow-methods",
      "DELETE, GET, PATCH, POST, OPTIONS",
    );

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  server.get("/health", async () => ({
    status: "ok",
    service: "fountlayer-gateway",
  }));

  server.get("/health/dependencies", async (_request, reply) => {
    const checks = await runDependencyHealthChecks(
      store,
      dependencyHealthChecks,
    );
    const healthy = checks.every((check) => check.status === "ok");
    const payload = {
      checks,
      service: "fountlayer-gateway",
      status: healthy ? "ok" : "degraded",
    };

    return healthy ? payload : reply.code(503).send(payload);
  });

  server.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/admin/")) {
      const adminAuth = await requireAdminAuth(
        request,
        reply,
        adminTokenHashes,
      );

      if (!adminAuth) {
        return reply;
      }

      return;
    }

    if (!request.url.startsWith("/v1/")) {
      return;
    }

    const attribution = await requireAttribution(request, reply, store);

    if (!attribution) {
      return reply;
    }

    if (request.method !== "POST" || request.url !== "/v1/sessions") {
      const auth = await requireAuth(request, reply, store);

      if (!auth) {
        return reply;
      }
    }
  });

  server.post("/v1/sessions", async (request, reply) => {
    const startedAt = Date.now();
    const headers = requireRequestAttribution(request);
    const parsed = sessionRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return jsonError(
        reply,
        400,
        "invalid_session_request",
        "Session request body must include appId, channelId, endUserId, useCase, and mode.",
        parsed.error.issues,
      );
    }

    if (!assertAttributionMatch(parsed.data, headers, reply)) {
      return reply;
    }

    const sessionId = `sess_${randomUUID()}`;
    const token = `fl_sess_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    try {
      await store.createSession({
        id: sessionId,
        tokenHash: hashSessionToken(token),
        attribution: parsed.data,
        expiresAt,
      });
    } catch (error) {
      await recordSpan(
        telemetrySink,
        "gateway.session.create",
        startedAt,
        "error",
        {
          appId: parsed.data.appId,
          channelId: parsed.data.channelId,
          endUserId: parsed.data.endUserId,
          mode: parsed.data.mode,
          useCase: parsed.data.useCase,
        },
      );
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while creating a session.",
        error instanceof Error ? error.message : undefined,
      );
    }

    await recordSpan(telemetrySink, "gateway.session.create", startedAt, "ok", {
      appId: parsed.data.appId,
      channelId: parsed.data.channelId,
      endUserId: parsed.data.endUserId,
      mode: parsed.data.mode,
      useCase: parsed.data.useCase,
    });

    return reply.code(201).send({
      session_id: sessionId,
      token,
      expires_at: expiresAt,
    });
  });

  server.get("/v1/balance", async (request) => {
    const attribution = requireRequestAttribution(request);
    const grants = await store.listActiveGrants(attribution);
    const faucetBalance = grants.reduce(
      (total, grant) => total + Number(grant.remaining),
      0,
    );

    return {
      currency: "USD",
      wallet_balance: "0.00000000",
      faucet_balance: formatMoney(faucetBalance),
      active_grants: grants.map((grant) => grant.id),
    };
  });

  server.get("/v1/faucet-grants", async (request) => {
    const attribution = requireRequestAttribution(request);
    return {
      grants: (await store.listActiveGrants(attribution)).map((grant) => ({
        id: grant.id,
        remaining: grant.remaining,
        allowed_models: grant.allowedModels,
        allowed_use_cases: grant.allowedUseCases,
        daily_cap: grant.dailyCap,
        expires_at: grant.expiresAt,
      })),
    };
  });

  server.post("/v1/estimate", async (request, reply) => {
    const startedAt = Date.now();
    const attribution = requireRequestAttribution(request);
    const parsed = chatRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return jsonError(
        reply,
        400,
        "invalid_chat_request",
        "Invalid chat request.",
        parsed.error.issues,
      );
    }

    const routePolicy = await resolveRoutePolicy(
      store,
      attribution,
      parsed.data.model,
      reply,
      telemetrySink,
    );

    if (!routePolicy) {
      return reply;
    }

    const estimate = resolvePriceBreakdown(
      attribution,
      parsed.data,
      routePolicy,
    );

    if (!estimate) {
      return jsonError(
        reply,
        400,
        "unknown_model",
        "No model price is configured for this route.",
      );
    }

    if (
      await rejectRouteSpendCap(
        attribution,
        routePolicy,
        estimate.retailPrice,
        reply,
        telemetrySink,
      )
    ) {
      return reply;
    }

    const grantMatch = await store.findPayingGrant({
      attribution,
      model: parsed.data.model,
      requestedAmount: estimate.retailPrice,
    });
    const walletMatch = grantMatch.matched
      ? undefined
      : await store.findPayingWallet({
          attribution,
          requestedAmount: estimate.retailPrice,
        });
    const paymentSource = grantMatch.matched
      ? "faucet_grant"
      : walletMatch?.matched
        ? "wallet"
        : "none";

    await recordSpan(telemetrySink, "gateway.estimate", startedAt, "ok", {
      appId: attribution.appId,
      channelId: attribution.channelId,
      endUserId: attribution.endUserId,
      mode: attribution.mode,
      paymentSource,
      retailPrice: estimate.retailPrice,
      routeAlias: routePolicy.alias,
      routeId: routePolicy.id,
      useCase: attribution.useCase,
    });
    await recordMetric(
      telemetrySink,
      "gateway.estimate.tokens",
      estimate.inputTokens + estimate.outputTokens,
      {
        appId: attribution.appId,
        channelId: attribution.channelId,
        mode: attribution.mode,
        routeId: routePolicy.id,
      },
      "tokens",
    );
    await recordMetric(
      telemetrySink,
      "gateway.estimate.retail_price",
      Number(estimate.retailPrice),
      {
        appId: attribution.appId,
        channelId: attribution.channelId,
        mode: attribution.mode,
        routeId: routePolicy.id,
      },
      "USD",
    );

    return {
      currency: "USD",
      model: parsed.data.model,
      route_id: routePolicy.id,
      routed_model: routePolicy.model,
      estimated_input_tokens: estimate.inputTokens,
      estimated_output_tokens: estimate.outputTokens,
      upstream_cost: estimate.upstreamCost,
      wholesale_price: estimate.wholesalePrice,
      retail_price: estimate.retailPrice,
      payment_source: paymentSource,
    };
  });

  server.post("/v1/chat/completions", async (request, reply) => {
    const startedAt = Date.now();
    const attribution = requireRequestAttribution(request);
    const auth = requireRequestAuth(request);
    const idempotencyKey = parseIdempotencyKey(
      request.headers["idempotency-key"],
    );
    const idempotencyCacheKey = idempotencyKey
      ? `${auth.sessionId}:${idempotencyKey}`
      : undefined;
    const cachedResponse = idempotencyCacheKey
      ? idempotencyCache.get(idempotencyCacheKey)
      : undefined;

    if (cachedResponse) {
      return cachedResponse;
    }

    const parsed = chatRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return jsonError(
        reply,
        400,
        "invalid_chat_request",
        "Invalid chat request.",
        parsed.error.issues,
      );
    }

    const routePolicy = await resolveRoutePolicy(
      store,
      attribution,
      parsed.data.model,
      reply,
      telemetrySink,
    );

    if (!routePolicy) {
      return reply;
    }

    const estimate = resolvePriceBreakdown(
      attribution,
      parsed.data,
      routePolicy,
    );

    if (!estimate) {
      return jsonError(
        reply,
        400,
        "unknown_model",
        "No model price is configured for this route.",
      );
    }

    if (
      await rejectRouteSpendCap(
        attribution,
        routePolicy,
        estimate.retailPrice,
        reply,
        telemetrySink,
      )
    ) {
      return reply;
    }

    const sessionRateLimit = rateLimiter.consume({
      key: `session:${auth.sessionId}`,
      limit: rateLimits.sessionBillableRequestsPerWindow,
      scope: "session",
      windowMs: rateLimits.billableWindowMs,
    });

    if (!sessionRateLimit.allowed) {
      return jsonError(
        reply,
        429,
        "rate_limited",
        "Session billable request limit exceeded.",
        {
          limit: sessionRateLimit.limit,
          remaining: sessionRateLimit.remaining,
          reset_at: new Date(sessionRateLimit.resetAt).toISOString(),
          scope: sessionRateLimit.scope,
        },
      );
    }

    const endUserRateLimit = rateLimiter.consume({
      key: `end_user:${attribution.appId}:${attribution.endUserId}`,
      limit: rateLimits.endUserBillableRequestsPerWindow,
      scope: "end_user",
      windowMs: rateLimits.billableWindowMs,
    });

    if (!endUserRateLimit.allowed) {
      return jsonError(
        reply,
        429,
        "rate_limited",
        "End-user billable request limit exceeded.",
        {
          limit: endUserRateLimit.limit,
          remaining: endUserRateLimit.remaining,
          reset_at: new Date(endUserRateLimit.resetAt).toISOString(),
          scope: endUserRateLimit.scope,
        },
      );
    }

    const faucetMatch = await store.findPayingGrant({
      attribution,
      model: parsed.data.model,
      requestedAmount: estimate.retailPrice,
    });
    const walletMatch = faucetMatch.matched
      ? undefined
      : await store.findPayingWallet({
          attribution,
          requestedAmount: estimate.retailPrice,
        });
    const paymentSource: PaymentSource | undefined = faucetMatch.matched
      ? {
          type: "faucet_grant",
          grant: faucetMatch.grant,
        }
      : walletMatch?.matched
        ? {
            type: "wallet",
            wallet: walletMatch.wallet,
          }
        : undefined;

    if (!paymentSource) {
      await recordTelemetry(telemetrySink, "gateway.chat.denied", {
        appId: attribution.appId,
        channelId: attribution.channelId,
        endUserId: attribution.endUserId,
        mode: attribution.mode,
        reason: "insufficient_balance",
        retailPrice: estimate.retailPrice,
        routeAlias: routePolicy.alias,
        routeId: routePolicy.id,
        useCase: attribution.useCase,
      });
      await recordMetric(
        telemetrySink,
        "gateway.chat.denied",
        1,
        {
          appId: attribution.appId,
          channelId: attribution.channelId,
          mode: attribution.mode,
          reason: "insufficient_balance",
          routeId: routePolicy.id,
        },
        "requests",
      );
      await recordSpan(telemetrySink, "gateway.chat", startedAt, "error", {
        appId: attribution.appId,
        channelId: attribution.channelId,
        endUserId: attribution.endUserId,
        mode: attribution.mode,
        reason: "insufficient_balance",
        routeId: routePolicy.id,
        useCase: attribution.useCase,
      });
      return jsonError(
        reply,
        402,
        "insufficient_balance",
        "No faucet grant or wallet balance can pay for this request.",
        {
          faucet: faucetMatch.matched ? [] : faucetMatch.reasons,
          wallet: walletMatch?.matched ? undefined : walletMatch?.reason,
        },
      );
    }

    const requestId = `req_${randomUUID()}`;
    let output: AdapterChatOutput;
    const adapterStartedAt = Date.now();

    try {
      output = await executeWithCircuitBreaker(
        () =>
          executeWithRetry(
            () =>
              adapter.chat({
                requestId,
                model: routePolicy.model,
                messages: parsed.data.messages,
                stream: parsed.data.stream,
                metadata: parsed.data.metadata,
                attribution,
              }),
            adapterRetry,
          ),
        adapterCircuitBreaker,
      );
      await recordSpan(
        telemetrySink,
        "gateway.adapter.call",
        adapterStartedAt,
        "ok",
        {
          appId: attribution.appId,
          channelId: attribution.channelId,
          mode: attribution.mode,
          provider: routePolicy.provider,
          routeId: routePolicy.id,
          routedModel: routePolicy.model,
        },
      );
    } catch (error) {
      await recordTelemetry(telemetrySink, "gateway.adapter.error", {
        appId: attribution.appId,
        channelId: attribution.channelId,
        endUserId: attribution.endUserId,
        mode: attribution.mode,
        provider: routePolicy.provider,
        reason: "adapter_error",
        routeAlias: routePolicy.alias,
        routeId: routePolicy.id,
        routedModel: routePolicy.model,
        useCase: attribution.useCase,
      });
      await recordMetric(
        telemetrySink,
        "gateway.adapter.errors",
        1,
        {
          appId: attribution.appId,
          channelId: attribution.channelId,
          mode: attribution.mode,
          provider: routePolicy.provider,
          routeId: routePolicy.id,
        },
        "errors",
      );
      await recordSpan(
        telemetrySink,
        "gateway.adapter.call",
        adapterStartedAt,
        "error",
        {
          appId: attribution.appId,
          channelId: attribution.channelId,
          mode: attribution.mode,
          provider: routePolicy.provider,
          routeId: routePolicy.id,
          routedModel: routePolicy.model,
        },
      );
      await recordSpan(telemetrySink, "gateway.chat", startedAt, "error", {
        appId: attribution.appId,
        channelId: attribution.channelId,
        endUserId: attribution.endUserId,
        mode: attribution.mode,
        reason: "adapter_error",
        routeId: routePolicy.id,
        useCase: attribution.useCase,
      });
      if (error instanceof CircuitOpenError) {
        return jsonError(
          reply,
          503,
          "adapter_circuit_open",
          "LLM adapter circuit breaker is open.",
        );
      }

      return jsonError(
        reply,
        502,
        "adapter_error",
        error instanceof Error ? error.message : "LLM adapter request failed.",
      );
    }

    const usageEvent = createUsageEvent({
      id: `ue_${randomUUID()}`,
      requestId,
      attribution,
      provider: routePolicy.provider,
      model: output.model,
      routeId: routePolicy.id,
      inputTokens: output.usage.inputTokens,
      outputTokens: output.usage.outputTokens,
      cachedInputTokens: output.usage.cachedInputTokens,
      usageEstimated: output.usage.usageEstimated,
      upstreamCost: estimate.upstreamCost,
      wholesalePrice: estimate.wholesalePrice,
      retailPrice: estimate.retailPrice,
      faucetGrantId:
        paymentSource.type === "faucet_grant"
          ? paymentSource.grant.id
          : undefined,
    });
    const ledgerEntries = createBalancedLedgerEntries({
      usageEventId: usageEvent.id,
      wallets: {
        ...defaultWallets,
        payerWalletId:
          paymentSource.type === "faucet_grant"
            ? paymentSource.grant.walletId
            : paymentSource.wallet.id,
      },
      upstreamCost: usageEvent.upstreamCost,
      retailPrice: usageEvent.retailPrice,
      metadata: {
        requestId,
        appId: attribution.appId,
        channelId: attribution.channelId,
        endUserId: attribution.endUserId,
        useCase: attribution.useCase,
        mode: attribution.mode,
      },
    });

    const billingStartedAt = Date.now();

    try {
      const paymentBillingFields =
        paymentSource.type === "faucet_grant"
          ? {
              faucet_remaining: (
                await store.recordBillableCall({
                  grantId: paymentSource.grant.id,
                  amount: estimate.retailPrice,
                  usageEvent,
                  ledgerEntries,
                })
              ).updatedGrant.remaining,
            }
          : {
              wallet_balance: (
                await store.recordWalletBillableCall({
                  walletId: paymentSource.wallet.id,
                  amount: estimate.retailPrice,
                  usageEvent,
                  ledgerEntries,
                })
              ).updatedWallet.balance,
            };

      await recordSpan(
        telemetrySink,
        "gateway.billing.write",
        billingStartedAt,
        "ok",
        {
          appId: attribution.appId,
          channelId: attribution.channelId,
          ledgerEntryCount: ledgerEntries.length,
          mode: attribution.mode,
          paidBy: paymentSource.type,
          usageEventId: usageEvent.id,
        },
      );
      await recordTelemetry(telemetrySink, "gateway.chat.success", {
        appId: attribution.appId,
        cachedInputTokens: usageEvent.cachedInputTokens,
        channelId: attribution.channelId,
        endUserId: attribution.endUserId,
        inputTokens: usageEvent.inputTokens,
        latencyMs: Date.now() - startedAt,
        mode: attribution.mode,
        outputTokens: usageEvent.outputTokens,
        paidBy: paymentSource.type,
        provider: routePolicy.provider,
        retailPrice: usageEvent.retailPrice,
        routeAlias: routePolicy.alias,
        routeId: routePolicy.id,
        routedModel: routePolicy.model,
        upstreamCost: usageEvent.upstreamCost,
        usageEventId: usageEvent.id,
        useCase: attribution.useCase,
      });
      await recordMetric(
        telemetrySink,
        "gateway.chat.tokens",
        output.usage.totalTokens,
        {
          appId: attribution.appId,
          channelId: attribution.channelId,
          mode: attribution.mode,
          provider: routePolicy.provider,
          routeId: routePolicy.id,
        },
        "tokens",
      );
      await recordMetric(
        telemetrySink,
        "gateway.chat.retail_price",
        Number(usageEvent.retailPrice),
        {
          appId: attribution.appId,
          channelId: attribution.channelId,
          mode: attribution.mode,
          paidBy: paymentSource.type,
          routeId: routePolicy.id,
        },
        "USD",
      );
      await recordMetric(
        telemetrySink,
        "gateway.chat.latency",
        Date.now() - startedAt,
        {
          appId: attribution.appId,
          channelId: attribution.channelId,
          mode: attribution.mode,
          routeId: routePolicy.id,
        },
        "ms",
      );
      await recordSpan(telemetrySink, "gateway.chat", startedAt, "ok", {
        appId: attribution.appId,
        channelId: attribution.channelId,
        endUserId: attribution.endUserId,
        mode: attribution.mode,
        paidBy: paymentSource.type,
        routeId: routePolicy.id,
        usageEventId: usageEvent.id,
        useCase: attribution.useCase,
      });

      const response: ChatCompletionResponse = {
        id: requestId,
        object: "chat.completion",
        model: output.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: output.content,
            },
            finish_reason: output.finishReason ?? "stop",
          },
        ],
        usage: {
          input_tokens: output.usage.inputTokens,
          output_tokens: output.usage.outputTokens,
          total_tokens: output.usage.totalTokens,
        },
        billing: {
          currency: estimate.currency,
          upstream_cost: usageEvent.upstreamCost,
          retail_price: usageEvent.retailPrice,
          paid_by: paymentSource.type,
          ...paymentBillingFields,
          usage_event_id: usageEvent.id,
          ledger_entry_count: ledgerEntries.length,
        },
      };

      if (idempotencyCacheKey) {
        idempotencyCache.set(idempotencyCacheKey, response);
      }

      return response;
    } catch (error) {
      await recordSpan(
        telemetrySink,
        "gateway.billing.write",
        billingStartedAt,
        "error",
        {
          appId: attribution.appId,
          channelId: attribution.channelId,
          ledgerEntryCount: ledgerEntries.length,
          mode: attribution.mode,
          paidBy: paymentSource.type,
          usageEventId: usageEvent.id,
        },
      );
      await recordSpan(telemetrySink, "gateway.chat", startedAt, "error", {
        appId: attribution.appId,
        channelId: attribution.channelId,
        endUserId: attribution.endUserId,
        mode: attribution.mode,
        reason: "billing_write_failed",
        routeId: routePolicy.id,
        useCase: attribution.useCase,
      });
      return jsonError(
        reply,
        402,
        "insufficient_balance",
        "Payment source could not pay for this request after provider execution.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.post<{
    Params: { id: string };
  }>("/admin/sessions/:id/revoke", async (request, reply) => {
    const id = adminIdFromParams(request.params);

    if (!id) {
      return jsonError(
        reply,
        400,
        "invalid_admin_session",
        "Session id is required.",
      );
    }

    try {
      const session = await store.revokeSession(id);

      return session
        ? { session: adminSessionResponse(session) }
        : jsonError(
            reply,
            404,
            "admin_session_not_found",
            "Session was not found.",
          );
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while revoking a session.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.get("/admin/apps", async (request, reply) =>
    adminListResponse(
      request,
      reply,
      "apps",
      await store.listApps(),
      [
        { query: "id", read: (item) => item.id },
        { query: "status", read: (item) => item.status },
        { query: "developer", read: (item) => item.developer },
        { query: "default_route", read: (item) => item.defaultRoute },
      ],
      [
        (item) => item.id,
        (item) => item.name,
        (item) => item.developer,
        (item) => item.defaultRoute,
      ],
    ),
  );

  server.post("/admin/apps", async (request, reply) => {
    let parsed: GatewayAdminAppCreateInput | undefined;

    try {
      parsed = parseAdminAppCreateBody(request.body);
    } catch (error) {
      return jsonError(
        reply,
        400,
        "invalid_admin_app",
        "Admin app request is invalid.",
        error instanceof Error ? error.message : undefined,
      );
    }

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_admin_app",
        "Admin app request must include id, name, developerId, and developerName.",
      );
    }

    if ((await store.listApps()).some((app) => app.id === parsed.id)) {
      return jsonError(
        reply,
        409,
        "admin_app_conflict",
        "Admin app already exists.",
      );
    }

    try {
      const app = await store.createApp(parsed);

      return reply.code(201).send({ app });
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while creating an app.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.patch<{
    Params: { id: string };
  }>("/admin/apps/:id", async (request, reply) => {
    const id = adminIdFromParams(request.params);

    if (!id) {
      return jsonError(reply, 400, "invalid_admin_app", "App id is required.");
    }

    let parsed: GatewayAdminAppUpdateInput | undefined;

    try {
      parsed = parseAdminAppUpdateBody(request.body);
    } catch (error) {
      return jsonError(
        reply,
        400,
        "invalid_admin_app",
        "Admin app update request is invalid.",
        error instanceof Error ? error.message : undefined,
      );
    }

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_admin_app",
        "Admin app update request must include at least one writable field.",
      );
    }

    try {
      const app = await store.updateApp(id, parsed);

      return app
        ? { app }
        : jsonError(reply, 404, "admin_app_not_found", "App was not found.");
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while updating an app.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.get("/admin/channels", async (request, reply) =>
    adminListResponse(
      request,
      reply,
      "channels",
      await store.listChannels(),
      [
        { query: "id", read: (item) => item.id },
        { query: "app_id", read: (item) => item.appId },
        { query: "status", read: (item) => item.status },
        { query: "type", read: (item) => item.type },
      ],
      [
        (item) => item.id,
        (item) => item.appId,
        (item) => item.name,
        (item) => item.type,
      ],
    ),
  );

  server.post("/admin/channels", async (request, reply) => {
    let parsed: GatewayAdminChannelCreateInput | undefined;

    try {
      parsed = parseAdminChannelCreateBody(request.body);
    } catch (error) {
      return jsonError(
        reply,
        400,
        "invalid_admin_channel",
        "Admin channel request is invalid.",
        error instanceof Error ? error.message : undefined,
      );
    }

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_admin_channel",
        "Admin channel request must include id, appId, name, and type.",
      );
    }

    if (
      (await store.listChannels()).some((channel) => channel.id === parsed.id)
    ) {
      return jsonError(
        reply,
        409,
        "admin_channel_conflict",
        "Admin channel already exists.",
      );
    }

    try {
      const channel = await store.createChannel(parsed);

      return reply.code(201).send({ channel });
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while creating a channel.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.patch<{
    Params: { id: string };
  }>("/admin/channels/:id", async (request, reply) => {
    const id = adminIdFromParams(request.params);

    if (!id) {
      return jsonError(
        reply,
        400,
        "invalid_admin_channel",
        "Channel id is required.",
      );
    }

    let parsed: GatewayAdminChannelUpdateInput | undefined;

    try {
      parsed = parseAdminChannelUpdateBody(request.body);
    } catch (error) {
      return jsonError(
        reply,
        400,
        "invalid_admin_channel",
        "Admin channel update request is invalid.",
        error instanceof Error ? error.message : undefined,
      );
    }

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_admin_channel",
        "Admin channel update request must include at least one writable field.",
      );
    }

    try {
      const channel = await store.updateChannel(id, parsed);

      return channel
        ? { channel }
        : jsonError(
            reply,
            404,
            "admin_channel_not_found",
            "Channel was not found.",
          );
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while updating a channel.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.get("/admin/faucet-grants", async (request, reply) =>
    adminListResponse(
      request,
      reply,
      "faucet_grants",
      await store.listFaucetGrants(),
      [
        { query: "id", read: (item) => item.id },
        { query: "app_id", read: (item) => item.appId },
        { query: "channel_id", read: (item) => item.channelId },
        { query: "end_user_id", read: (item) => item.endUserId },
        { query: "wallet_id", read: (item) => item.walletId },
        { query: "status", read: (item) => item.status },
      ],
      [
        (item) => item.id,
        (item) => item.appId,
        (item) => item.channelId,
        (item) => item.endUserId,
        (item) => item.walletId,
      ],
    ),
  );

  server.post("/admin/faucet-grants", async (request, reply) => {
    let parsed: GatewayFaucetGrantCreateInput | undefined;

    try {
      parsed = parseFaucetGrantCreateBody(request.body);
    } catch (error) {
      return jsonError(
        reply,
        400,
        "invalid_faucet_grant",
        "Faucet grant request is invalid.",
        error instanceof Error ? error.message : undefined,
      );
    }

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_faucet_grant",
        "Faucet grant request must include id, appId, channelId, endUserId, remaining, allowedModels, allowedUseCases, dailyCap, and expiresAt.",
      );
    }

    if (
      (await store.listFaucetGrants()).some((grant) => grant.id === parsed.id)
    ) {
      return jsonError(
        reply,
        409,
        "faucet_grant_conflict",
        "Faucet grant already exists.",
      );
    }

    try {
      const faucetGrant = await store.createFaucetGrant(parsed);

      return reply.code(201).send({ faucet_grant: faucetGrant });
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while creating a faucet grant.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.patch<{
    Params: { id: string };
  }>("/admin/faucet-grants/:id", async (request, reply) => {
    const id = adminIdFromParams(request.params);

    if (!id) {
      return jsonError(
        reply,
        400,
        "invalid_faucet_grant",
        "Faucet grant id is required.",
      );
    }

    let parsed: GatewayFaucetGrantUpdateInput | undefined;

    try {
      parsed = parseFaucetGrantUpdateBody(request.body);
    } catch (error) {
      return jsonError(
        reply,
        400,
        "invalid_faucet_grant",
        "Faucet grant update request is invalid.",
        error instanceof Error ? error.message : undefined,
      );
    }

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_faucet_grant",
        "Faucet grant update request must include at least one writable field.",
      );
    }

    try {
      const faucetGrant = await store.updateFaucetGrant(id, parsed);

      return faucetGrant
        ? { faucet_grant: faucetGrant }
        : jsonError(
            reply,
            404,
            "faucet_grant_not_found",
            "Faucet grant was not found.",
          );
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while updating a faucet grant.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.get("/admin/routes", async (request, reply) =>
    adminListResponse(
      request,
      reply,
      "routes",
      await store.listRoutes(),
      [
        { query: "id", read: (item) => item.id },
        { query: "app_id", read: (item) => item.appId },
        { query: "alias", read: (item) => item.alias },
        { query: "adapter", read: (item) => item.adapter },
        { query: "model", read: (item) => item.model },
        { query: "provider", read: (item) => item.provider },
        { query: "status", read: (item) => item.status },
      ],
      [
        (item) => item.id,
        (item) => item.appId,
        (item) => item.alias,
        (item) => item.adapter,
        (item) => item.model,
        (item) => item.provider,
      ],
    ),
  );

  server.post("/admin/routes", async (request, reply) => {
    let parsed: GatewayAdminRouteCreateInput | undefined;

    try {
      parsed = parseAdminRouteCreateBody(request.body);
    } catch (error) {
      return jsonError(
        reply,
        400,
        "invalid_admin_route",
        "Admin route request is invalid.",
        error instanceof Error ? error.message : undefined,
      );
    }

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_admin_route",
        "Admin route request must include id, appId, alias, adapter, provider, model, and modelAllowlist.",
      );
    }

    if ((await store.listRoutes()).some((route) => route.id === parsed.id)) {
      return jsonError(
        reply,
        409,
        "admin_route_conflict",
        "Admin route already exists.",
      );
    }

    try {
      const route = await store.createRoute(parsed);

      return reply.code(201).send({ route });
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while creating a route.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.patch<{
    Params: { id: string };
  }>("/admin/routes/:id", async (request, reply) => {
    const id = adminIdFromParams(request.params);

    if (!id) {
      return jsonError(
        reply,
        400,
        "invalid_admin_route",
        "Route id is required.",
      );
    }

    let parsed: GatewayAdminRouteUpdateInput | undefined;

    try {
      parsed = parseAdminRouteUpdateBody(request.body);
    } catch (error) {
      return jsonError(
        reply,
        400,
        "invalid_admin_route",
        "Admin route update request is invalid.",
        error instanceof Error ? error.message : undefined,
      );
    }

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_admin_route",
        "Admin route update request must include at least one writable field.",
      );
    }

    try {
      const route = await store.updateRoute(id, parsed);

      return route
        ? { route }
        : jsonError(
            reply,
            404,
            "admin_route_not_found",
            "Route was not found.",
          );
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while updating a route.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.get("/admin/provider-credentials", async (request, reply) =>
    adminListResponse(
      request,
      reply,
      "credentials",
      await store.listProviderCredentials(),
      [
        { query: "id", read: (item) => item.id },
        { query: "owner", read: (item) => item.owner },
        { query: "provider", read: (item) => item.provider },
        { query: "status", read: (item) => item.status },
        { query: "storage", read: (item) => item.storage },
      ],
      [
        (item) => item.id,
        (item) => item.owner,
        (item) => item.provider,
        (item) => item.status,
        (item) => item.display,
      ],
    ),
  );

  server.post("/admin/provider-credentials", async (request, reply) => {
    if (!credentialCipher) {
      return jsonError(
        reply,
        503,
        "credential_encryption_not_configured",
        "Credential encryption is not configured for this Gateway.",
      );
    }

    let parsed: ProviderCredentialCreateBody | undefined;

    try {
      parsed = parseProviderCredentialCreateBody(request.body);
    } catch (error) {
      return jsonError(
        reply,
        400,
        "invalid_provider_credential",
        "Provider credential request is invalid.",
        error instanceof Error ? error.message : undefined,
      );
    }

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_provider_credential",
        "Provider credential request must include ownerType, ownerId, provider, and apiKey.",
      );
    }

    if (parsed.ownerType === "end_user" && !allowHostedByokCredentials) {
      return jsonError(
        reply,
        403,
        "hosted_byok_disabled",
        "Hosted end-user BYOK credential storage is disabled. Keep BYOK local-only or explicitly opt in at the Gateway.",
      );
    }

    const id = `cred_${randomUUID()}`;
    const encrypted = credentialCipher.encrypt(parsed.apiKey, id);

    try {
      const credential = await store.createProviderCredential({
        budgetDaily: parsed.budgetDaily,
        budgetMonthly: parsed.budgetMonthly,
        display: maskCredential(parsed.apiKey),
        encryptedApiKey: encrypted.ciphertext,
        id,
        keyVersion: encrypted.keyVersion,
        ownerId: parsed.ownerId,
        ownerType: parsed.ownerType,
        provider: parsed.provider,
      });

      return reply.code(201).send({ credential });
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while creating a provider credential.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.patch<{
    Params: { id: string };
  }>("/admin/provider-credentials/:id/rotate", async (request, reply) => {
    if (!credentialCipher) {
      return jsonError(
        reply,
        503,
        "credential_encryption_not_configured",
        "Credential encryption is not configured for this Gateway.",
      );
    }

    const id = credentialIdFromParams(request.params);

    if (!id) {
      return jsonError(
        reply,
        400,
        "invalid_provider_credential",
        "Credential id is required.",
      );
    }

    let parsed: ProviderCredentialRotateBody | undefined;

    try {
      parsed = parseProviderCredentialRotateBody(request.body);
    } catch (error) {
      return jsonError(
        reply,
        400,
        "invalid_provider_credential",
        "Provider credential rotation request is invalid.",
        error instanceof Error ? error.message : undefined,
      );
    }

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_provider_credential",
        "Provider credential rotation request must include apiKey.",
      );
    }

    const encrypted = credentialCipher.encrypt(parsed.apiKey, id);

    try {
      const credential = await store.rotateProviderCredential({
        display: maskCredential(parsed.apiKey),
        encryptedApiKey: encrypted.ciphertext,
        id,
        keyVersion: encrypted.keyVersion,
      });

      return credential
        ? { credential }
        : jsonError(
            reply,
            404,
            "provider_credential_not_found",
            "Provider credential was not found.",
          );
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while rotating a provider credential.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.delete<{
    Params: { id: string };
  }>("/admin/provider-credentials/:id", async (request, reply) => {
    const id = credentialIdFromParams(request.params);

    if (!id) {
      return jsonError(
        reply,
        400,
        "invalid_provider_credential",
        "Credential id is required.",
      );
    }

    try {
      const deleted = await store.deleteProviderCredential(id);

      return deleted
        ? reply.code(204).send()
        : jsonError(
            reply,
            404,
            "provider_credential_not_found",
            "Provider credential was not found.",
          );
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while deleting a provider credential.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.get("/admin/pricing-policies", async (request, reply) =>
    adminListResponse(
      request,
      reply,
      "pricing_policies",
      await store.listPricingPolicies(),
      [
        { query: "id", read: (item) => item.id },
        { query: "app_id", read: (item) => item.appId },
      ],
      [(item) => item.id, (item) => item.appId],
    ),
  );

  server.post("/admin/pricing-policies", async (request, reply) => {
    let parsed: GatewayAdminPricingPolicyCreateInput | undefined;

    try {
      parsed = parsePricingPolicyCreateBody(request.body);
    } catch (error) {
      return jsonError(
        reply,
        400,
        "invalid_pricing_policy",
        "Pricing policy request is invalid.",
        error instanceof Error ? error.message : undefined,
      );
    }

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_pricing_policy",
        "Pricing policy request must include id and name.",
      );
    }

    if (
      (await store.listPricingPolicies()).some(
        (policy) => policy.id === parsed.id,
      )
    ) {
      return jsonError(
        reply,
        409,
        "pricing_policy_conflict",
        "Pricing policy already exists.",
      );
    }

    try {
      const pricingPolicy = await store.createPricingPolicy(parsed);

      return reply.code(201).send({ pricing_policy: pricingPolicy });
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while creating a pricing policy.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.patch<{
    Params: { id: string };
  }>("/admin/pricing-policies/:id", async (request, reply) => {
    const id = adminIdFromParams(request.params);

    if (!id) {
      return jsonError(
        reply,
        400,
        "invalid_pricing_policy",
        "Pricing policy id is required.",
      );
    }

    let parsed: GatewayAdminPricingPolicyUpdateInput | undefined;

    try {
      parsed = parsePricingPolicyUpdateBody(request.body);
    } catch (error) {
      return jsonError(
        reply,
        400,
        "invalid_pricing_policy",
        "Pricing policy update request is invalid.",
        error instanceof Error ? error.message : undefined,
      );
    }

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_pricing_policy",
        "Pricing policy update request must include at least one writable field.",
      );
    }

    try {
      const pricingPolicy = await store.updatePricingPolicy(id, parsed);

      return pricingPolicy
        ? { pricing_policy: pricingPolicy }
        : jsonError(
            reply,
            404,
            "pricing_policy_not_found",
            "Pricing policy was not found.",
          );
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while updating a pricing policy.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  server.get("/admin/usage-events", async (request, reply) =>
    adminListResponse(
      request,
      reply,
      "usage_events",
      await store.listUsageEvents(),
      [
        { query: "id", read: (item) => item.id },
        { query: "request_id", read: (item) => item.requestId },
        { query: "app_id", read: (item) => item.appId },
        { query: "channel_id", read: (item) => item.channelId },
        { query: "end_user_id", read: (item) => item.endUserId },
        { query: "use_case", read: (item) => item.useCase },
        { query: "mode", read: (item) => item.mode },
        { query: "model", read: (item) => item.model },
        { query: "route_id", read: (item) => item.routeId },
        { query: "status", read: (item) => item.status },
      ],
      [
        (item) => item.id,
        (item) => item.requestId,
        (item) => item.appId,
        (item) => item.channelId,
        (item) => item.endUserId,
        (item) => item.useCase,
        (item) => item.mode,
        (item) => item.model,
        (item) => item.routeId,
      ],
    ),
  );

  server.get("/admin/ledger", async (request, reply) =>
    adminListResponse(
      request,
      reply,
      "ledger_entries",
      await store.listLedgerEntries(),
      [
        { query: "id", read: (item) => item.id },
        { query: "usage_event_id", read: (item) => item.usageEventId },
        { query: "wallet_id", read: (item) => item.walletId },
        { query: "direction", read: (item) => item.direction },
        { query: "reason", read: (item) => item.reason },
      ],
      [
        (item) => item.id,
        (item) => item.usageEventId,
        (item) => item.walletId,
        (item) => item.direction,
        (item) => item.reason,
      ],
    ),
  );

  server.post(
    "/admin/privacy/request-metadata/purge",
    async (request, reply) => {
      const body = recordFromBody(request.body) ?? {};
      let retentionDays: number | undefined;

      try {
        retentionDays =
          parseRetentionDays(body["retentionDays"]) ??
          privacy.requestMetadataRetentionDays;
      } catch (error) {
        return jsonError(
          reply,
          400,
          "invalid_retention_policy",
          "Request metadata retention policy is invalid.",
          error instanceof Error ? error.message : undefined,
        );
      }

      if (retentionDays === undefined) {
        return jsonError(
          reply,
          400,
          "retention_policy_not_configured",
          "Provide retentionDays or configure request metadata retention on the Gateway.",
        );
      }

      try {
        const result = await store.purgeExpiredRequestMetadata({
          retentionDays,
        });

        return {
          request_metadata_retention: {
            cutoff: result.cutoff,
            ledger_entries_updated: result.ledgerEntriesUpdated,
            retention_days: result.retentionDays,
          },
        };
      } catch (error) {
        return jsonError(
          reply,
          500,
          "store_error",
          "Gateway store failed while purging request metadata.",
          error instanceof Error ? error.message : undefined,
        );
      }
    },
  );

  server.post("/admin/privacy/end-users/anonymize", async (request, reply) => {
    const parsed = parsePrivacyEndUserAnonymizeBody(request.body);

    if (!parsed) {
      return jsonError(
        reply,
        400,
        "invalid_end_user_privacy_request",
        "End-user anonymization requires appId and endUserId.",
      );
    }

    try {
      const result = await store.anonymizeEndUser(parsed);

      return {
        end_user_privacy: {
          app_id: result.appId,
          end_user_records_deleted: result.endUserRecordsDeleted,
          faucet_grants_anonymized: result.faucetGrantsAnonymized,
          faucet_grants_revoked: result.faucetGrantsRevoked,
          ledger_entries_scrubbed: result.ledgerEntriesScrubbed,
          provider_credentials_revoked: result.providerCredentialsRevoked,
          sessions_revoked: result.sessionsRevoked,
          tombstone_end_user_id: result.tombstoneEndUserId,
          usage_events_anonymized: result.usageEventsAnonymized,
          wallets_anonymized: result.walletsAnonymized,
        },
      };
    } catch (error) {
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while anonymizing end-user records.",
        error instanceof Error ? error.message : undefined,
      );
    }
  });

  return server;
}
