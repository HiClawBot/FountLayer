import { z } from "zod";

export const protocolVersion = "0.1.0";

const nonEmptyStringSchema = z.string().trim().min(1);
const decimalStringSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,8})?$/, "Expected a non-negative decimal string");
const timestampSchema = z.string().datetime({ offset: true });

export const fountLayerModeSchema = z.enum([
  "managed",
  "developer_key",
  "byok",
  "local",
]);
export type FountLayerMode = z.infer<typeof fountLayerModeSchema>;

export const attributionHeaderNames = {
  appId: "x-fl-app-id",
  channelId: "x-fl-channel-id",
  endUserId: "x-fl-end-user-id",
  useCase: "x-fl-use-case",
  mode: "x-fl-mode",
} as const;

export const attributionContextSchema = z.object({
  appId: nonEmptyStringSchema,
  channelId: nonEmptyStringSchema,
  endUserId: nonEmptyStringSchema,
  useCase: nonEmptyStringSchema,
  mode: fountLayerModeSchema,
});
export type AttributionContext = z.infer<typeof attributionContextSchema>;

export const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: nonEmptyStringSchema,
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  model: nonEmptyStringSchema,
  messages: z.array(chatMessageSchema).min(1),
  stream: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const usageMetadataSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative(),
  usageEstimated: z.boolean().default(false),
});
export type UsageMetadata = z.infer<typeof usageMetadataSchema>;

export const billingMetadataSchema = z.object({
  currency: nonEmptyStringSchema.default("USD"),
  upstreamCost: decimalStringSchema,
  wholesalePrice: decimalStringSchema,
  retailPrice: decimalStringSchema,
  paidBy: z.enum(["faucet_grant", "wallet", "byok", "local", "none"]),
  usageEventId: nonEmptyStringSchema.optional(),
  faucetGrantId: nonEmptyStringSchema.optional(),
  faucetRemaining: decimalStringSchema.optional(),
});
export type BillingMetadata = z.infer<typeof billingMetadataSchema>;

export const chatChoiceSchema = z.object({
  index: z.number().int().nonnegative(),
  message: chatMessageSchema,
  finishReason: z
    .enum(["stop", "length", "tool_calls", "content_filter"])
    .optional(),
});
export type ChatChoice = z.infer<typeof chatChoiceSchema>;

export const chatResponseSchema = z.object({
  id: nonEmptyStringSchema,
  object: z.literal("chat.completion"),
  model: nonEmptyStringSchema,
  choices: z.array(chatChoiceSchema).min(1),
  usage: usageMetadataSchema,
  billing: billingMetadataSchema,
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

export const faucetGrantSchema = z.object({
  id: nonEmptyStringSchema,
  sponsorType: z.enum(["platform", "developer", "provider", "campaign"]),
  sponsorId: nonEmptyStringSchema.optional(),
  appId: nonEmptyStringSchema,
  channelId: nonEmptyStringSchema.optional(),
  endUserId: nonEmptyStringSchema.optional(),
  walletId: nonEmptyStringSchema.optional(),
  amount: decimalStringSchema,
  remaining: decimalStringSchema,
  allowedModels: z.array(nonEmptyStringSchema).min(1),
  allowedUseCases: z.array(nonEmptyStringSchema).min(1),
  dailyCap: decimalStringSchema,
  expiresAt: timestampSchema,
  status: z
    .enum(["active", "exhausted", "expired", "revoked"])
    .default("active"),
  createdAt: timestampSchema.optional(),
});
export type FaucetGrant = z.infer<typeof faucetGrantSchema>;

export const usageEventStatusSchema = z.enum(["success", "failed", "refunded"]);

export const usageEventSchema = z.object({
  id: nonEmptyStringSchema,
  requestId: nonEmptyStringSchema,
  appId: nonEmptyStringSchema,
  channelId: nonEmptyStringSchema,
  endUserId: nonEmptyStringSchema,
  mode: fountLayerModeSchema,
  provider: nonEmptyStringSchema.optional(),
  model: nonEmptyStringSchema,
  routeId: nonEmptyStringSchema.optional(),
  useCase: nonEmptyStringSchema,
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  cachedInputTokens: z.number().int().nonnegative().default(0),
  usageEstimated: z.boolean().default(false),
  upstreamCost: decimalStringSchema.default("0.00000000"),
  wholesalePrice: decimalStringSchema.default("0.00000000"),
  retailPrice: decimalStringSchema.default("0.00000000"),
  faucetGrantId: nonEmptyStringSchema.optional(),
  status: usageEventStatusSchema,
  createdAt: timestampSchema.optional(),
});
export type UsageEvent = z.infer<typeof usageEventSchema>;

export const ledgerEntrySchema = z.object({
  id: nonEmptyStringSchema,
  usageEventId: nonEmptyStringSchema.optional(),
  walletId: nonEmptyStringSchema,
  direction: z.enum(["debit", "credit"]),
  amount: decimalStringSchema,
  reason: nonEmptyStringSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: timestampSchema.optional(),
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export const sessionRequestSchema = attributionContextSchema;
export type SessionRequest = AttributionContext;

export const balanceResponseSchema = z.object({
  currency: nonEmptyStringSchema.default("USD"),
  walletBalance: decimalStringSchema,
  faucetBalance: decimalStringSchema,
  activeGrants: z.array(nonEmptyStringSchema),
});
export type BalanceResponse = z.infer<typeof balanceResponseSchema>;

export type HeaderMap = Record<string, string | string[] | undefined>;
export type HeaderLike = HeaderMap | Pick<Headers, "get">;

function getHeaderValue(headers: HeaderLike, name: string): string | undefined {
  if ("get" in headers && typeof headers.get === "function") {
    return headers.get(name) ?? undefined;
  }

  const lowerName = name.toLowerCase();
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === lowerName,
  );

  if (!match) {
    return undefined;
  }

  const value = match[1];
  return Array.isArray(value) ? value[0] : value;
}

export function parseAttributionHeaders(
  headers: HeaderLike,
): AttributionContext {
  return attributionContextSchema.parse({
    appId: getHeaderValue(headers, attributionHeaderNames.appId),
    channelId: getHeaderValue(headers, attributionHeaderNames.channelId),
    endUserId: getHeaderValue(headers, attributionHeaderNames.endUserId),
    useCase: getHeaderValue(headers, attributionHeaderNames.useCase),
    mode: getHeaderValue(headers, attributionHeaderNames.mode),
  });
}
