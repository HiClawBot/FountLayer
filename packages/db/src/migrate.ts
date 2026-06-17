import { readFile } from "node:fs/promises";

import postgres from "postgres";

import { getDatabaseUrl } from "./config.js";
import { isDirectRun } from "./runtime.js";

const migrationUrl = new URL("../migrations/0000_initial.sql", import.meta.url);

export async function runMigrations(
  databaseUrl = getDatabaseUrl(),
): Promise<void> {
  const migrationSql = await readFile(migrationUrl, "utf8");
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await sql.begin(async (transaction) => {
      await transaction.unsafe(migrationSql);
    });
  } finally {
    await sql.end();
  }
}

if (isDirectRun(import.meta.url)) {
  await runMigrations();
}
