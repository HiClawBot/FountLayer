import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { createDatabaseSql } from "@fountlayer/db";

import { buildGatewayServer } from "./server.js";
import { createPostgresGatewayStore } from "./store.js";

const port = Number(process.env.PORT ?? process.env.GATEWAY_PORT ?? 8787);
const host = process.env.GATEWAY_HOST ?? "0.0.0.0";
const storeMode = process.env.FOUNTLAYER_GATEWAY_STORE ?? "memory";

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

function adminTokenHashesFromEnv(): string[] {
  return [
    ...parseCsv(process.env.FOUNTLAYER_ADMIN_TOKEN_SHA256),
    ...parseCsv(process.env.FOUNTLAYER_ADMIN_TOKEN_HASHES),
    ...parseCsv(process.env.FOUNTLAYER_ADMIN_TOKEN).map(hashToken),
  ];
}

function isDirectRun(metaUrl: string): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && pathToFileURL(entrypoint).href === metaUrl);
}

if (isDirectRun(import.meta.url)) {
  const sql = storeMode === "postgres" ? createDatabaseSql() : undefined;
  const server = buildGatewayServer(
    sql ? createPostgresGatewayStore(sql) : undefined,
    { adminTokenHashes: adminTokenHashesFromEnv(), logger: true },
  );

  if (sql) {
    server.addHook("onClose", async () => {
      await sql.end();
    });
  }

  await server.listen({ host, port });
}

export { buildGatewayServer };
export { createPostgresGatewayStore } from "./store.js";
