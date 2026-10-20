/**
 * Database access for server code that needs the trial admin seeded first (authentication).
 *
 * Uses the shared connection from db/index.ts (PostgreSQL via DATABASE_URL; see db/README.md
 * for the Docker workflow). Before the first query it makes sure the development trial admin
 * exists; that check runs once per server process.
 */
import "server-only";

import { db } from "@/db";
import { ensureTrialAdmin } from "@/lib/auth/trial-admin";

export type Database = typeof db;

const globalForSeed = globalThis as unknown as {
  __mmeTrialAdmin?: Promise<void>;
};

export async function getDb(): Promise<Database> {
  globalForSeed.__mmeTrialAdmin ??= ensureTrialAdmin(db).catch((error) => {
    globalForSeed.__mmeTrialAdmin = undefined; // retry on the next request, e.g. once Postgres is up
    throw error;
  });
  await globalForSeed.__mmeTrialAdmin;
  return db;
}
