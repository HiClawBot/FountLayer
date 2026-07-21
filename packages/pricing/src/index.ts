import type { ChatMessage, FountLayerMode } from "@fountlayer/protocol";
import {
  addMoney,
  divideRoundHalfUp,
  formatFixed,
  formatMoney,
  multiplyMoneyByRate,
  parseFixed,
  parseMoney,
  rateScale,
} from "@fountlayer/money";

export type DecimalString = string;

export type ModelPrice = {
  provider: string;
  model: string;
  inputPerMtok: DecimalString;
  outputPerMtok: DecimalString;
  cachedInputPerMtok?: DecimalString;
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
  platformFeeRate: DecimalString;
  paymentFeeReserveRate: DecimalString;
  riskReserveRate: DecimalString;
  developerMarkupRate: DecimalString;
  channelMarkupRate: DecimalString;
  maxTotalMarkupRate: DecimalString;
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
  platformFeeRate: "0.250000",
  paymentFeeReserveRate: "0.030000",
  riskReserveRate: "0.050000",
  developerMarkupRate: "0.000000",
  channelMarkupRate: "0.000000",
  maxTotalMarkupRate: "1.000000",
};

export const demoModelPrices: ModelPrice[] = [
  {
    provider: "demo",
    model: "demo-local-model",
    inputPerMtok: "0.15000000",
    outputPerMtok: "0.60000000",
    cachedInputPerMtok: "0.05000000",
    currency: "USD",
    effectiveAt: new Date("2026-06-17T00:00:00Z"),
  },
];

function normalizePolicy(policy?: Partial<PricingPolicy>): PricingPolicy {
  return {
    ...defaultPricingPolicy,
    ...policy,
  };
}

function clampMarkupRates(policy: PricingPolicy): {
  developerMarkupRate: string;
  channelMarkupRate: string;
} {
  const developerMarkupRate = parseFixed(policy.developerMarkupRate, rateScale);
  const channelMarkupRate = parseFixed(policy.channelMarkupRate, rateScale);
  const maxTotalMarkupRate = parseFixed(policy.maxTotalMarkupRate, rateScale);

  if (
    developerMarkupRate < 0n ||
    channelMarkupRate < 0n ||
    maxTotalMarkupRate < 0n
  ) {
    throw new Error("Pricing policy rates must be non-negative.");
  }

  const totalMarkupRate = developerMarkupRate + channelMarkupRate;

  if (totalMarkupRate <= maxTotalMarkupRate) {
    return {
      developerMarkupRate: formatFixed(developerMarkupRate, rateScale),
      channelMarkupRate: formatFixed(channelMarkupRate, rateScale),
    };
  }

  if (totalMarkupRate === 0n) {
    return {
      developerMarkupRate: "0.000000",
      channelMarkupRate: "0.000000",
    };
  }

  const clampedDeveloperRate = divideRoundHalfUp(
    developerMarkupRate * maxTotalMarkupRate,
    totalMarkupRate,
  );

  return {
    developerMarkupRate: formatFixed(clampedDeveloperRate, rateScale),
    channelMarkupRate: formatFixed(
      maxTotalMarkupRate - clampedDeveloperRate,
      rateScale,
    ),
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
): DecimalString {
  for (const [field, value] of Object.entries({
    cachedInputTokens: tokenEstimate.cachedInputTokens,
    inputTokens: tokenEstimate.inputTokens,
    outputTokens: tokenEstimate.outputTokens,
  })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${field} must be a non-negative safe integer.`);
    }
  }

  const cachedInputTokens = Math.min(
    tokenEstimate.cachedInputTokens,
    tokenEstimate.inputTokens,
  );
  const billableInputTokens = Math.max(
    0,
    tokenEstimate.inputTokens - cachedInputTokens,
  );
  const numerator =
    BigInt(billableInputTokens) * parseMoney(modelPrice.inputPerMtok) +
    BigInt(cachedInputTokens) *
      parseMoney(modelPrice.cachedInputPerMtok ?? modelPrice.inputPerMtok) +
    BigInt(tokenEstimate.outputTokens) * parseMoney(modelPrice.outputPerMtok);

  return formatMoney(divideRoundHalfUp(numerator, 1_000_000n));
}

export function priceManagedRequest(
  input: ManagedPricingInput,
): PriceBreakdown {
  const policy = normalizePolicy(input.policy);
  const upstreamCost = calculateUpstreamCost(
    input.modelPrice,
    input.tokenEstimate,
  );
  const platformFee = multiplyMoneyByRate(upstreamCost, policy.platformFeeRate);
  const paymentFeeReserve = multiplyMoneyByRate(
    upstreamCost,
    policy.paymentFeeReserveRate,
  );
  const riskReserve = multiplyMoneyByRate(upstreamCost, policy.riskReserveRate);
  const wholesalePrice = addMoney(
    upstreamCost,
    platformFee,
    paymentFeeReserve,
    riskReserve,
  );
  const { developerMarkupRate, channelMarkupRate } = clampMarkupRates(policy);
  const developerMarkup = multiplyMoneyByRate(
    wholesalePrice,
    developerMarkupRate,
  );
  const channelMarkup = multiplyMoneyByRate(wholesalePrice, channelMarkupRate);
  const retailPrice = addMoney(wholesalePrice, developerMarkup, channelMarkup);

  return {
    currency: input.modelPrice.currency,
    mode: "managed",
    inputTokens: input.tokenEstimate.inputTokens,
    outputTokens: input.tokenEstimate.outputTokens,
    cachedInputTokens: Math.min(
      input.tokenEstimate.cachedInputTokens,
      input.tokenEstimate.inputTokens,
    ),
    upstreamCost,
    platformFee,
    paymentFeeReserve,
    riskReserve,
    wholesalePrice,
    developerMarkup,
    channelMarkup,
    retailPrice,
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
