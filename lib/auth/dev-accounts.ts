/**
 * Development accounts so every role can be tried locally:
 *
 *   superadmin            / test123    SUPERADMIN, all departments
 *   admin123<dept>@nitt.edu / test1234 ADMIN of that one department (e.g. admin123mme@nitt.edu)
 *
 * "superadmin" is a bare username: sign-in appends the first allowed domain (see loginEmail).
 * Created automatically in development. In production they are created only when
 * SEED_TRIAL_ADMIN=true is set explicitly: a known password must never appear on a live
 * deployment by accident. Existing accounts are never overwritten. A department added later gets
 * its admin the next time the server starts.
 */
import "server-only";

import { inArray } from "drizzle-orm";
import { departments, users } from "@/db/schema";
import type { Database } from "@/lib/db";
import { hashPassword } from "./password";
import { allowedSignupDomains } from "./validation";

const SUPERADMIN_USERNAME = "superadmin";
const SUPERADMIN_PASSWORD = "test123";
const DEPARTMENT_ADMIN_PASSWORD = "test1234";

export const departmentAdminEmail = (code: string) =>
  `admin123${code}@${allowedSignupDomains()[0] ?? "nitt.edu"}`;

export async function ensureDevAccounts(db: Database) {
  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.SEED_TRIAL_ADMIN === "true";
  if (!enabled) return;

  const domain = allowedSignupDomains()[0] ?? "nitt.edu";
  const departmentRows = await db.select().from(departments);
  const wanted = [
    {
      name: "Super Admin",
      email: `${SUPERADMIN_USERNAME}@${domain}`,
      password: SUPERADMIN_PASSWORD,
      role: "SUPERADMIN" as const,
      departmentId: null,
    },
    ...departmentRows.map((department) => ({
      name: `${department.code.toUpperCase()} Admin`,
      email: departmentAdminEmail(department.code),
      password: DEPARTMENT_ADMIN_PASSWORD,
      role: "ADMIN" as const,
      departmentId: department.departmentId,
    })),
  ];

  const existing = new Set(
    (
      await db
        .select({ email: users.email })
        .from(users)
        .where(inArray(users.email, wanted.map((account) => account.email)))
    ).map((row) => row.email),
  );
  for (const { password, ...account } of wanted) {
    if (existing.has(account.email)) continue;
    await db
      .insert(users)
      .values({ ...account, passwordHash: await hashPassword(password) })
      .onConflictDoNothing({ target: users.email });
  }
}
