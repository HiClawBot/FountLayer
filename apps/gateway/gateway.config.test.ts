import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { loadGatewayRuntimeConfig } from "./src/config";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function credentialMasterKeyEnv(): string {
  return `base64:${Buffer.alloc(32, 9).toString("base64")}`;
}

describe("gateway runtime config", () => {
  it("loads development defaults with a local admin token", () => {
    const config = loadGatewayRuntimeConfig({
      FOUNTLAYER_ADMIN_TOKEN: "fl_admin_local",
      FOUNTLAYER_CREDENTIAL_MASTER_KEY: credentialMasterKeyEnv(),
      FOUNTLAYER_CREDENTIAL_KEY_VERSION: "test-v1",
    });

    expect(config).toMatchObject({
      adapter: {
        mode: "demo",
      },
      allowHostedByokCredentials: false,
      credentialEncryption: {
        keyVersion: "test-v1",
      },
      deploymentEnv: "development",
      host: "0.0.0.0",
      isProduction: false,
      port: 3300,
      rateLimits: {
        billableWindowMs: 3600000,
        endUserBillableRequestsPerWindow: 120,
        sessionBillableRequestsPerWindow: 60,
        sessionCreationsPerWindow: 20,
      },
      sessionTicketSecret: "change_me_session_ticket_secret_32_bytes_minimum",
      storeMode: "memory",
    });
    expect(config.adminTokenHashes).toHaveLength(1);
    expect(config.adminTokenHashes[0]).toHaveLength(64);
    expect(config.credentialEncryption?.masterKey).toBe(
      credentialMasterKeyEnv(),
    );
  });

  it("supports comma-separated admin token hashes", () => {
    const firstHash = hashToken("fl_admin_one");
    const secondHash = hashToken("fl_admin_two");
    const config = loadGatewayRuntimeConfig({
      FOUNTLAYER_ADMIN_TOKEN_HASHES: `${firstHash}, ${secondHash}`,
    });

    expect(config.adminTokenHashes).toEqual([firstHash, secondHash]);
  });

  it("loads explicit hosted BYOK opt-in", () => {
    const config = loadGatewayRuntimeConfig({
      FOUNTLAYER_ALLOW_HOSTED_BYOK: "true",
    });

    expect(config.allowHostedByokCredentials).toBe(true);
  });

  it("loads LiteLLM adapter configuration", () => {
    const config = loadGatewayRuntimeConfig({
      FOUNTLAYER_GATEWAY_ADAPTER: "litellm",
      LITELLM_BASE_URL: "http://localhost:3305/v1/",
      LITELLM_MASTER_KEY: "litellm-placeholder",
    });

    expect(config.adapter).toEqual({
      apiKey: "litellm-placeholder",
      baseUrl: "http://localhost:3305/v1",
      mode: "litellm",
    });
  });

  it("loads private local adapter configuration", () => {
    const config = loadGatewayRuntimeConfig({
      FOUNTLAYER_GATEWAY_ADAPTER: "local",
      LOCAL_OPENAI_API_KEY: "local-placeholder",
      LOCAL_OPENAI_BASE_URL: "http://192.168.1.20:3314/v1/",
    });

    expect(config.adapter).toEqual({
      apiKey: "local-placeholder",
      baseUrl: "http://192.168.1.20:3314/v1",
      mode: "local",
    });
  });

  it("rejects public endpoints for local adapter mode", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        FOUNTLAYER_GATEWAY_ADAPTER: "local",
        LOCAL_OPENAI_BASE_URL: "https://api.example.com/v1",
      }),
    ).toThrow("localhost, a private LAN address, or a .local host");
  });

  it("rejects invalid adapter modes", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        FOUNTLAYER_GATEWAY_ADAPTER: "unknown",
      }),
    ).toThrow("Invalid FOUNTLAYER_GATEWAY_ADAPTER");
  });

  it("rejects invalid ports", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        GATEWAY_PORT: "not-a-port",
      }),
    ).toThrow("Invalid Gateway port");
  });

  it("rejects invalid store modes", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        FOUNTLAYER_GATEWAY_STORE: "sqlite",
      }),
    ).toThrow("Invalid FOUNTLAYER_GATEWAY_STORE");
  });

  it("rejects invalid rate limit values", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        FOUNTLAYER_SESSION_BILLABLE_REQUESTS_PER_WINDOW: "0",
      }),
    ).toThrow("must be a positive integer");
  });

  it("rejects invalid credential master keys", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        FOUNTLAYER_CREDENTIAL_MASTER_KEY: "too-short",
      }),
    ).toThrow("Invalid FOUNTLAYER_CREDENTIAL_MASTER_KEY");
  });

  it("rejects weak session ticket secrets", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        FOUNTLAYER_SESSION_TICKET_SECRET: "too-short",
      }),
    ).toThrow(
      "FOUNTLAYER_SESSION_TICKET_SECRET must be at least 32 characters",
    );
  });

  it("rejects non-hash admin token values in hash variables", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        FOUNTLAYER_ADMIN_TOKEN_SHA256: "not_a_hash",
      }),
    ).toThrow("must contain SHA-256 hex values");
  });

  it("rejects memory store in production", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        FOUNTLAYER_ADMIN_TOKEN_SHA256: hashToken("fl_admin_prod"),
        FOUNTLAYER_DEPLOYMENT_ENV: "production",
        FOUNTLAYER_GATEWAY_STORE: "memory",
      }),
    ).toThrow("requires FOUNTLAYER_GATEWAY_STORE=postgres");
  });

  it("rejects plaintext admin tokens in production", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        DATABASE_URL: "postgres://user:pass@db.example/fountlayer",
        FOUNTLAYER_ADMIN_TOKEN: "fl_admin_prod",
        FOUNTLAYER_CREDENTIAL_MASTER_KEY: credentialMasterKeyEnv(),
        FOUNTLAYER_DEPLOYMENT_ENV: "production",
        FOUNTLAYER_GATEWAY_STORE: "postgres",
      }),
    ).toThrow("requires hashed admin tokens");
  });

  it("rejects placeholder admin token hashes in production", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        DATABASE_URL: "postgres://user:pass@db.example/fountlayer",
        FOUNTLAYER_ADMIN_TOKEN_SHA256: hashToken("change_me_admin_token"),
        FOUNTLAYER_CREDENTIAL_MASTER_KEY: credentialMasterKeyEnv(),
        FOUNTLAYER_DEPLOYMENT_ENV: "production",
        FOUNTLAYER_GATEWAY_STORE: "postgres",
      }),
    ).toThrow("placeholder admin token");
  });

  it("rejects the default local database URL in production", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        DATABASE_URL: "postgres://postgres:postgres@localhost:3332/fountlayer",
        FOUNTLAYER_ADMIN_TOKEN_SHA256: hashToken("fl_admin_prod"),
        FOUNTLAYER_CREDENTIAL_MASTER_KEY: credentialMasterKeyEnv(),
        FOUNTLAYER_DEPLOYMENT_ENV: "production",
        FOUNTLAYER_GATEWAY_STORE: "postgres",
      }),
    ).toThrow("requires an explicit non-local DATABASE_URL");
  });

  it("requires credential encryption in production", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        DATABASE_URL: "postgres://user:pass@db.example/fountlayer",
        FOUNTLAYER_ADMIN_TOKEN_SHA256: hashToken("fl_admin_prod"),
        FOUNTLAYER_DEPLOYMENT_ENV: "production",
        FOUNTLAYER_GATEWAY_STORE: "postgres",
      }),
    ).toThrow("requires FOUNTLAYER_CREDENTIAL_MASTER_KEY");
  });

  it("rejects the demo adapter in production", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        DATABASE_URL: "postgres://user:pass@db.example/fountlayer",
        FOUNTLAYER_ADMIN_TOKEN_SHA256: hashToken("fl_admin_prod"),
        FOUNTLAYER_CREDENTIAL_MASTER_KEY: credentialMasterKeyEnv(),
        FOUNTLAYER_DEPLOYMENT_ENV: "production",
        FOUNTLAYER_GATEWAY_STORE: "postgres",
      }),
    ).toThrow("requires FOUNTLAYER_GATEWAY_ADAPTER=litellm or local");
  });

  it("loads production config when required controls are set", () => {
    const adminHash = hashToken("fl_admin_prod");
    const config = loadGatewayRuntimeConfig({
      DATABASE_URL: "postgres://user:pass@db.example/fountlayer",
      FOUNTLAYER_ADMIN_TOKEN_SHA256: adminHash,
      FOUNTLAYER_CREDENTIAL_MASTER_KEY: credentialMasterKeyEnv(),
      FOUNTLAYER_DEPLOYMENT_ENV: "production",
      FOUNTLAYER_GATEWAY_ADAPTER: "local",
      FOUNTLAYER_GATEWAY_STORE: "postgres",
      FOUNTLAYER_SESSION_TICKET_SECRET:
        "production-session-ticket-secret-with-32-characters",
      GATEWAY_HOST: "127.0.0.1",
      GATEWAY_PORT: "3390",
    });

    expect(config).toMatchObject({
      adminTokenHashes: [adminHash],
      allowHostedByokCredentials: false,
      credentialEncryption: {
        keyVersion: "local-v1",
      },
      deploymentEnv: "production",
      host: "127.0.0.1",
      isProduction: true,
      port: 3390,
      adapter: {
        baseUrl: "http://127.0.0.1:3314",
        mode: "local",
      },
      storeMode: "postgres",
    });
  });

  it("rejects the development session ticket secret in production", () => {
    expect(() =>
      loadGatewayRuntimeConfig({
        DATABASE_URL: "postgres://user:pass@db.example/fountlayer",
        FOUNTLAYER_ADMIN_TOKEN_SHA256: hashToken("fl_admin_prod"),
        FOUNTLAYER_CREDENTIAL_MASTER_KEY: credentialMasterKeyEnv(),
        FOUNTLAYER_DEPLOYMENT_ENV: "production",
        FOUNTLAYER_GATEWAY_ADAPTER: "local",
        FOUNTLAYER_GATEWAY_STORE: "postgres",
      }),
    ).toThrow("non-placeholder FOUNTLAYER_SESSION_TICKET_SECRET");
  });
});
