import "server-only";
import { db } from "@/db";
import { requireRole, resolveDepartment } from "@/lib/auth/dal";
import { readStudentOptions, readStudents } from "./read";
import type { StudentData, StudentDegreeLevel } from "./types";

/**
 * The signed-in admin's department (or the one a super admin chose): its records and editor choices
 * for one explicit degree level. Null when a super admin has not chosen a department. No placement cycle is
 * chosen or inferred here; the editor always asks for one explicitly.
 */
export async function getStudentData(level: StudentDegreeLevel): Promise<StudentData | null> {
  const user = await requireRole("ADMIN");
  const department = await resolveDepartment(user);
  if (!department) return null;
  const [students, options] = await Promise.all([
    readStudents(db, department.departmentId, level),
    readStudentOptions(db, department.departmentId, level),
  ]);
  return { students, ...options };
}
