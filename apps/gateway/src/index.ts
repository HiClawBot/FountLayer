import { pathToFileURL } from "node:url";

import { buildGatewayServer } from "./server.js";

const port = Number(process.env.PORT ?? process.env.GATEWAY_PORT ?? 8787);
const host = process.env.GATEWAY_HOST ?? "0.0.0.0";

function isDirectRun(metaUrl: string): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && pathToFileURL(entrypoint).href === metaUrl);
}

if (isDirectRun(import.meta.url)) {
  const server = buildGatewayServer(undefined, { logger: true });
  await server.listen({ host, port });
}

export { buildGatewayServer };
