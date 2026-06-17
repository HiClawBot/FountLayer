import { pathToFileURL } from "node:url";

export function isDirectRun(metaUrl: string): boolean {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint && pathToFileURL(entrypoint).href === metaUrl);
}
