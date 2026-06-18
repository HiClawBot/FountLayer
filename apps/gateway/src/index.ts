import { pathToFileURL } from "node:url";

import { createCredentialCipher } from "@fountlayer/credentials";
import { createDatabaseSql } from "@fountlayer/db";

import { loadGatewayRuntimeConfig } from "./config.js";
import { buildGatewayServer } from "./server.js";
import { createPostgresGatewayStore } from "./store.js";

function isDirectRun(metaUrl: string): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && pathToFileURL(entrypoint).href === metaUrl);
}

if (isDirectRun(import.meta.url)) {
  const config = loadGatewayRuntimeConfig();
  const sql = config.storeMode === "postgres" ? createDatabaseSql() : undefined;
  const credentialCipher = config.credentialEncryption
    ? createCredentialCipher(config.credentialEncryption)
    : undefined;
  const server = buildGatewayServer(
    sql ? createPostgresGatewayStore(sql) : undefined,
    {
      adminTokenHashes: config.adminTokenHashes,
      allowHostedByokCredentials: config.allowHostedByokCredentials,
      credentialCipher,
      logger: true,
      rateLimits: config.rateLimits,
    },
  );

  if (sql) {
    server.addHook("onClose", async () => {
      await sql.end();
    });
  }

  await server.listen({ host: config.host, port: config.port });
}

export { buildGatewayServer };
export { createPostgresGatewayStore } from "./store.js";
