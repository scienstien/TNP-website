/**
 * Trial admin account (admin@nitt.edu) so the admin view can be tried locally.
 *
 * Created automatically in development. In production it is created only when
 * SEED_TRIAL_ADMIN=true is set explicitly: a known password must never appear on a live
 * deployment by accident. An existing account is never overwritten.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import type { Database } from "@/lib/db";
import { hashPassword } from "./password";

export const TRIAL_ADMIN_EMAIL = "admin@nitt.edu";
const TRIAL_ADMIN_PASSWORD = "test1234";

export async function ensureTrialAdmin(db: Database) {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.SEED_TRIAL_ADMIN === "true";
  if (!enabled) return;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, TRIAL_ADMIN_EMAIL))
    .limit(1);
  if (existing.length > 0) return;

  await db
    .insert(users)
    .values({
      name: "Trial Admin",
      email: TRIAL_ADMIN_EMAIL,
      passwordHash: await hashPassword(TRIAL_ADMIN_PASSWORD),
      role: "ADMIN",
    })
    .onConflictDoNothing({ target: users.email });
}
