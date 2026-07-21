/* global console, process */

import { execFile } from "node:child_process";
import { chmod, mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { URL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function databaseConnection(databaseUrl) {
  let parsed;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL must use the postgres protocol.");
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));

  if (!parsed.hostname || !database || database.includes("/")) {
    throw new Error("DATABASE_URL must include one database name and host.");
  }

  return {
    database,
    env: {
      ...process.env,
      PGDATABASE: database,
      PGHOST: parsed.hostname,
      PGPASSWORD: decodeURIComponent(parsed.password),
      PGPORT: parsed.port || "5432",
      PGSSLMODE: parsed.searchParams.get("sslmode") ?? "prefer",
      PGUSER: decodeURIComponent(parsed.username),
    },
  };
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for a database backup.");
}

const { database, env } = databaseConnection(databaseUrl);
const [outputArgument] = process.argv
  .slice(2)
  .filter((value) => value !== "--");
const outputDirectory = resolve(outputArgument ?? "backups");
const timestamp = new Date().toISOString().replaceAll(":", "-");
const outputPath = resolve(
  outputDirectory,
  `fountlayer-${database}-${timestamp}.dump`,
);

await mkdir(outputDirectory, { mode: 0o700, recursive: true });
await execFileAsync(
  "pg_dump",
  [
    "--compress=9",
    "--file",
    outputPath,
    "--format=custom",
    "--no-owner",
    "--no-privileges",
  ],
  { env, maxBuffer: 1024 * 1024 },
);
await chmod(outputPath, 0o600);

const backup = await stat(outputPath);

if (backup.size === 0) {
  throw new Error("pg_dump produced an empty backup file.");
}

console.log(
  JSON.stringify(
    {
      database,
      ok: true,
      outputPath,
      sizeBytes: backup.size,
    },
    null,
    2,
  ),
);
