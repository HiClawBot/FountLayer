import type { ChatMessage, FountLayerMode } from "@fountlayer/protocol";

export type DecimalString = string;

export type ModelPrice = {
  provider: string;
  model: string;
  inputPerMtok: number;
  outputPerMtok: number;
  cachedInputPerMtok?: number;
  currency: string;
  effectiveAt?: Date;
};

export type TokenEstimate = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  usageEstimated: boolean;
};

export type PricingPolicy = {
  platformFeeRate: number;
  paymentFeeReserveRate: number;
  riskReserveRate: number;
  developerMarkupRate: number;
  channelMarkupRate: number;
  maxTotalMarkupRate: number;
};

export type PriceBreakdown = {
  currency: string;
  mode: FountLayerMode;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  upstreamCost: DecimalString;
  platformFee: DecimalString;
  paymentFeeReserve: DecimalString;
  riskReserve: DecimalString;
  wholesalePrice: DecimalString;
  developerMarkup: DecimalString;
  channelMarkup: DecimalString;
  retailPrice: DecimalString;
};

export type ManagedPricingInput = {
  modelPrice: ModelPrice;
  tokenEstimate: TokenEstimate;
  policy?: Partial<PricingPolicy>;
};

export const defaultPricingPolicy: PricingPolicy = {
  platformFeeRate: 0.25,
  paymentFeeReserveRate: 0.03,
  riskReserveRate: 0.05,
  developerMarkupRate: 0,
  channelMarkupRate: 0,
  maxTotalMarkupRate: 1,
};

export const demoModelPrices: ModelPrice[] = [
  {
    provider: "demo",
    model: "demo-local-model",
    inputPerMtok: 0.15,
    outputPerMtok: 0.6,
    cachedInputPerMtok: 0.05,
    currency: "USD",
    effectiveAt: new Date("2026-06-17T00:00:00Z"),
  },
];

function toMoney(value: number): DecimalString {
  return Math.max(0, value).toFixed(8);
}

function normalizePolicy(policy?: Partial<PricingPolicy>): PricingPolicy {
  return {
    ...defaultPricingPolicy,
    ...policy,
  };
}

function clampMarkupRates(policy: PricingPolicy): {
  developerMarkupRate: number;
  channelMarkupRate: number;
} {
  const developerMarkupRate = Math.max(0, policy.developerMarkupRate);
  const channelMarkupRate = Math.max(0, policy.channelMarkupRate);
  const totalMarkupRate = developerMarkupRate + channelMarkupRate;

  if (totalMarkupRate <= policy.maxTotalMarkupRate) {
    return {
      developerMarkupRate,
      channelMarkupRate,
    };
  }

  if (totalMarkupRate === 0) {
    return {
      developerMarkupRate: 0,
      channelMarkupRate: 0,
    };
  }

  const scale = policy.maxTotalMarkupRate / totalMarkupRate;
  return {
    developerMarkupRate: developerMarkupRate * scale,
    channelMarkupRate: channelMarkupRate * scale,
  };
}

export function estimateChatTokens(
  messages: Pick<ChatMessage, "content">[],
  options: {
    outputRatio?: number;
    minimumOutputTokens?: number;
    cachedInputTokens?: number;
  } = {},
): TokenEstimate {
  const contentLength = messages.reduce(
    (total, message) => total + message.content.length,
    0,
  );
  const inputTokens = Math.max(1, Math.ceil(contentLength / 4));
  const outputRatio = options.outputRatio ?? 0.5;
  const minimumOutputTokens = options.minimumOutputTokens ?? 64;

  return {
    inputTokens,
    outputTokens: Math.max(
      minimumOutputTokens,
      Math.ceil(inputTokens * outputRatio),
    ),
    cachedInputTokens: options.cachedInputTokens ?? 0,
    usageEstimated: true,
  };
}

export function findModelPrice(
  prices: ModelPrice[],
  provider: string,
  model: string,
  at: Date = new Date(),
): ModelPrice | undefined {
  return prices
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
}

export function calculateUpstreamCost(
  modelPrice: ModelPrice,
  tokenEstimate: TokenEstimate,
): number {
  const billableInputTokens = Math.max(
    0,
    tokenEstimate.inputTokens - tokenEstimate.cachedInputTokens,
  );
  const uncachedInputCost =
    (billableInputTokens / 1_000_000) * modelPrice.inputPerMtok;
  const cachedInputCost =
    (tokenEstimate.cachedInputTokens / 1_000_000) *
    (modelPrice.cachedInputPerMtok ?? modelPrice.inputPerMtok);
  const outputCost =
    (tokenEstimate.outputTokens / 1_000_000) * modelPrice.outputPerMtok;

  return uncachedInputCost + cachedInputCost + outputCost;
}

export function priceManagedRequest(
  input: ManagedPricingInput,
): PriceBreakdown {
  const policy = normalizePolicy(input.policy);
  const upstreamCost = calculateUpstreamCost(
    input.modelPrice,
    input.tokenEstimate,
  );
  const platformFee = upstreamCost * Math.max(0, policy.platformFeeRate);
  const paymentFeeReserve =
    upstreamCost * Math.max(0, policy.paymentFeeReserveRate);
  const riskReserve = upstreamCost * Math.max(0, policy.riskReserveRate);
  const wholesalePrice =
    upstreamCost + platformFee + paymentFeeReserve + riskReserve;
  const { developerMarkupRate, channelMarkupRate } = clampMarkupRates(policy);
  const developerMarkup = wholesalePrice * developerMarkupRate;
  const channelMarkup = wholesalePrice * channelMarkupRate;
  const retailPrice = wholesalePrice + developerMarkup + channelMarkup;

  return {
    currency: input.modelPrice.currency,
    mode: "managed",
    inputTokens: input.tokenEstimate.inputTokens,
    outputTokens: input.tokenEstimate.outputTokens,
    cachedInputTokens: input.tokenEstimate.cachedInputTokens,
    upstreamCost: toMoney(upstreamCost),
    platformFee: toMoney(platformFee),
    paymentFeeReserve: toMoney(paymentFeeReserve),
    riskReserve: toMoney(riskReserve),
    wholesalePrice: toMoney(wholesalePrice),
    developerMarkup: toMoney(developerMarkup),
    channelMarkup: toMoney(channelMarkup),
    retailPrice: toMoney(retailPrice),
  };
}

export function priceByokRequest(
  tokenEstimate: TokenEstimate,
  currency = "USD",
): PriceBreakdown {
  return zeroPriceBreakdown("byok", tokenEstimate, currency);
}

export function priceLocalRequest(
  tokenEstimate: TokenEstimate,
  currency = "USD",
): PriceBreakdown {
  return zeroPriceBreakdown("local", tokenEstimate, currency);
}

function zeroPriceBreakdown(
  mode: "byok" | "local",
  tokenEstimate: TokenEstimate,
  currency: string,
): PriceBreakdown {
  return {
    currency,
    mode,
    inputTokens: tokenEstimate.inputTokens,
    outputTokens: tokenEstimate.outputTokens,
    cachedInputTokens: tokenEstimate.cachedInputTokens,
    upstreamCost: "0.00000000",
    platformFee: "0.00000000",
    paymentFeeReserve: "0.00000000",
    riskReserve: "0.00000000",
    wholesalePrice: "0.00000000",
    developerMarkup: "0.00000000",
    channelMarkup: "0.00000000",
    retailPrice: "0.00000000",
  };
}
