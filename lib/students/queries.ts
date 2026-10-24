import "server-only";
import { db } from "@/db";
import { requireRole, resolveDepartment } from "@/lib/auth/dal";
import type { StudentListFilters } from "./list-params";
import { readStudentList, readStudentOptions } from "./read";
import type { StudentData } from "./types";

/**
 * The signed-in admin's department (or the one a super admin chose): one page of its
 * undergraduate records, with the totals and filter choices the list needs, and the editor's
 * choices. A super admin on All departments gets every department's records, read-only
 * (readOnly); editing needs one department, and every mutation still rejects "all". Search,
 * filters and paging run in SQL, so the browser only receives one page. No placement cycle is
 * chosen or inferred here; the editor always asks for one explicitly.
 */
export async function getStudentData(filters: StudentListFilters): Promise<StudentData> {
  const user = await requireRole("ADMIN");
  const department = await resolveDepartment(user);
  const departmentId = department?.departmentId ?? null;
  // A department user is pinned to their own department whatever the URL says.
  const scoped = { ...filters, department: department ? null : filters.department };
  const [{ students, list }, options] = await Promise.all([
    readStudentList(db, departmentId, scoped),
    readStudentOptions(db, departmentId),
  ]);
  return { students, list, ...options, readOnly: department === null };
}
