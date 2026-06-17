export const defaultDatabaseUrl =
  "postgres://postgres:postgres@localhost:5432/fountlayer";

export const defaultTestDatabaseUrl =
  "postgres://postgres:postgres@localhost:5432/fountlayer_test";

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? defaultDatabaseUrl;
}

export function getTestDatabaseUrl(): string {
  return (
    process.env.TEST_DATABASE_URL ??
    process.env.FOUNTLAYER_TEST_DATABASE_URL ??
    defaultTestDatabaseUrl
  );
}
