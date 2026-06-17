import { createHash, randomUUID } from "node:crypto";

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
import {
  createBalancedLedgerEntries,
  createUsageEvent,
} from "@fountlayer/ledger";
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

import { createInMemoryGatewayStore, type GatewayStore } from "./store.js";

type AuthContext = {
  sessionId: string;
  tokenHash: string;
  expiresAt: string;
  scheme: "Bearer";
};

type ParsedAuthorization = {
  token: string;
  scheme: "Bearer";
};

type GatewayServerOptions = {
  logger?: boolean;
  adapter?: LLMAdapter;
};

declare module "fastify" {
  interface FastifyRequest {
    attribution?: AttributionContext;
    auth?: AuthContext;
  }
}

const defaultWallets = {
  payerWalletId: "wallet_faucet_new_user",
  platformRevenueWalletId: "wallet_platform_revenue",
  platformCostWalletId: "wallet_platform_cost",
  providerPayableWalletId: "wallet_provider_payable",
};

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

function resolvePricedModel(model: string): {
  provider: string;
  model: string;
} {
  if (model === "vertical/paper-summary") {
    return {
      provider: "demo",
      model: "demo-local-model",
    };
  }

  return {
    provider: "demo",
    model,
  };
}

function resolvePriceBreakdown(
  attribution: AttributionContext,
  request: {
    model: string;
    messages: Array<{ content: string }>;
  },
  tokenEstimate = estimateChatTokens(request.messages),
) {
  const pricedModel = resolvePricedModel(request.model);
  const modelPrice = findModelPrice(
    demoModelPrices,
    pricedModel.provider,
    pricedModel.model,
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

export function buildGatewayServer(
  store: GatewayStore = createInMemoryGatewayStore(),
  options: GatewayServerOptions = {},
): FastifyInstance {
  const adapter = options.adapter ?? new DemoLocalAdapter();
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
    reply.header("access-control-allow-origin", "*");
    reply.header(
      "access-control-allow-headers",
      [
        "authorization",
        "content-type",
        "x-fl-app-id",
        "x-fl-channel-id",
        "x-fl-end-user-id",
        "x-fl-use-case",
        "x-fl-mode",
      ].join(", "),
    );
    reply.header("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  server.get("/health", async () => ({
    status: "ok",
    service: "fountlayer-gateway",
  }));

  server.addHook("preHandler", async (request, reply) => {
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
      return jsonError(
        reply,
        500,
        "store_error",
        "Gateway store failed while creating a session.",
        error instanceof Error ? error.message : undefined,
      );
    }

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

    const estimate = resolvePriceBreakdown(attribution, parsed.data);

    if (!estimate) {
      return jsonError(
        reply,
        400,
        "unknown_model",
        "No model price is configured for this route.",
      );
    }
    const grantMatch = await store.findPayingGrant({
      attribution,
      model: parsed.data.model,
      requestedAmount: estimate.retailPrice,
    });

    return {
      currency: "USD",
      model: parsed.data.model,
      estimated_input_tokens: estimate.inputTokens,
      estimated_output_tokens: estimate.outputTokens,
      upstream_cost: estimate.upstreamCost,
      wholesale_price: estimate.wholesalePrice,
      retail_price: estimate.retailPrice,
      payment_source: grantMatch.matched ? "faucet_grant" : "wallet",
    };
  });

  server.post("/v1/chat/completions", async (request, reply) => {
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

    const estimate = resolvePriceBreakdown(attribution, parsed.data);

    if (!estimate) {
      return jsonError(
        reply,
        400,
        "unknown_model",
        "No model price is configured for this route.",
      );
    }

    const faucetMatch = await store.findPayingGrant({
      attribution,
      model: parsed.data.model,
      requestedAmount: estimate.retailPrice,
    });

    if (!faucetMatch.matched) {
      return jsonError(
        reply,
        402,
        "insufficient_balance",
        "No faucet grant or wallet balance can pay for this request.",
        faucetMatch.reasons,
      );
    }

    const requestId = `req_${randomUUID()}`;
    let output: AdapterChatOutput;

    try {
      output = await adapter.chat({
        requestId,
        model: resolvePricedModel(parsed.data.model).model,
        messages: parsed.data.messages,
        stream: parsed.data.stream,
        metadata: parsed.data.metadata,
        attribution,
      });
    } catch (error) {
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
      provider: "demo",
      model: output.model,
      routeId: "route_paper_summary",
      inputTokens: output.usage.inputTokens,
      outputTokens: output.usage.outputTokens,
      cachedInputTokens: output.usage.cachedInputTokens,
      usageEstimated: output.usage.usageEstimated,
      upstreamCost: estimate.upstreamCost,
      wholesalePrice: estimate.wholesalePrice,
      retailPrice: estimate.retailPrice,
      faucetGrantId: faucetMatch.grant.id,
    });
    const ledgerEntries = createBalancedLedgerEntries({
      usageEventId: usageEvent.id,
      wallets: {
        ...defaultWallets,
        payerWalletId: faucetMatch.grant.walletId,
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
    let recordResult;

    try {
      recordResult = await store.recordBillableCall({
        grantId: faucetMatch.grant.id,
        amount: estimate.retailPrice,
        usageEvent,
        ledgerEntries,
      });
    } catch (error) {
      return jsonError(
        reply,
        402,
        "insufficient_balance",
        "Faucet grant could not pay for this request after provider execution.",
        error instanceof Error ? error.message : undefined,
      );
    }

    return {
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
        paid_by: "faucet_grant",
        faucet_remaining: recordResult.updatedGrant.remaining,
        usage_event_id: usageEvent.id,
        ledger_entry_count: ledgerEntries.length,
      },
    };
  });

  server.get("/admin/usage-events", async () => ({
    usage_events: await store.listUsageEvents(),
  }));

  server.get("/admin/ledger", async () => ({
    ledger_entries: await store.listLedgerEntries(),
  }));

  return server;
}
