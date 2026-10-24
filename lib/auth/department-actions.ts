"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ALL_DEPARTMENTS, DEPARTMENT_COOKIE, listDepartments, requireRole } from "./dal";

/** Super admin only: choose the department to work in, or "all" for the cross-department view. */
export async function selectDepartmentAction(code: string): Promise<void> {
  await requireRole("SUPERADMIN");
  const jar = await cookies();
  const known = (await listDepartments()).some((department) => department.code === code);
  // "All departments" is stored explicitly, so no default (such as the local auth bypass's
  // first department) can replace the cross-department view the super admin chose.
  jar.set(DEPARTMENT_COOKIE, known ? code : ALL_DEPARTMENTS, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}
