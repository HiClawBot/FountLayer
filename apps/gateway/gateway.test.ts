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
  it("keeps the in-memory demo grant valid for 30 days from initialization", () => {
    const now = new Date("2030-01-01T00:00:00Z");
    const state = createDefaultInMemoryGatewayState(now);

    expect(state.faucetGrants[0]?.expiresAt).toBe("2030-01-31T00:00:00.000Z");
  });

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

  it("revokes sessions through the admin API without exposing token hashes", async () => {
    const server = buildGatewayServer(undefined, {
      adminTokenHashes: [hashTestToken(adminToken)],
    });

    const session = await server.inject({
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
    const token = session.json().token as string;
    const sessionId = session.json().session_id as string;

    const revoked = await server.inject({
      method: "POST",
      url: `/admin/sessions/${sessionId}/revoke`,
      headers: adminHeaders,
    });

    expect(revoked.statusCode).toBe(200);
    expect(revoked.json().session).toMatchObject({
      app_id: "app_pdf_reader",
      channel_id: "channel_desktop",
      end_user_id: "user_hash_123",
      id: sessionId,
      mode: "managed",
      use_case: "paper_summary",
    });
    expect(revoked.json().session.revoked_at).toBeTruthy();
    expect(revoked.body).not.toContain(token);
    expect(revoked.body).not.toContain(hashTestToken(token));

    const balance = await server.inject({
      method: "GET",
      url: "/v1/balance",
      headers: {
        ...attributionHeaders,
        authorization: `Bearer ${token}`,
      },
    });

    expect(balance.statusCode).toBe(401);
    expect(balance.json().error.code).toBe("invalid_auth");
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

  it("creates and updates admin setup records for a billable app path", async () => {
    const state = createDefaultInMemoryGatewayState();
    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
    });

    const app = await server.inject({
      method: "POST",
      url: "/admin/apps",
      headers: adminHeaders,
      payload: {
        developerId: "dev_beta",
        developerName: "Beta Developer",
        id: "app_beta",
        name: "Beta App",
      },
    });
    const channel = await server.inject({
      method: "POST",
      url: "/admin/channels",
      headers: adminHeaders,
      payload: {
        appId: "app_beta",
        id: "channel_beta",
        name: "Beta Web",
        type: "direct",
      },
    });
    const pricing = await server.inject({
      method: "POST",
      url: "/admin/pricing-policies",
      headers: adminHeaders,
      payload: {
        appId: "app_beta",
        id: "policy_beta",
        name: "Beta Pricing",
      },
    });
    const route = await server.inject({
      method: "POST",
      url: "/admin/routes",
      headers: adminHeaders,
      payload: {
        adapter: "local",
        alias: "vertical/beta",
        appId: "app_beta",
        id: "route_beta",
        model: "demo-local-model",
        modelAllowlist: ["demo-local-model"],
        provider: "demo",
      },
    });
    const grant = await server.inject({
      method: "POST",
      url: "/admin/faucet-grants",
      headers: adminHeaders,
      payload: {
        allowedModels: ["vertical/beta", "demo-local-model"],
        allowedUseCases: ["paper_summary"],
        appId: "app_beta",
        channelId: "channel_beta",
        dailyCap: "0.25000000",
        endUserId: "user_beta",
        expiresAt: "2030-01-01T00:00:00Z",
        id: "grant_beta",
        remaining: "1.00000000",
      },
    });

    expect(app.statusCode).toBe(201);
    expect(channel.statusCode).toBe(201);
    expect(pricing.statusCode).toBe(201);
    expect(route.statusCode).toBe(201);
    expect(grant.statusCode).toBe(201);

    const appUpdate = await server.inject({
      method: "PATCH",
      url: "/admin/apps/app_beta",
      headers: adminHeaders,
      payload: {
        defaultPricingPolicyId: "policy_beta",
        defaultRouteId: "route_beta",
        name: "Beta App Updated",
      },
    });
    const channelUpdate = await server.inject({
      method: "PATCH",
      url: "/admin/channels/channel_beta",
      headers: adminHeaders,
      payload: {
        name: "Beta Web Updated",
      },
    });
    const pricingUpdate = await server.inject({
      method: "PATCH",
      url: "/admin/pricing-policies/policy_beta",
      headers: adminHeaders,
      payload: {
        platformFeeRate: "0.200000",
      },
    });
    const routeUpdate = await server.inject({
      method: "PATCH",
      url: "/admin/routes/route_beta",
      headers: adminHeaders,
      payload: {
        maxRetailPrice: "0.50000000",
      },
    });
    const grantUpdate = await server.inject({
      method: "PATCH",
      url: "/admin/faucet-grants/grant_beta",
      headers: adminHeaders,
      payload: {
        dailyCap: "0.50000000",
      },
    });

    expect(appUpdate.statusCode).toBe(200);
    expect(appUpdate.json().app).toMatchObject({
      defaultRoute: "vertical/beta",
      name: "Beta App Updated",
    });
    expect(channelUpdate.statusCode).toBe(200);
    expect(channelUpdate.json().channel.name).toBe("Beta Web Updated");
    expect(pricingUpdate.statusCode).toBe(200);
    expect(pricingUpdate.json().pricing_policy.platformFeeRate).toBe("20%");
    expect(routeUpdate.statusCode).toBe(200);
    expect(grantUpdate.statusCode).toBe(200);
    expect(grantUpdate.json().faucet_grant.dailyCap).toBe("0.50000000");

    const betaAttributionHeaders = {
      authorization: "Bearer fl_beta_seed",
      "x-fl-app-id": "app_beta",
      "x-fl-channel-id": "channel_beta",
      "x-fl-end-user-id": "user_beta",
      "x-fl-mode": "managed",
      "x-fl-use-case": "paper_summary",
    };
    const session = await server.inject({
      method: "POST",
      url: "/v1/sessions",
      headers: betaAttributionHeaders,
      payload: {
        appId: "app_beta",
        channelId: "channel_beta",
        endUserId: "user_beta",
        mode: "managed",
        useCase: "paper_summary",
      },
    });
    const chat = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        ...betaAttributionHeaders,
        authorization: `Bearer ${session.json().token}`,
      },
      payload: {
        messages: [{ role: "user", content: "Summarize beta setup." }],
        model: "vertical/beta",
      },
    });
    const usage = await server.inject({
      method: "GET",
      url: "/admin/usage-events?app_id=app_beta",
      headers: adminHeaders,
    });
    const ledger = await server.inject({
      method: "GET",
      url: "/admin/ledger",
      headers: adminHeaders,
    });

    expect(session.statusCode).toBe(201);
    expect(chat.statusCode).toBe(200);
    expect(chat.json().billing.paid_by).toBe("faucet_grant");
    expect(usage.json().usage_events).toHaveLength(1);
    expect(usage.json().usage_events[0]).toMatchObject({
      appId: "app_beta",
      channelId: "channel_beta",
      faucetGrantId: "grant_beta",
      routeId: "route_beta",
    });
    expect(ledger.json().ledger_entries).toHaveLength(4);
    expect(state.apps.get("app_beta")?.status).toBe("active");
    expect(state.channels.get("channel_beta")?.status).toBe("active");
    expect(
      state.routePolicies.find((item) => item.id === "route_beta"),
    ).toBeDefined();
    expect(
      state.faucetGrants.find((item) => item.id === "grant_beta"),
    ).toBeDefined();
  });

  it("requires faucet grant controls on admin create", async () => {
    const state = createDefaultInMemoryGatewayState();
    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/faucet-grants",
      headers: adminHeaders,
      payload: {
        appId: "app_pdf_reader",
        channelId: "channel_desktop",
        endUserId: "user_hash_123",
        id: "grant_missing_controls",
        remaining: "1.00000000",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_faucet_grant");
    expect(
      state.faucetGrants.some((grant) => grant.id === "grant_missing_controls"),
    ).toBe(false);
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

  it("keeps telemetry failures from changing billable request outcomes", async () => {
    const state = createDefaultInMemoryGatewayState();
    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adminTokenHashes: [hashTestToken(adminToken)],
      telemetrySink: {
        record() {
          throw new Error("telemetry event unavailable");
        },
        recordMetric() {
          throw new Error("telemetry metric unavailable");
        },
        recordSpan() {
          throw new Error("telemetry span unavailable");
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

    expect(response.statusCode).toBe(200);
    expect(response.json().billing.usage_event_id).toMatch(/^ue_/);
    expect(state.usageEvents).toHaveLength(1);
    expect(state.ledgerEntries).toHaveLength(4);
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
    const beforeBalance = await server.inject({
      method: "GET",
      url: "/v1/balance",
      headers,
    });
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
    const afterBalance = await server.inject({
      method: "GET",
      url: "/v1/balance",
      headers,
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
    expect(beforeBalance.json().wallet_balance).toBe("1.00000000");
    expect(response.statusCode).toBe(200);
    expect(response.json().billing.paid_by).toBe("wallet");
    expect(Number(response.json().billing.wallet_balance)).toBeLessThan(1);
    expect(afterBalance.json().wallet_balance).toBe(
      response.json().billing.wallet_balance,
    );
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

  it("rejects concurrent duplicates before a second adapter call", async () => {
    const state = createDefaultInMemoryGatewayState();
    let adapterCalls = 0;
    let releaseAdapter!: () => void;
    let signalAdapterStarted!: () => void;
    const adapterStarted = new Promise<void>((resolve) => {
      signalAdapterStarted = resolve;
    });
    const adapterGate = new Promise<void>((resolve) => {
      releaseAdapter = resolve;
    });
    const server = buildGatewayServer(createInMemoryGatewayStore(state), {
      adapter: {
        async chat(input) {
          adapterCalls += 1;
          signalAdapterStarted();
          await adapterGate;
          return {
            id: input.requestId ?? "adapter_response",
            model: input.model,
            content: "Concurrent response.",
            finishReason: "stop",
            usage: {
              cachedInputTokens: 0,
              inputTokens: 4,
              outputTokens: 2,
              totalTokens: 6,
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
    const request = {
      method: "POST" as const,
      url: "/v1/chat/completions",
      headers: {
        ...headers,
        "idempotency-key": "idem_concurrent",
      },
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Concurrent request." }],
      },
    };
    const firstPromise = server.inject(request);

    await adapterStarted;
    const duplicate = await server.inject(request);
    releaseAdapter();
    const first = await firstPromise;

    expect(first.statusCode).toBe(200);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("idempotency_in_progress");
    expect(adapterCalls).toBe(1);
    expect(state.usageEvents).toHaveLength(1);
    expect(state.ledgerEntries).toHaveLength(4);
  });

  it("rejects reuse of an idempotency key for a different request", async () => {
    const server = buildGatewayServer();
    const headers = await createSessionHeaders(server);
    const request = {
      method: "POST" as const,
      url: "/v1/chat/completions",
      headers: {
        ...headers,
        "idempotency-key": "idem_conflict",
      },
    };
    const first = await server.inject({
      ...request,
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "First request." }],
      },
    });
    const conflict = await server.inject({
      ...request,
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Different request." }],
      },
    });

    expect(first.statusCode).toBe(200);
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("idempotency_conflict");
  });

  it("blocks a completed duplicate after the response cache is lost", async () => {
    const state = createDefaultInMemoryGatewayState();
    const store = createInMemoryGatewayStore(state);
    const firstServer = buildGatewayServer(store);
    const headers = await createSessionHeaders(firstServer);
    const request = {
      method: "POST" as const,
      url: "/v1/chat/completions",
      headers: {
        ...headers,
        "idempotency-key": "idem_restart",
      },
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Restart-safe request." }],
      },
    };
    const first = await firstServer.inject(request);

    await firstServer.close();
    const restartedServer = buildGatewayServer(store);
    const duplicate = await restartedServer.inject(request);

    expect(first.statusCode).toBe(200);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("idempotency_already_completed");
    expect(duplicate.json().error.details.usage_event_id).toBe(
      first.json().billing.usage_event_id,
    );
    expect(state.usageEvents).toHaveLength(1);
    expect(state.ledgerEntries).toHaveLength(4);
  });

  it("releases an idempotency reservation after adapter failure", async () => {
    let adapterCalls = 0;
    const server = buildGatewayServer(undefined, {
      adapter: {
        async chat(input) {
          adapterCalls += 1;

          if (adapterCalls === 1) {
            throw new Error("temporary adapter failure");
          }

          return {
            id: input.requestId ?? "adapter_response",
            model: input.model,
            content: "Recovered response.",
            finishReason: "stop",
            usage: {
              cachedInputTokens: 0,
              inputTokens: 4,
              outputTokens: 2,
              totalTokens: 6,
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
    const request = {
      method: "POST" as const,
      url: "/v1/chat/completions",
      headers: {
        ...headers,
        "idempotency-key": "idem_retry_after_failure",
      },
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Retry after failure." }],
      },
    };
    const failed = await server.inject(request);
    const recovered = await server.inject(request);

    expect(failed.statusCode).toBe(502);
    expect(recovered.statusCode).toBe(200);
    expect(adapterCalls).toBe(2);
  });

  it("keeps reservation-release failures from masking adapter errors", async () => {
    const state = createDefaultInMemoryGatewayState();
    const store = createInMemoryGatewayStore(state);
    store.releaseIdempotentRequest = async () => {
      throw new Error("reservation store unavailable");
    };
    const server = buildGatewayServer(store, {
      adminTokenHashes: [hashTestToken(adminToken)],
      adapter: {
        async chat() {
          throw new Error("provider unavailable");
        },
      },
    });
    const headers = await createSessionHeaders(server);
    const response = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        ...headers,
        "idempotency-key": "idem_release_unavailable",
      },
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Summarize this paper." }],
      },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe("adapter_error");
    expect(state.usageEvents).toHaveLength(0);
    expect(state.ledgerEntries).toHaveLength(0);
  });

  it("rejects idempotency keys longer than 200 characters", async () => {
    const server = buildGatewayServer();
    const headers = await createSessionHeaders(server);
    const response = await server.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        ...headers,
        "idempotency-key": "x".repeat(201),
      },
      payload: {
        model: "vertical/paper-summary",
        messages: [{ role: "user", content: "Too long." }],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_idempotency_key");
  });

  it("allows an expired idempotency lease to be safely reacquired", async () => {
    const state = createDefaultInMemoryGatewayState();
    const store = createInMemoryGatewayStore(state);
    const first = await store.beginIdempotentRequest({
      idempotencyKey: "idem_lease",
      lockedUntil: "2030-01-01T00:01:00.000Z",
      now: new Date("2030-01-01T00:00:00.000Z"),
      requestHash: "hash_1",
      reservationId: "reservation_1",
      sessionId: "sess_1",
    });
    const inProgress = await store.beginIdempotentRequest({
      idempotencyKey: "idem_lease",
      lockedUntil: "2030-01-01T00:01:30.000Z",
      now: new Date("2030-01-01T00:00:30.000Z"),
      requestHash: "hash_1",
      reservationId: "reservation_2",
      sessionId: "sess_1",
    });
    const reacquired = await store.beginIdempotentRequest({
      idempotencyKey: "idem_lease",
      lockedUntil: "2030-01-01T00:03:00.000Z",
      now: new Date("2030-01-01T00:02:00.000Z"),
      requestHash: "hash_1",
      reservationId: "reservation_3",
      sessionId: "sess_1",
    });

    await store.releaseIdempotentRequest({
      idempotencyKey: "idem_lease",
      reservationId: "reservation_1",
      sessionId: "sess_1",
    });

    expect(first.status).toBe("acquired");
    expect(inProgress.status).toBe("in_progress");
    expect(reacquired.status).toBe("acquired");
    expect(state.idempotencyRecords.values().next().value).toMatchObject({
      reservationId: "reservation_3",
      status: "processing",
    });
  });
});
