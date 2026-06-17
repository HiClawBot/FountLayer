import { pathToFileURL } from "node:url";

import { createDatabaseSql } from "@fountlayer/db";

import { buildGatewayServer } from "./server.js";
import { createPostgresGatewayStore } from "./store.js";

const port = Number(process.env.PORT ?? process.env.GATEWAY_PORT ?? 8787);
const host = process.env.GATEWAY_HOST ?? "0.0.0.0";
const storeMode = process.env.FOUNTLAYER_GATEWAY_STORE ?? "memory";

function isDirectRun(metaUrl: string): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && pathToFileURL(entrypoint).href === metaUrl);
}

if (isDirectRun(import.meta.url)) {
  const sql = storeMode === "postgres" ? createDatabaseSql() : undefined;
  const server = buildGatewayServer(
    sql ? createPostgresGatewayStore(sql) : undefined,
    { logger: true },
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
