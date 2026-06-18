import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createFountLayer } from "@fountlayer/sdk-js";

import { buildGatewayServer } from "./src/server";

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
    }
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
    expect(Number(response.json().retail_price)).toBeGreaterThan(0);
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
});
