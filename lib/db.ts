/**
 * Database access for server code that needs the development accounts seeded first (authentication).
 *
 * Uses the shared connection from db/index.ts (PostgreSQL via DATABASE_URL; see db/README.md
 * for the Docker workflow). Before the first query it makes sure the development accounts
 * exist; that check runs once per server process.
 */
import "server-only";

import { db } from "@/db";
import { ensureDevAccounts } from "@/lib/auth/dev-accounts";

export type Database = typeof db;

const globalForSeed = globalThis as unknown as {
  __devAccounts?: Promise<void>;
};

export async function getDb(): Promise<Database> {
  globalForSeed.__devAccounts ??= ensureDevAccounts(db).catch((error) => {
    globalForSeed.__devAccounts = undefined; // retry on the next request, e.g. once Postgres is up
    throw error;
  });
  await globalForSeed.__devAccounts;
  return db;
}
