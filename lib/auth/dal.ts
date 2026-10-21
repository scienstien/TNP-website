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
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { departments, users } from "@/db/schema";
import { getDb } from "@/lib/db";

export type Role = "ADMIN" | "PROFESSOR" | "SUPERADMIN";

/** A department as shown to the user. */
export interface DepartmentRef {
  departmentId: string;
  code: string;
  name: string;
}

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  /** The user's own department; null for a SUPERADMIN, who belongs to none. */
  department: DepartmentRef | null;
}

/** ADMIN of one department, or SUPERADMIN: both may change data. */
export const isAdminRole = (role: Role) => role === "ADMIN" || role === "SUPERADMIN";

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
      departmentId: departments.departmentId,
      departmentCode: departments.code,
      departmentName: departments.name,
    })
    .from(users)
    .leftJoin(departments, eq(departments.departmentId, users.departmentId))
    .where(eq(users.id, id))
    .limit(1);
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department:
      user.departmentId === null
        ? null
        : { departmentId: user.departmentId, code: user.departmentCode!, name: user.departmentName! },
  };
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
 * "ADMIN" also admits a SUPERADMIN, who has every administrator's powers.
 * In route handlers, use getCurrentUser() and return 401/403 responses instead.
 */
export async function requireRole(role: Role): Promise<CurrentUser> {
  const user = await requireUser();
  const allowed = role === "ADMIN" ? isAdminRole(user.role) : user.role === role;
  if (!allowed) notFound();
  return user;
}

/** Cookie holding the department a SUPERADMIN is currently working in; absent means "all". */
export const DEPARTMENT_COOKIE = "tnp-department";

/**
 * The department a request acts on. Everyone except a SUPERADMIN is pinned to their own
 * department. A SUPERADMIN works in the department named by the DEPARTMENT_COOKIE, or in
 * every department at once (null) when none is chosen; the cookie is only a preference and is
 * checked against the database here, never trusted. Mutations that need one department must
 * reject null.
 */
export async function resolveDepartment(user: CurrentUser): Promise<DepartmentRef | null> {
  if (user.role !== "SUPERADMIN") return user.department;
  const code = (await cookies()).get(DEPARTMENT_COOKIE)?.value;
  if (!code) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(departments)
    .where(eq(departments.code, code.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}

/** Every department, for the SUPERADMIN switcher and the sign-up form. */
export async function listDepartments(): Promise<DepartmentRef[]> {
  const db = await getDb();
  return db.select().from(departments).orderBy(departments.code);
}
