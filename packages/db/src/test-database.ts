import postgres from "postgres";

import { getTestDatabaseUrl } from "./config.js";
import { runMigrations } from "./migrate.js";
import { seedDatabase } from "./seed.js";

function assertSafeTestDatabaseName(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  const databaseName = parsed.pathname.replace(/^\//, "");

  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error(`Unsafe test database name: ${databaseName}`);
  }

  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(
      `Refusing to reset database "${databaseName}" because its name does not include "test".`,
    );
  }

  return databaseName;
}

async function ensureDatabase(databaseUrl: string): Promise<void> {
  const parsed = new URL(databaseUrl);
  const databaseName = assertSafeTestDatabaseName(databaseUrl);
  parsed.pathname = "/postgres";

  const sql = postgres(parsed.toString(), { max: 1 });

  try {
    await sql.unsafe(`create database "${databaseName}"`);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "42P04"
    ) {
      throw error;
    }
  } finally {
    await sql.end();
  }
}

async function resetPublicSchema(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await sql`drop schema if exists public cascade`;
    await sql`create schema public`;
  } finally {
    await sql.end();
  }
}

export async function setupTestDatabase(
  databaseUrl = getTestDatabaseUrl(),
): Promise<void> {
  assertSafeTestDatabaseName(databaseUrl);
  await ensureDatabase(databaseUrl);
  await resetPublicSchema(databaseUrl);
  await runMigrations(databaseUrl);
  await seedDatabase(databaseUrl);
}
