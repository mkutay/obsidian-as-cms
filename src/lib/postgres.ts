import postgres from "postgres";

import { CMSSettings } from "../settings";

let sql: postgres.Sql<Record<string, unknown>>;

export function initialiseSql(settings: CMSSettings) {
  sql = postgres(settings.postgresUrl);
  return sql;
}

export function getSql() {
  if (!sql) {
    throw new Error("SQL client not initialized");
  }
  return sql;
}