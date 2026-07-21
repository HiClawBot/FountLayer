import { createHash } from "node:crypto";

import { createCredentialCipher } from "@fountlayer/credentials";
import { defaultDatabaseUrl } from "@fountlayer/db";

import type { GatewayRateLimitOptions } from "./server.js";

export type GatewayStoreMode = "memory" | "postgres";

export type GatewayRuntimeAdapterConfig =
  | {
      mode: "demo";
    }
  | {
      apiKey?: string;
      baseUrl: string;
      mode: "litellm" | "local";
    };

export type GatewayRuntimeConfig = {
  adminTokenHashes: string[];
  adapter: GatewayRuntimeAdapterConfig;
  allowHostedByokCredentials: boolean;
  credentialEncryption?: {
    keyVersion: string;
    masterKey: string;
  };
  deploymentEnv: string;
  host: string;
  isProduction: boolean;
  port: number;
  rateLimits: GatewayRateLimitOptions;
  storeMode: GatewayStoreMode;
};

type GatewayEnv = Record<string, string | undefined>;

const placeholderAdminToken = "change_me_admin_token";
const placeholderAdminTokenHash = hashToken(placeholderAdminToken);

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseCsv(value: string | undefined): string[] {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function isValidSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function parsePort(env: GatewayEnv): number {
  const rawPort = env.PORT ?? env.GATEWAY_PORT ?? "3300";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 3300 || port > 3399) {
    throw new Error(
      `Invalid Gateway port: ${rawPort}. Expected a port between 3300 and 3399.`,
    );
  }

  return port;
}

function parseStoreMode(env: GatewayEnv): GatewayStoreMode {
  const storeMode = env.FOUNTLAYER_GATEWAY_STORE ?? "memory";

  if (storeMode !== "memory" && storeMode !== "postgres") {
    throw new Error(
      `Invalid FOUNTLAYER_GATEWAY_STORE: ${storeMode}. Expected memory or postgres.`,
    );
  }

  return storeMode;
}

function parseHttpUrl(value: string, key: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${key} must use http or https.`);
  }

  return value.replace(/\/+$/, "");
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map((part) => Number(part));

  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.endsWith(".local") ||
    isPrivateIpv4(normalized)
  );
}

function parseAdapterConfig(env: GatewayEnv): GatewayRuntimeAdapterConfig {
  const mode = env.FOUNTLAYER_GATEWAY_ADAPTER ?? "demo";

  if (mode === "demo") {
    return { mode };
  }

  if (mode === "litellm") {
    return {
      apiKey: env.LITELLM_MASTER_KEY?.trim() || undefined,
      baseUrl: parseHttpUrl(
        env.LITELLM_BASE_URL ?? "http://localhost:3305",
        "LITELLM_BASE_URL",
      ),
      mode,
    };
  }

  if (mode === "local") {
    const baseUrl = parseHttpUrl(
      env.LOCAL_OPENAI_BASE_URL ?? "http://127.0.0.1:3314",
      "LOCAL_OPENAI_BASE_URL",
    );
    const hostname = new URL(baseUrl).hostname;

    if (!isLocalHostname(hostname)) {
      throw new Error(
        "LOCAL_OPENAI_BASE_URL must point to localhost, a private LAN address, or a .local host.",
      );
    }

    return {
      apiKey: env.LOCAL_OPENAI_API_KEY?.trim() || undefined,
      baseUrl,
      mode,
    };
  }

  throw new Error(
    `Invalid FOUNTLAYER_GATEWAY_ADAPTER: ${mode}. Expected demo, litellm, or local.`,
  );
}

function parsePositiveInteger(
  env: GatewayEnv,
  key: string,
  defaultValue: number,
): number {
  const rawValue = env[key];

  if (rawValue === undefined || rawValue === "") {
    return defaultValue;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return value;
}

function parseBooleanFlag(env: GatewayEnv, key: string): boolean {
  const rawValue = env[key]?.trim().toLowerCase();

  return rawValue === "1" || rawValue === "true" || rawValue === "yes";
}

function parseCredentialEncryption(
  env: GatewayEnv,
): GatewayRuntimeConfig["credentialEncryption"] {
  const masterKey = env.FOUNTLAYER_CREDENTIAL_MASTER_KEY?.trim();

  if (!masterKey) {
    return undefined;
  }

  const keyVersion =
    env.FOUNTLAYER_CREDENTIAL_KEY_VERSION?.trim() || "local-v1";

  try {
    createCredentialCipher({ keyVersion, masterKey });
  } catch (error) {
    throw new Error(
      `Invalid FOUNTLAYER_CREDENTIAL_MASTER_KEY: ${
        error instanceof Error ? error.message : "credential key rejected"
      }`,
    );
  }

  return {
    keyVersion,
    masterKey,
  };
}

function adminTokenHashesFromEnv(env: GatewayEnv): string[] {
  const configuredHashes = [
    ...parseCsv(env.FOUNTLAYER_ADMIN_TOKEN_SHA256),
    ...parseCsv(env.FOUNTLAYER_ADMIN_TOKEN_HASHES),
  ];
  const invalidHash = configuredHashes.find((hash) => !isValidSha256Hex(hash));

  if (invalidHash) {
    throw new Error(
      "FOUNTLAYER_ADMIN_TOKEN_SHA256 and FOUNTLAYER_ADMIN_TOKEN_HASHES must contain SHA-256 hex values.",
    );
  }

  return [
    ...configuredHashes,
    ...parseCsv(env.FOUNTLAYER_ADMIN_TOKEN).map(hashToken),
  ];
}

function assertProductionSafe(env: GatewayEnv, config: GatewayRuntimeConfig) {
  if (!config.isProduction) {
    return;
  }

  if (config.storeMode !== "postgres") {
    throw new Error(
      "Production Gateway runtime requires FOUNTLAYER_GATEWAY_STORE=postgres.",
    );
  }

  if (env.FOUNTLAYER_ADMIN_TOKEN) {
    throw new Error(
      "Production Gateway runtime requires hashed admin tokens. Use FOUNTLAYER_ADMIN_TOKEN_SHA256 or FOUNTLAYER_ADMIN_TOKEN_HASHES.",
    );
  }

  if (config.adminTokenHashes.length === 0) {
    throw new Error(
      "Production Gateway runtime requires at least one admin token hash.",
    );
  }

  if (config.adminTokenHashes.includes(placeholderAdminTokenHash)) {
    throw new Error(
      "Production Gateway runtime cannot use the placeholder admin token.",
    );
  }

  if (!env.DATABASE_URL || env.DATABASE_URL === defaultDatabaseUrl) {
    throw new Error(
      "Production Gateway runtime requires an explicit non-local DATABASE_URL.",
    );
  }

  if (!config.credentialEncryption) {
    throw new Error(
      "Production Gateway runtime requires FOUNTLAYER_CREDENTIAL_MASTER_KEY for encrypted credential storage.",
    );
  }

  if (config.adapter.mode === "demo") {
    throw new Error(
      "Production Gateway runtime requires FOUNTLAYER_GATEWAY_ADAPTER=litellm or local.",
    );
  }
}

export function loadGatewayRuntimeConfig(
  env: GatewayEnv = process.env,
): GatewayRuntimeConfig {
  const deploymentEnv =
    env.FOUNTLAYER_DEPLOYMENT_ENV ?? env.NODE_ENV ?? "development";
  const config: GatewayRuntimeConfig = {
    adminTokenHashes: adminTokenHashesFromEnv(env),
    adapter: parseAdapterConfig(env),
    allowHostedByokCredentials: parseBooleanFlag(
      env,
      "FOUNTLAYER_ALLOW_HOSTED_BYOK",
    ),
    credentialEncryption: parseCredentialEncryption(env),
    deploymentEnv,
    host: env.GATEWAY_HOST ?? "0.0.0.0",
    isProduction: deploymentEnv === "production",
    port: parsePort(env),
    rateLimits: {
      billableWindowMs: parsePositiveInteger(
        env,
        "FOUNTLAYER_BILLABLE_RATE_WINDOW_MS",
        60 * 60 * 1000,
      ),
      endUserBillableRequestsPerWindow: parsePositiveInteger(
        env,
        "FOUNTLAYER_END_USER_BILLABLE_REQUESTS_PER_WINDOW",
        120,
      ),
      sessionBillableRequestsPerWindow: parsePositiveInteger(
        env,
        "FOUNTLAYER_SESSION_BILLABLE_REQUESTS_PER_WINDOW",
        60,
      ),
    },
    storeMode: parseStoreMode(env),
  };

  assertProductionSafe(env, config);

  return config;
}
