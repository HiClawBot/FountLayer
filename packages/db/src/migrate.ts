import { readdir, readFile } from "node:fs/promises";

import postgres from "postgres";

import { getDatabaseUrl } from "./config.js";
import { isDirectRun } from "./runtime.js";

const migrationsUrl = new URL("../migrations/", import.meta.url);

export async function runMigrations(
  databaseUrl = getDatabaseUrl(),
): Promise<void> {
  const migrationNames = (await readdir(migrationsUrl))
    .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
    .sort();
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await sql.begin(async (transaction) => {
      for (const migrationName of migrationNames) {
        const migrationSql = await readFile(
          new URL(migrationName, migrationsUrl),
          "utf8",
        );
        await transaction.unsafe(migrationSql);
      }
    });
  } finally {
    await sql.end();
  }
}

if (isDirectRun(import.meta.url)) {
  await runMigrations();
}
