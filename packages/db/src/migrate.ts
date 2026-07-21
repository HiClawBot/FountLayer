import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

import postgres from "postgres";

import { getDatabaseUrl } from "./config.js";
import { isDirectRun } from "./runtime.js";

const migrationsUrl = new URL("../migrations/", import.meta.url);

export function migrationChecksum(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

export async function runMigrations(
  databaseUrl = getDatabaseUrl(),
): Promise<void> {
  const migrationNames = (await readdir(migrationsUrl))
    .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
    .sort();
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await sql.begin(async (transaction) => {
      await transaction`
        create table if not exists fountlayer_schema_migrations (
          version text primary key,
          checksum text not null,
          applied_at timestamptz not null default now()
        )
      `;
      await transaction`
        select pg_advisory_xact_lock(hashtext('fountlayer_schema_migrations'))
      `;

      for (const migrationName of migrationNames) {
        const migrationSql = await readFile(
          new URL(migrationName, migrationsUrl),
          "utf8",
        );
        const checksum = migrationChecksum(migrationSql);
        const applied = await transaction<Array<{ checksum: string }>>`
          select checksum
          from fountlayer_schema_migrations
          where version = ${migrationName}
        `;

        if (applied[0]) {
          if (applied[0].checksum !== checksum) {
            throw new Error(
              `Applied migration checksum mismatch: ${migrationName}`,
            );
          }

          continue;
        }

        await transaction.unsafe(migrationSql);
        await transaction`
          insert into fountlayer_schema_migrations (version, checksum)
          values (${migrationName}, ${checksum})
        `;
      }
    });
  } finally {
    await sql.end();
  }
}

if (isDirectRun(import.meta.url)) {
  await runMigrations();
}
