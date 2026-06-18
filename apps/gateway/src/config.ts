import { createHash } from "node:crypto";

import { defaultDatabaseUrl } from "@fountlayer/db";

export type GatewayStoreMode = "memory" | "postgres";

export type GatewayRuntimeConfig = {
  adminTokenHashes: string[];
  deploymentEnv: string;
  host: string;
  isProduction: boolean;
  port: number;
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
  const rawPort = env.PORT ?? env.GATEWAY_PORT ?? "8787";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid Gateway port: ${rawPort}`);
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
}

export function loadGatewayRuntimeConfig(
  env: GatewayEnv = process.env,
): GatewayRuntimeConfig {
  const deploymentEnv =
    env.FOUNTLAYER_DEPLOYMENT_ENV ?? env.NODE_ENV ?? "development";
  const config: GatewayRuntimeConfig = {
    adminTokenHashes: adminTokenHashesFromEnv(env),
    deploymentEnv,
    host: env.GATEWAY_HOST ?? "0.0.0.0",
    isProduction: deploymentEnv === "production",
    port: parsePort(env),
    storeMode: parseStoreMode(env),
  };

  assertProductionSafe(env, config);

  return config;
}
