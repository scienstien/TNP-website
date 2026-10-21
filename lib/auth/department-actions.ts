"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { DEPARTMENT_COOKIE, listDepartments, requireRole } from "./dal";

/** Super admin only: choose the department to work in, or "all" for the cross-department view. */
export async function selectDepartmentAction(code: string): Promise<void> {
  await requireRole("SUPERADMIN");
  const jar = await cookies();
  const known = (await listDepartments()).some((department) => department.code === code);
  if (known) {
    jar.set(DEPARTMENT_COOKIE, code, { httpOnly: true, sameSite: "lax", path: "/" });
  } else {
    jar.delete(DEPARTMENT_COOKIE);
  }
  revalidatePath("/", "layout");
}
