/* global console, process */

import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { URL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function databaseEnvironment(databaseUrl) {
  let parsed;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL must use the postgres protocol.");
  }

  if (!parsed.hostname || !parsed.username) {
    throw new Error("DATABASE_URL must include a host and user.");
  }

  return {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGPORT: parsed.port || "5432",
    PGSSLMODE: parsed.searchParams.get("sslmode") ?? "prefer",
    PGUSER: decodeURIComponent(parsed.username),
  };
}

const databaseUrl = process.env.DATABASE_URL;
const [backupArgument] = process.argv
  .slice(2)
  .filter((value) => value !== "--");
const backupPath = backupArgument ? resolve(backupArgument) : undefined;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for a restore verification.");
}

if (!backupPath) {
  throw new Error("Pass the trusted backup file to verify.");
}

const backup = await stat(backupPath);

if (!backup.isFile() || backup.size === 0) {
  throw new Error("The backup must be a non-empty file.");
}

const env = databaseEnvironment(databaseUrl);
const restoreDatabase = `fountlayer_restore_${Date.now()}_${process.pid}`;
let created = false;

try {
  await execFileAsync("createdb", ["--encoding=UTF8", restoreDatabase], {
    env,
  });
  created = true;
  await execFileAsync(
    "pg_restore",
    [
      "--dbname",
      restoreDatabase,
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      backupPath,
    ],
    { env, maxBuffer: 4 * 1024 * 1024 },
  );
  const { stdout } = await execFileAsync(
    "psql",
    [
      "--dbname",
      restoreDatabase,
      "--no-align",
      "--tuples-only",
      "--command",
      "select count(*) from fountlayer_schema_migrations",
    ],
    { env },
  );
  const migrationCount = Number(stdout.trim());

  if (!Number.isInteger(migrationCount) || migrationCount < 1) {
    throw new Error("Restored database has no migration journal entries.");
  }

  console.log(
    JSON.stringify(
      {
        backup: basename(backupPath),
        migrationCount,
        ok: true,
        restoredIntoTemporaryDatabase: true,
      },
      null,
      2,
    ),
  );
} finally {
  if (created) {
    await execFileAsync("dropdb", ["--force", "--if-exists", restoreDatabase], {
      env,
    });
  }
}
