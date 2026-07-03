/* global console, process */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
]);
const ignoredFiles = new Set(["fountlayer_project_docs.zip"]);
const binaryExtensions = new Set([
  ".db",
  ".gif",
  ".ico",
  ".jpg",
  ".jpeg",
  ".node",
  ".pdf",
  ".png",
  ".sqlite",
  ".webp",
  ".zip",
]);
const patterns = [
  {
    name: "openai_api_key",
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "google_api_key",
    pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  },
  {
    name: "slack_token",
    pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g,
  },
  {
    name: "anthropic_api_key",
    pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  },
];

function extension(path) {
  const index = path.lastIndexOf(".");

  return index === -1 ? "" : path.slice(index).toLowerCase();
}

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const relativePath = relative(root, path);

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }

      yield* walk(path);
      continue;
    }

    if (
      entry.isFile() &&
      !ignoredFiles.has(relativePath) &&
      !binaryExtensions.has(extension(entry.name))
    ) {
      yield path;
    }
  }
}

const findings = [];

for await (const path of walk(root)) {
  const fileStat = await stat(path);

  if (fileStat.size > 2 * 1024 * 1024) {
    continue;
  }

  const text = await readFile(path, "utf8").catch(() => undefined);

  if (text === undefined) {
    continue;
  }

  for (const { name, pattern } of patterns) {
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(0, match.index).split("\n");

      findings.push({
        file: relative(root, path),
        line: before.length,
        pattern: name,
      });
    }
  }
}

if (findings.length > 0) {
  console.error(JSON.stringify({ ok: false, findings }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, findings: [] }, null, 2));
