import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  cohorts,
  companies,
  degrees,
  departments,
  enrollments,
  placementOffers,
  programmes,
} from "@/db/schema";
import { requireUser, resolveDepartment } from "@/lib/auth/dal";
import type { PlacementRecord } from "./types";

/**
 * Every recorded undergraduate (B.Tech) enrollment with its final offer, if any, and the
 * offering company's sector. A department user gets their own department only; a super admin
 * gets the department they chose, or all departments. The unique enrollment_id on
 * placement_offers guarantees at most one offer per enrollment, so the left join cannot
 * double-count.
 */
export async function getPlacementRecords(): Promise<PlacementRecord[]> {
  const user = await requireUser();
  const department = await resolveDepartment(user);

  const rows = await db
    .select({
      department: departments.code,
      rollNumber: enrollments.rollNumber,
      batchYear: cohorts.graduationYear,
      company: companies.name,
      sector: companies.domain,
      packageLpa: placementOffers.packageLpa,
      offerType: placementOffers.offerType,
      offerDate: placementOffers.offerDate,
    })
    .from(enrollments)
    .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
    .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
    .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
    .innerJoin(departments, eq(departments.departmentId, programmes.departmentId))
    .leftJoin(placementOffers, eq(placementOffers.enrollmentId, enrollments.enrollmentId))
    .leftJoin(companies, eq(companies.companyId, placementOffers.companyId))
    .where(
      department
        ? and(eq(degrees.level, "UG"), eq(departments.departmentId, department.departmentId))
        : eq(degrees.level, "UG"),
    )
    .orderBy(departments.code, cohorts.graduationYear, enrollments.rollNumber);

  return rows.map((row) => {
    const packageLpa = row.packageLpa === null ? null : Number(row.packageLpa);
    return {
      department: row.department,
      rollNumber: row.rollNumber,
      batchYear: row.batchYear,
      offer: row.company
        ? {
            company: row.company,
            sector: row.sector,
            packageLpa:
              packageLpa !== null && Number.isFinite(packageLpa)
                ? packageLpa
                : null,
            offerType: row.offerType,
            offerDate: row.offerDate,
          }
        : null,
    };
  });
}
