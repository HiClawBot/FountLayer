import { pathToFileURL } from "node:url";

import { createCredentialCipher } from "@fountlayer/credentials";
import { createDatabaseSql } from "@fountlayer/db";

import { loadGatewayRuntimeConfig } from "./config.js";
import { createGatewayRuntimeAdapter } from "./runtime-adapter.js";
import { buildGatewayServer } from "./server.js";
import { createPostgresGatewayStore } from "./store.js";

function installGracefulShutdown(
  server: ReturnType<typeof buildGatewayServer>,
  graceMs: number,
): void {
  let closing = false;

  const shutdown = (signal: "SIGINT" | "SIGTERM") => {
    if (closing) {
      return;
    }

    closing = true;
    server.log.info({ signal }, "Graceful Gateway shutdown started.");
    const forceExit = setTimeout(() => {
      server.log.error(
        { graceMs, signal },
        "Gateway shutdown exceeded its grace period.",
      );
      process.exit(1);
    }, graceMs);

    forceExit.unref();
    void server.close().then(
      () => {
        clearTimeout(forceExit);
      },
      (error: unknown) => {
        clearTimeout(forceExit);
        server.log.error({ error, signal }, "Gateway shutdown failed.");
        process.exitCode = 1;
      },
    );
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

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
  const runtimeAdapter = createGatewayRuntimeAdapter(config.adapter);
  const adapterHealthCheck = runtimeAdapter?.healthCheck?.bind(runtimeAdapter);
  const server = buildGatewayServer(
    sql ? createPostgresGatewayStore(sql) : undefined,
    {
      adminTokenHashes: config.adminTokenHashes,
      adapter: runtimeAdapter,
      allowHostedByokCredentials: config.allowHostedByokCredentials,
      credentialCipher,
      dependencyHealthChecks: adapterHealthCheck
        ? { adapter: adapterHealthCheck }
        : undefined,
      logger: true,
      rateLimits: config.rateLimits,
      sessionTicketSecret: config.sessionTicketSecret,
    },
  );

  if (sql) {
    server.addHook("onClose", async () => {
      await sql.end();
    });
  }

  installGracefulShutdown(server, config.shutdownGraceMs);
  await server.listen({ host: config.host, port: config.port });
}

export { buildGatewayServer };
export { createPostgresGatewayStore } from "./store.js";
export { createGatewayRuntimeAdapter } from "./runtime-adapter.js";
