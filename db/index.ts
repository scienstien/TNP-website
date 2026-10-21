import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to connect to PostgreSQL.");
}

const globalForDatabase = globalThis as unknown as {
  postgresClient: ReturnType<typeof postgres> | undefined;
};

export const postgresClient =
  globalForDatabase.postgresClient ?? postgres(databaseUrl);

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.postgresClient = postgresClient;
}

export const db = drizzle(postgresClient, { schema });
