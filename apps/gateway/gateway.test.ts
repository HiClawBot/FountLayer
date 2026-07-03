import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createCredentialCipher } from "@fountlayer/credentials";
import { createInMemoryTelemetrySink } from "@fountlayer/observability";
import { CircuitBreaker } from "@fountlayer/reliability";
import { createFountLayer } from "@fountlayer/sdk-js";

import { buildGatewayServer } from "./src/server";
import {
  createDefaultInMemoryGatewayState,
  createInMemoryGatewayStore,
} from "./src/store";

const attributionHeaders = {
  authorization: "Bearer fl_test_token",
  "x-fl-app-id": "app_pdf_reader",
  "x-fl-channel-id": "channel_desktop",
  "x-fl-end-user-id": "user_hash_123",
  "x-fl-use-case": "paper_summary",
  "x-fl-mode": "managed",
};
const adminToken = "fl_admin_test_token";
const adminHeaders = {
  authorization: `Bearer ${adminToken}`,
};
const credentialMasterKey = Buffer.alloc(32, 7);

function hashTestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function createSessionHeaders(
  server: ReturnType<typeof buildGatewayServer>,
) {
  const response = await server.inject({
    method: "POST",
    url: "/v1/sessions",
    headers: attributionHeaders,
    payload: {
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endUserId: "user_hash_123",
      useCase: "paper_summary",
      mode: "managed",
    },
  });

  return {
    ...attributionHeaders,
    authorization: `Bearer ${response.json().token}`,
  };
}

describe("gateway minimum API", () => {
  it("serves a health check without attribution", async () => {
    const server = buildGatewayServer();

    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "fountlayer-gateway",
    });
    expect(response.headers["x-fl-request-id"]).toBeTruthy();
  });

  it("reports dependency health without attribution", async () => {
    const server = buildGatewayServer(undefined, {
      dependencyHealthChecks: {
        adapter: async () => {},
        redis: async () => {},
      },
    });

    const response = await server.inject({
      method: "GET",
      url: "/health/dependencies",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      checks: [
        {
          component: "memory",
          name: "store",
          status: "ok",
        },
        {
          name: "adapter",
          status: "ok",
        },
        {
          name: "redis",
          status: "ok",
        },
      ],
      service: "fountlayer-gateway",
      status: "ok",
    });
  });

  it("reports degraded dependencies without leaking failure details", async () => {
    const server = buildGatewayServer(undefined, {
      dependencyHealthChecks: {
        adapter: async () => {
          throw new Error("provider token provider-secret-placeholder leaked");
        },
        redis: async () => {},
      },
    });

    const response = await server.inject({
      method: "GET",
      url: "/health/dependencies",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      checks: [
        {
          component: "memory",
          name: "store",
          status: "ok",
        },
        {
          name: "adapter",
          status: "error",
        },
        {
          name: "redis",
          status: "ok",
        },
      ],
      service: "fountlayer-gateway",
      status: "degraded",
    });
    expect(response.body).not.toContain("provider-secret-placeholder");
    expect(response.body).not.toContain("provider token");
  });

  it("rejects v1 requests missing attribution headers", async () => {
    const server = buildGatewayServer();

    const response = await server.inject({
      method: "GET",
      url: "/v1/balance",
      headers: {
        authorization: "Bearer fl_test_token",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("missing_attribution");
    expect(response.headers["x-fl-request-id"]).toBeTruthy();
  });

  it("rejects unknown apps after attribution validation", async () => {
    const server = buildGatewayServer();

    const response = await server.inject({
      method: "GET",
      url: "/v1/balance",
      headers: {
        ...attributionHeaders,
        "x-fl-app-id": "app_unknown",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("unknown_app");
  });

  it("rejects invalid session tokens after attribution validation", async () => {
    const server = buildGatewayServer();

    const response = await server.inject({
      method: "GET",
      url: "/v1/balance",
      headers: attributionHeaders,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("invalid_auth");
  });

  it("rejects admin requests when admin auth is not configured", async () => {
    const server = buildGatewayServer();

    const response = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("admin_auth_not_configured");
  });

  it("rejects admin requests missing admin auth", async () => {
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("missing_admin_auth");
  });

  it("rejects admin requests with invalid admin auth", async () => {
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: {
        authorization: "Bearer fl_wrong_admin_token",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("invalid_admin_auth");
  });

  it("serves admin requests with valid admin auth", async () => {
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      page: {
        limit: 100,
        offset: 0,
        returned: 0,
        total: 0,
      },
      usage_events: [],
    });
  });

  it("serves admin console registry data with valid admin auth", async () => {
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
    });
    const endpoints = [
      ["/admin/apps", "apps"],
      ["/admin/channels", "channels"],
      ["/admin/faucet-grants", "faucet_grants"],
      ["/admin/routes", "routes"],
      ["/admin/provider-credentials", "credentials"],
      ["/admin/pricing-policies", "pricing_policies"],
    ] as const;

    for (const [url, key] of endpoints) {
      const response = await server.inject({
        method: "GET",
        url,
        headers: adminHeaders,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()[key]).toHaveLength(1);
      expect(response.json().page).toMatchObject({
        limit: 100,
        offset: 0,
        returned: 1,
        total: 1,
      });
    }
  });

  it("paginates and filters admin list endpoints", async () => {
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
    });

    const routes = await server.inject({
      method: "GET",
      url: "/admin/routes?status=active&limit=1&offset=0&q=paper",
      headers: adminHeaders,
    });
    const grants = await server.inject({
      method: "GET",
      url: "/admin/faucet-grants?app_id=app_pdf_reader&end_user_id=user_hash_123&limit=1",
      headers: adminHeaders,
    });
    const emptyRoutes = await server.inject({
      method: "GET",
      url: "/admin/routes?status=disabled",
      headers: adminHeaders,
    });

    expect(routes.statusCode).toBe(200);
    expect(routes.json().routes).toHaveLength(1);
    expect(routes.json().routes[0]).toMatchObject({
      alias: "vertical/paper-summary",
      status: "active",
    });
    expect(routes.json().page).toEqual({
      limit: 1,
      offset: 0,
      returned: 1,
      total: 1,
    });
    expect(grants.statusCode).toBe(200);
    expect(grants.json().faucet_grants).toHaveLength(1);
    expect(grants.json().page.total).toBe(1);
    expect(emptyRoutes.statusCode).toBe(200);
    expect(emptyRoutes.json()).toMatchObject({
      page: {
        returned: 0,
        total: 0,
      },
      routes: [],
    });
  });

  it("rejects invalid admin list query parameters", async () => {
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
    });

    const response = await server.inject({
      method: "GET",
      url: "/admin/routes?limit=abc",
      headers: adminHeaders,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_admin_list_query");
  });

  it("rejects provider credential writes when encryption is not configured", async () => {
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/provider-credentials",
      headers: adminHeaders,
      payload: {
        apiKey: "provider-secret-placeholder",
        ownerId: "dev_demo",
        ownerType: "developer",
        provider: "demo",
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe(
      "credential_encryption_not_configured",
    );
  });

  it("creates encrypted provider credentials without returning secrets", async () => {
    const state = createDefaultInMemoryGatewayState();
    const cipher = createCredentialCipher({
      keyVersion: "test-v1",
      masterKey: credentialMasterKey,
    });
    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
      credentialCipher: cipher,
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/provider-credentials",
      headers: adminHeaders,
      payload: {
        apiKey: "provider-secret-placeholder",
        budgetDaily: "1.25000000",
        display: "provider-secret-placeholder",
        ownerId: "dev_demo",
        ownerType: "developer",
        provider: "demo",
      },
    });
    const bodyText = response.body;
    const credential = response.json().credential;

    expect(response.statusCode).toBe(201);
    expect(credential).toMatchObject({
      owner: "developer:dev_demo",
      provider: "demo",
      status: "active",
    });
    expect(credential.display).toBe("prov...lder");
    expect(credential.storage).toBe("server-side encrypted:test-v1");
    expect(bodyText).not.toContain("provider-secret-placeholder");
    expect(bodyText).not.toContain("fl_cred_v1");
    expect(state.providerCredentials).toHaveLength(1);
    expect(state.providerCredentials[0]?.encryptedApiKey).toMatch(
      /^fl_cred_v1\./,
    );
    expect(state.providerCredentials[0]?.encryptedApiKey).not.toContain(
      "provider-secret-placeholder",
    );
    expect(
      cipher.decrypt(
        {
          ciphertext: state.providerCredentials[0]!.encryptedApiKey,
          keyVersion: state.providerCredentials[0]!.keyVersion,
        },
        state.providerCredentials[0]!.id,
      ),
    ).toBe("provider-secret-placeholder");
  });

  it("keeps hosted end-user BYOK credential storage disabled by default", async () => {
    const state = createDefaultInMemoryGatewayState();
    const cipher = createCredentialCipher({
      keyVersion: "test-v1",
      masterKey: credentialMasterKey,
    });
    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
      credentialCipher: cipher,
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/provider-credentials",
      headers: adminHeaders,
      payload: {
        apiKey: "provider-secret-placeholder",
        ownerId: "user_hash_123",
        ownerType: "end_user",
        provider: "demo",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("hosted_byok_disabled");
    expect(response.body).not.toContain("provider-secret-placeholder");
    expect(state.providerCredentials).toHaveLength(0);
  });

  it("allows hosted end-user BYOK credential storage only after explicit opt-in", async () => {
    const state = createDefaultInMemoryGatewayState();
    const cipher = createCredentialCipher({
      keyVersion: "test-v1",
      masterKey: credentialMasterKey,
    });
    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
      allowHostedByokCredentials: true,
      credentialCipher: cipher,
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/provider-credentials",
      headers: adminHeaders,
      payload: {
        apiKey: "provider-secret-placeholder",
        ownerId: "user_hash_123",
        ownerType: "end_user",
        provider: "demo",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().credential.owner).toBe("end_user:user_hash_123");
    expect(response.body).not.toContain("provider-secret-placeholder");
    expect(response.body).not.toContain("fl_cred_v1");
    expect(state.providerCredentials).toHaveLength(1);
  });

  it("rotates and deletes provider credentials without returning secret material", async () => {
    const state = createDefaultInMemoryGatewayState();
    const cipher = createCredentialCipher({
      keyVersion: "test-v1",
      masterKey: credentialMasterKey,
    });
    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
      credentialCipher: cipher,
    });
    const created = await server.inject({
      method: "POST",
      url: "/admin/provider-credentials",
      headers: adminHeaders,
      payload: {
        apiKey: "provider-secret-placeholder",
        ownerId: "dev_demo",
        ownerType: "developer",
        provider: "demo",
      },
    });
    const id = created.json().credential.id as string;

    const rotated = await server.inject({
      method: "PATCH",
      url: `/admin/provider-credentials/${id}/rotate`,
      headers: adminHeaders,
      payload: {
        apiKey: "provider-secret-rotated",
      },
    });
    expect(rotated.statusCode).toBe(200);
    expect(rotated.body).not.toContain("provider-secret-rotated");
    expect(rotated.body).not.toContain("fl_cred_v1");
    expect(
      cipher.decrypt(
        {
          ciphertext: state.providerCredentials[0]!.encryptedApiKey,
          keyVersion: state.providerCredentials[0]!.keyVersion,
        },
        id,
      ),
    ).toBe("provider-secret-rotated");

    const deleted = await server.inject({
      method: "DELETE",
      url: `/admin/provider-credentials/${id}`,
      headers: adminHeaders,
    });

    expect(deleted.statusCode).toBe(204);
    expect(state.providerCredentials).toHaveLength(0);
  });

  it("creates a session only when body attribution matches headers", async () => {
    const server = buildGatewayServer();

    const response = await server.inject({
      method: "POST",
      url: "/v1/sessions",
      headers: attributionHeaders,
      payload: {
        appId: "app_pdf_reader",
        channelId: "channel_desktop",
        endUserId: "user_hash_123",
        useCase: "paper_summary",
        mode: "managed",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().token).toMatch(/^fl_sess_/);
  });

  it("returns a cost estimate with a faucet payment source", async () => {
    const server = buildGatewayServer();
    const headers = await createSessionHeaders(server);

    const response = await server.inject({
      method: "POST",
      url: "/v1/estimate",
      headers,
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Summarize this paper." }],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      currency: "USD",
      model: "vertical/paper-summary",
      payment_source: "faucet_grant",
    });
    expect(response.json().route_id).toBe("route_paper_summary");
    expect(response.json().routed_model).toBe("demo-local-model");
    expect(Number(response.json().retail_price)).toBeGreaterThan(0);
  });

  it("routes aliases through store policies before adapter execution", async () => {
    const state = createDefaultInMemoryGatewayState();
    const baseRoute = state.routePolicies[0]!;
    let adapterModel: string | undefined;

    state.routePolicies.push({
      ...baseRoute,
      alias: "smart/default",
      id: "route_smart_default",
    });
    state.faucetGrants[0]!.allowedModels.push("smart/default");

    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
      adapter: {
        async chat(input) {
          adapterModel = input.model;
          return {
            id: input.requestId ?? "req_route_test",
            model: input.model,
            content: "Routed response.",
            finishReason: "stop",
            usage: {
              cachedInputTokens: 0,
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15,
              usageEstimated: false,
            },
            raw: {},
          };
        },
        async *streamChat() {
          yield { done: true };
        },
      },
    });
    const headers = await createSessionHeaders(server);
    const response = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers,
      payload: {
        model: "smart/default",
        messages: [{ role: "user", content: "Summarize this paper." }],
      },
    });
    const usageEvents = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().model).toBe("demo-local-model");
    expect(adapterModel).toBe("demo-local-model");
    expect(usageEvents.json().usage_events[0]).toMatchObject({
      provider: "demo",
      routeId: "route_smart_default",
    });
  });

  it("rejects route policies whose target model is outside the allowlist", async () => {
    const state = createDefaultInMemoryGatewayState();
    const baseRoute = state.routePolicies[0]!;

    state.routePolicies.push({
      ...baseRoute,
      alias: "blocked/default",
      id: "route_blocked_default",
      modelAllowlist: ["other-model"],
    });
    state.faucetGrants[0]!.allowedModels.push("blocked/default");

    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
    });
    const headers = await createSessionHeaders(server);
    const response = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers,
      payload: {
        model: "blocked/default",
        messages: [{ role: "user", content: "Summarize this paper." }],
      },
    });
    const usageEvents = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });
    const ledger = await server.inject({
      method: "GET",
      url: "/admin/ledger",
      headers: adminHeaders,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("route_policy_rejected");
    expect(usageEvents.json().usage_events).toHaveLength(0);
    expect(ledger.json().ledger_entries).toHaveLength(0);
  });

  it("rejects route spend caps before adapter, usage, or ledger writes", async () => {
    const state = createDefaultInMemoryGatewayState();
    const baseRoute = state.routePolicies[0]!;
    const telemetry = createInMemoryTelemetrySink();

    state.routePolicies.push({
      ...baseRoute,
      alias: "cheap/fast",
      id: "route_cheap_fast",
      maxRetailPrice: "0.00000001",
    });
    state.faucetGrants[0]!.allowedModels.push("cheap/fast");

    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
      telemetrySink: telemetry,
    });
    const headers = await createSessionHeaders(server);
    const response = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers,
      payload: {
        model: "cheap/fast",
        messages: [{ role: "user", content: "Summarize this paper." }],
      },
    });
    const usageEvents = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });
    const ledger = await server.inject({
      method: "GET",
      url: "/admin/ledger",
      headers: adminHeaders,
    });

    expect(response.statusCode).toBe(402);
    expect(response.json().error.code).toBe("route_spend_cap_exceeded");
    expect(telemetry.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributes: expect.objectContaining({
            reason: "route_spend_cap_exceeded",
            routeAlias: "cheap/fast",
          }),
          name: "gateway.chat.denied",
        }),
      ]),
    );
    expect(JSON.stringify(telemetry.events)).not.toContain(
      "Summarize this paper.",
    );
    expect(usageEvents.json().usage_events).toHaveLength(0);
    expect(ledger.json().ledger_entries).toHaveLength(0);
  });

  it("exposes active faucet grant controls", async () => {
    const server = buildGatewayServer();
    const headers = await createSessionHeaders(server);

    const response = await server.inject({
      method: "GET",
      url: "/v1/faucet-grants",
      headers,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().grants[0]).toMatchObject({
      id: "grant_new_user",
      remaining: "1.00000000",
      allowed_models: ["vertical/paper-summary", "demo-local-model"],
      allowed_use_cases: ["paper_summary"],
      daily_cap: "0.25000000",
    });
  });

  it("rejects session tokens used with different attribution", async () => {
    const server = buildGatewayServer();
    const headers = await createSessionHeaders(server);

    const response = await server.inject({
      method: "GET",
      url: "/v1/balance",
      headers: {
        ...headers,
        "x-fl-use-case": "different_use_case",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("session_attribution_mismatch");
  });

  it("runs the smallest billable SDK-to-gateway loop", async () => {
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
    });
    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://gateway.test",
      fetchImpl: async (url, init) => {
        const injected = await server.inject({
          method: init?.method ?? "GET",
          url: String(url).replace("http://gateway.test", ""),
          headers: init?.headers as Record<string, string>,
          payload: init?.body ? JSON.parse(String(init.body)) : undefined,
        });

        return new Response(injected.body, {
          status: injected.statusCode,
          headers: {
            "content-type":
              injected.headers["content-type"]?.toString() ??
              "application/json",
          },
        });
      },
    });
    const session = await sdk.startSession({
      endUserId: "user_hash_123",
      useCase: "paper_summary",
      mode: "managed",
    });

    const result = await session.chat({
      model: "vertical/paper-summary",
      messages: [{ role: "user", content: "Summarize this paper." }],
    });
    const usageEvents = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });
    const ledger = await server.inject({
      method: "GET",
      url: "/admin/ledger",
      headers: adminHeaders,
    });

    expect(result.billing.paid_by).toBe("faucet_grant");
    expect(result.billing.usage_event_id).toMatch(/^ue_/);
    expect(usageEvents.json().usage_events).toHaveLength(1);
    expect(ledger.json().ledger_entries).toHaveLength(4);
    expect(ledger.json().ledger_entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: "debit",
          reason: "retail_charge",
        }),
        expect.objectContaining({
          direction: "credit",
          reason: "provider_payable",
        }),
      ]),
    );
  });

  it("records metadata-only telemetry for successful chat calls", async () => {
    const telemetry = createInMemoryTelemetrySink();
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
      telemetrySink: telemetry,
    });
    const headers = await createSessionHeaders(server);
    const response = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers,
      payload: {
        model: "vertical/paper-summary",
        messages: [
          {
            role: "user",
            content: "Sensitive prompt that must not enter telemetry.",
          },
        ],
      },
    });
    const successEvent = telemetry.events.find(
      (event) => event.name === "gateway.chat.success",
    );
    const serializedTelemetry = JSON.stringify({
      events: telemetry.events,
      metrics: telemetry.metrics,
      spans: telemetry.spans,
    });

    expect(response.statusCode).toBe(200);
    expect(successEvent?.attributes).toMatchObject({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      paidBy: "faucet_grant",
      routeId: "route_paper_summary",
    });
    expect(telemetry.spans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "gateway.adapter.call",
          status: "ok",
        }),
        expect.objectContaining({
          name: "gateway.billing.write",
          status: "ok",
        }),
        expect.objectContaining({
          name: "gateway.chat",
          status: "ok",
        }),
      ]),
    );
    expect(telemetry.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "gateway.chat.tokens",
          unit: "tokens",
          value: expect.any(Number),
        }),
        expect.objectContaining({
          name: "gateway.chat.retail_price",
          unit: "USD",
        }),
        expect.objectContaining({
          name: "gateway.chat.latency",
          unit: "ms",
        }),
      ]),
    );
    expect(serializedTelemetry).not.toContain("Sensitive prompt");
    expect(serializedTelemetry).not.toContain("Demo summary");
  });

  it("retries adapter failures without duplicating usage or ledger records", async () => {
    let attempts = 0;
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
      adapterRetry: {
        maxAttempts: 2,
      },
      adapter: {
        async chat(input) {
          attempts += 1;

          if (attempts === 1) {
            throw new Error("temporary adapter failure");
          }

          return {
            id: input.requestId ?? "req_retry_test",
            model: input.model,
            content: "Retry succeeded.",
            finishReason: "stop",
            usage: {
              cachedInputTokens: 0,
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15,
              usageEstimated: false,
            },
            raw: {},
          };
        },
        async *streamChat() {
          yield { done: true };
        },
      },
    });
    const headers = await createSessionHeaders(server);
    const response = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers,
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Summarize this paper." }],
      },
    });
    const usageEvents = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });
    const ledger = await server.inject({
      method: "GET",
      url: "/admin/ledger",
      headers: adminHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(attempts).toBe(2);
    expect(usageEvents.json().usage_events).toHaveLength(1);
    expect(ledger.json().ledger_entries).toHaveLength(4);
  });

  it("opens adapter circuits without writing usage or ledger records", async () => {
    let attempts = 0;
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetAfterMs: 60_000,
    });
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
      adapterCircuitBreaker: breaker,
      adapter: {
        async chat() {
          attempts += 1;
          throw new Error("adapter down");
        },
        async *streamChat() {
          yield { done: true };
        },
      },
    });
    const headers = await createSessionHeaders(server);
    const payload = {
      model: "vertical/paper-summary",
      messages: [{ role: "user", content: "Summarize this paper." }],
    };
    const first = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers,
      payload,
    });
    const second = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers,
      payload,
    });
    const usageEvents = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });
    const ledger = await server.inject({
      method: "GET",
      url: "/admin/ledger",
      headers: adminHeaders,
    });

    expect(first.statusCode).toBe(502);
    expect(second.statusCode).toBe(503);
    expect(second.json().error.code).toBe("adapter_circuit_open");
    expect(attempts).toBe(1);
    expect(usageEvents.json().usage_events).toHaveLength(0);
    expect(ledger.json().ledger_entries).toHaveLength(0);
  });

  it("purges expired request metadata without deleting usage or ledger records", async () => {
    const state = createDefaultInMemoryGatewayState();
    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
    });
    const headers = await createSessionHeaders(server);
    const response = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers,
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Summarize this paper." }],
      },
    });

    expect(response.statusCode).toBe(200);
    state.ledgerEntries = state.ledgerEntries.map((entry) => ({
      ...entry,
      createdAt: "2000-01-01T00:00:00.000Z",
    }));
    expect(state.ledgerEntries[0]?.metadata).toMatchObject({
      endUserId: "user_hash_123",
      requestId: expect.stringMatching(/^req_/),
    });

    const purge = await server.inject({
      method: "POST",
      url: "/admin/privacy/request-metadata/purge",
      headers: adminHeaders,
      payload: {
        retentionDays: 1,
      },
    });
    const usageEvents = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });
    const ledger = await server.inject({
      method: "GET",
      url: "/admin/ledger",
      headers: adminHeaders,
    });

    expect(purge.statusCode).toBe(200);
    expect(purge.json().request_metadata_retention.ledger_entries_updated).toBe(
      4,
    );
    expect(usageEvents.json().usage_events).toHaveLength(1);
    expect(ledger.json().ledger_entries).toHaveLength(4);
    expect(
      ledger
        .json()
        .ledger_entries.every(
          (entry: { metadata: Record<string, unknown> }) =>
            Object.keys(entry.metadata).length === 0,
        ),
    ).toBe(true);
  });

  it("anonymizes app-owned end-user identifiers without deleting billable records", async () => {
    const state = createDefaultInMemoryGatewayState();
    const cipher = createCredentialCipher({
      keyVersion: "test-v1",
      masterKey: credentialMasterKey,
    });
    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
      allowHostedByokCredentials: true,
      credentialCipher: cipher,
    });
    const headers = await createSessionHeaders(server);
    const credential = await server.inject({
      method: "POST",
      url: "/admin/provider-credentials",
      headers: adminHeaders,
      payload: {
        apiKey: "provider-secret-placeholder",
        ownerId: "user_hash_123",
        ownerType: "end_user",
        provider: "demo",
      },
    });
    const chat = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers,
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Summarize this paper." }],
      },
    });

    expect(credential.statusCode).toBe(201);
    expect(chat.statusCode).toBe(200);

    const anonymized = await server.inject({
      method: "POST",
      url: "/admin/privacy/end-users/anonymize",
      headers: adminHeaders,
      payload: {
        appId: "app_pdf_reader",
        endUserId: "user_hash_123",
      },
    });
    const privacy = anonymized.json().end_user_privacy;
    const tombstone = privacy.tombstone_end_user_id as string;
    const usageEvents = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });
    const ledger = await server.inject({
      method: "GET",
      url: "/admin/ledger",
      headers: adminHeaders,
    });
    const grants = await server.inject({
      method: "GET",
      url: "/admin/faucet-grants",
      headers: adminHeaders,
    });
    const credentials = await server.inject({
      method: "GET",
      url: "/admin/provider-credentials",
      headers: adminHeaders,
    });
    const oldSession = await server.inject({
      method: "GET",
      url: "/v1/balance",
      headers,
    });

    expect(anonymized.statusCode).toBe(200);
    expect(anonymized.body).not.toContain("user_hash_123");
    expect(tombstone).toMatch(/^deleted_user_[a-f0-9]{24}$/);
    expect(privacy.sessions_revoked).toBe(1);
    expect(privacy.faucet_grants_anonymized).toBe(1);
    expect(privacy.faucet_grants_revoked).toBe(1);
    expect(privacy.usage_events_anonymized).toBe(1);
    expect(privacy.ledger_entries_scrubbed).toBe(4);
    expect(privacy.provider_credentials_revoked).toBe(1);
    expect(privacy.wallets_anonymized).toBe(1);
    expect(usageEvents.json().usage_events).toHaveLength(1);
    expect(usageEvents.json().usage_events[0].endUserId).toBe(tombstone);
    expect(ledger.json().ledger_entries).toHaveLength(4);
    expect(ledger.body).not.toContain("user_hash_123");
    expect(
      ledger
        .json()
        .ledger_entries.every(
          (entry: { metadata: { endUserId?: string } }) =>
            entry.metadata.endUserId === tombstone,
        ),
    ).toBe(true);
    expect(grants.json().faucet_grants[0]).toMatchObject({
      endUserId: tombstone,
      status: "revoked",
    });
    expect(credentials.json().credentials[0]).toMatchObject({
      owner: `end_user:${tombstone}`,
      status: "revoked",
    });
    expect(state.wallets.get("wallet_user_demo")?.ownerId).toBe(tombstone);
    expect(oldSession.statusCode).toBe(401);
  });

  it("falls back to wallet-funded calls when no faucet grant can pay", async () => {
    const state = createDefaultInMemoryGatewayState();

    state.faucetGrants = [];
    state.wallets.set("wallet_user_demo", {
      id: "wallet_user_demo",
      ownerType: "end_user",
      ownerId: "user_hash_123",
      balance: "1.00000000",
      currency: "USD",
    });

    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
    });
    const headers = await createSessionHeaders(server);
    const estimate = await server.inject({
      method: "POST",
      url: "/v1/estimate",
      headers,
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Summarize this paper." }],
      },
    });
    const response = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers,
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Summarize this paper." }],
      },
    });
    const usageEvents = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });
    const ledger = await server.inject({
      method: "GET",
      url: "/admin/ledger",
      headers: adminHeaders,
    });

    expect(estimate.json().payment_source).toBe("wallet");
    expect(response.statusCode).toBe(200);
    expect(response.json().billing.paid_by).toBe("wallet");
    expect(Number(response.json().billing.wallet_balance)).toBeLessThan(1);
    expect(usageEvents.json().usage_events).toHaveLength(1);
    expect(usageEvents.json().usage_events[0].faucetGrantId).toBeUndefined();
    expect(ledger.json().ledger_entries).toHaveLength(4);
    expect(ledger.json().ledger_entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          walletId: "wallet_user_demo",
          direction: "debit",
          reason: "retail_charge",
        }),
      ]),
    );
  });

  it("rejects wallet-funded calls with insufficient wallet balance", async () => {
    const state = createDefaultInMemoryGatewayState();

    state.faucetGrants = [];
    state.wallets.set("wallet_user_demo", {
      id: "wallet_user_demo",
      ownerType: "end_user",
      ownerId: "user_hash_123",
      balance: "0.00000000",
      currency: "USD",
    });

    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
    });
    const headers = await createSessionHeaders(server);
    const response = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers,
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Summarize this paper." }],
      },
    });
    const usageEvents = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });
    const ledger = await server.inject({
      method: "GET",
      url: "/admin/ledger",
      headers: adminHeaders,
    });

    expect(response.statusCode).toBe(402);
    expect(response.json().error.code).toBe("insufficient_balance");
    expect(state.wallets.get("wallet_user_demo")?.balance).toBe("0.00000000");
    expect(usageEvents.json().usage_events).toHaveLength(0);
    expect(ledger.json().ledger_entries).toHaveLength(0);
  });

  it("rate limits billable chat calls before creating usage or ledger records", async () => {
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
      rateLimits: {
        billableWindowMs: 60_000,
        endUserBillableRequestsPerWindow: 100,
        sessionBillableRequestsPerWindow: 1,
      },
    });
    const sdk = createFountLayer({
      appId: "app_pdf_reader",
      channelId: "channel_desktop",
      endpoint: "http://gateway.test",
      fetchImpl: async (url, init) => {
        const injected = await server.inject({
          method: init?.method ?? "GET",
          url: String(url).replace("http://gateway.test", ""),
          headers: init?.headers as Record<string, string>,
          payload: init?.body ? JSON.parse(String(init.body)) : undefined,
        });

        return new Response(injected.body, {
          status: injected.statusCode,
          headers: {
            "content-type":
              injected.headers["content-type"]?.toString() ??
              "application/json",
          },
        });
      },
    });
    const session = await sdk.startSession({
      endUserId: "user_hash_123",
      useCase: "paper_summary",
      mode: "managed",
    });

    await session.chat({
      model: "vertical/paper-summary",
      messages: [{ role: "user", content: "Summarize this paper." }],
    });

    await expect(
      session.chat({
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Summarize this paper again." }],
      }),
    ).rejects.toThrow("Session billable request limit exceeded.");

    const usageEvents = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });
    const ledger = await server.inject({
      method: "GET",
      url: "/admin/ledger",
      headers: adminHeaders,
    });

    expect(usageEvents.json().usage_events).toHaveLength(1);
    expect(ledger.json().ledger_entries).toHaveLength(4);
  });

  it("replays idempotent billable chat responses without new usage or ledger records", async () => {
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
    });
    const headers = await createSessionHeaders(server);
    const payload = {
      model: "vertical/paper-summary",
      messages: [{ role: "user", content: "Summarize this paper." }],
    };
    const first = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        ...headers,
        "idempotency-key": "idem_test_1",
      },
      payload,
    });
    const second = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        ...headers,
        "idempotency-key": "idem_test_1",
      },
      payload,
    });
    const usageEvents = await server.inject({
      method: "GET",
      url: "/admin/usage-events",
      headers: adminHeaders,
    });
    const ledger = await server.inject({
      method: "GET",
      url: "/admin/ledger",
      headers: adminHeaders,
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);
    expect(second.json().billing.usage_event_id).toBe(
      first.json().billing.usage_event_id,
    );
    expect(usageEvents.json().usage_events).toHaveLength(1);
    expect(ledger.json().ledger_entries).toHaveLength(4);
  });
});
