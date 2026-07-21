import { describe, expect, it } from "vitest";

import {
  calculateUpstreamCost,
  estimateChatTokens,
  findModelPrice,
  priceByokRequest,
  priceLocalRequest,
  priceManagedRequest,
  type ModelPrice,
} from "./src/index";

const prices: ModelPrice[] = [
  {
    provider: "demo",
    model: "demo-model",
    inputPerMtok: "1.00000000",
    outputPerMtok: "2.00000000",
    currency: "USD",
    effectiveAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    provider: "demo",
    model: "demo-model",
    inputPerMtok: "2.00000000",
    outputPerMtok: "4.00000000",
    currency: "USD",
    effectiveAt: new Date("2026-06-01T00:00:00Z"),
  },
];

describe("token estimation", () => {
  it("estimates input and output tokens from chat messages", () => {
    const estimate = estimateChatTokens([
      { content: "a".repeat(400) },
      { content: "b".repeat(40) },
    ]);

    expect(estimate).toEqual({
      inputTokens: 110,
      outputTokens: 64,
      cachedInputTokens: 0,
      usageEstimated: true,
    });
  });
});

describe("model price lookup", () => {
  it("selects the latest price effective at the request time", () => {
    expect(
      findModelPrice(
        prices,
        "demo",
        "demo-model",
        new Date("2026-06-17T00:00:00Z"),
      ),
    )?.toMatchObject({
      inputPerMtok: "2.00000000",
      outputPerMtok: "4.00000000",
    });
  });

  it("returns undefined for unknown provider/model pairs", () => {
    expect(findModelPrice(prices, "missing", "demo-model")).toBeUndefined();
  });
});

describe("pricing formulas", () => {
  it("calculates upstream token cost", () => {
    const cost = calculateUpstreamCost(prices[0], {
      inputTokens: 1000,
      outputTokens: 500,
      cachedInputTokens: 0,
      usageEstimated: false,
    });

    expect(cost).toBe("0.00200000");
  });

  it("calculates managed wholesale and retail pricing with default fees", () => {
    const price = priceManagedRequest({
      modelPrice: prices[0],
      tokenEstimate: {
        inputTokens: 1000,
        outputTokens: 500,
        cachedInputTokens: 0,
        usageEstimated: false,
      },
    });

    expect(price.upstreamCost).toBe("0.00200000");
    expect(price.wholesalePrice).toBe("0.00266000");
    expect(price.retailPrice).toBe("0.00266000");
  });

  it("caps developer and channel markup by policy", () => {
    const price = priceManagedRequest({
      modelPrice: prices[0],
      tokenEstimate: {
        inputTokens: 1000,
        outputTokens: 500,
        cachedInputTokens: 0,
        usageEstimated: false,
      },
      policy: {
        developerMarkupRate: "1.000000",
        channelMarkupRate: "1.000000",
        maxTotalMarkupRate: "0.500000",
      },
    });

    expect(price.developerMarkup).toBe("0.00066500");
    expect(price.channelMarkup).toBe("0.00066500");
    expect(price.retailPrice).toBe("0.00399000");
  });

  it("does not add token resale margin for BYOK or local mode", () => {
    const tokenEstimate = {
      inputTokens: 1000,
      outputTokens: 500,
      cachedInputTokens: 0,
      usageEstimated: true,
    };

    expect(priceByokRequest(tokenEstimate).retailPrice).toBe("0.00000000");
    expect(priceLocalRequest(tokenEstimate).retailPrice).toBe("0.00000000");
  });
});
