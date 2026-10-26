"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ALL_DEPARTMENTS, DEPARTMENT_COOKIE, listDepartments, requireRole } from "./dal";

/** Administrators choose one department to work in, or "all" for a read-only combined view. */
export async function selectDepartmentAction(code: string): Promise<void> {
  await requireRole("ADMIN");
  const jar = await cookies();
  const known = (await listDepartments()).some((department) => department.code === code);
  jar.set(DEPARTMENT_COOKIE, known ? code : ALL_DEPARTMENTS, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}
