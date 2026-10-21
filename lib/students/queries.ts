import "server-only";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireRole, resolveDepartment } from "@/lib/auth/dal";
import { visitDatesByCompany } from "@/lib/companies/visit";
import { todayInInstituteZone } from "@/lib/calendar/dates";
import { findCycleId } from "@/lib/placements/cycles";
import { batchYearForDate } from "@/lib/placements/year-to-date";
import { readStudents } from "./read";
import type { StudentData } from "./types";

/** The signed-in admin's department, or the one a super admin chose; null when none is chosen. */
export async function getStudentData(): Promise<StudentData | null> {
  const user = await requireRole("ADMIN");
  const department = await resolveDepartment(user);
  if (!department) return null;
  const currentBatchYear = batchYearForDate(todayInInstituteZone());
  const cycleId = await findCycleId(db, currentBatchYear);
  const [studentRows, companyRows, visits] = await Promise.all([
    readStudents(db, department.departmentId),
    db
      .select({ companyId: companies.companyId, name: companies.name, domain: companies.domain })
      .from(companies)
      .orderBy(companies.name),
    visitDatesByCompany(db, cycleId),
  ]);
  return {
    students: studentRows,
    currentBatchYear,
    companies: companyRows.map(({ companyId, name, domain }) => ({
      name,
      domain,
      // The current cycle's campus visit (earliest PPT event), as in the company directory.
      visitDate: visits.get(companyId) ?? null,
    })),
  };
}
