/**
 * Data Access Layer for authentication. Every page, Server Action and route handler that
 * reads protected data or changes anything must call requireUser() or requireRole().
 *
 * The session cookie only says who signed in. The role is re-read from the database on each
 * request, so a deleted account or a changed role takes effect immediately rather than when
 * the cookie expires.
 */
import "server-only";

import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { users } from "@/db/schema";
import { getDb } from "@/lib/db";

export type Role = "ADMIN" | "PROFESSOR";

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The decoded session cookie (not yet checked against the database). Memoised per request. */
const getSession = cache(() => auth());

/** The signed-in user, verified against the database, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  const id = session?.user?.id;
  if (!id || !UUID.test(id)) return null;

  const db = await getDb();
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
});

/**
 * For pages: signed-out visitors go to the login page. A session whose account no longer
 * exists (deleted, or from another database) is cleared first; otherwise the proxy, which
 * only sees a validly signed cookie, would send the visitor straight back here in a loop.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (user) return user;
  const session = await getSession();
  redirect(session?.user?.id ? "/auth/session-expired" : "/login");
}

/**
 * For admin-only pages and Server Actions. Signed-out visitors go to the login page;
 * signed-in users without the role get a 404, so admin pages do not reveal they exist.
 * In route handlers, use getCurrentUser() and return 401/403 responses instead.
 */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== role) notFound();
  return user;
}
