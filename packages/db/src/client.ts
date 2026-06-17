import postgres from "postgres";

import { getDatabaseUrl } from "./config.js";

export type FountLayerSql = postgres.Sql;
export type FountLayerTransactionSql = postgres.TransactionSql;

export function createDatabaseSql(
  databaseUrl = getDatabaseUrl(),
): FountLayerSql {
  return postgres(databaseUrl, { max: 10 });
}
