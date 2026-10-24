import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  cohorts,
  companies,
  degrees,
  departments,
  driveRoles,
  enrollments,
  placementOffers,
  placementCycles,
  programmes,
  studentCycles,
} from "@/db/schema";
import { requireUser, resolveDepartment } from "@/lib/auth/dal";
import { offerForParticipation, placementRecordsScope } from "./query-conditions";
import type { DegreeLevel, PlacementRecord } from "./types";

/**
 * Every explicit student-cycle participation at the requested degree level with its final offer for
 * that same cycle, if any, and the domain of the offer's role (drive_roles.domain; the company's
 * own domain is only a description and is not used in analytics). A department user gets their own
 * department only; a super admin gets the department they chose, or all departments.
 */
export async function getPlacementRecords(level: DegreeLevel = "UG"): Promise<PlacementRecord[]> {
  const user = await requireUser();
  const department = await resolveDepartment(user);

  const rows = await db
    .select({
      department: departments.code,
      programmeId: programmes.programmeId,
      specialization: programmes.specialization,
      graduationYear: cohorts.graduationYear,
      cycleId: placementCycles.cycleId,
      cycleCode: placementCycles.code,
      cycleStartsOn: placementCycles.startsOn,
      cycleEndsOn: placementCycles.endsOn,
      registrationStatus: studentCycles.registrationStatus,
      company: companies.name,
      domain: driveRoles.domain,
      packageLpa: placementOffers.packageLpa,
      offerType: placementOffers.offerType,
      offerDate: placementOffers.offerDate,
    })
    .from(studentCycles)
    .innerJoin(enrollments, eq(enrollments.enrollmentId, studentCycles.enrollmentId))
    .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
    .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
    .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
    .innerJoin(departments, eq(departments.departmentId, programmes.departmentId))
    .innerJoin(placementCycles, eq(placementCycles.cycleId, studentCycles.cycleId))
    .leftJoin(
      placementOffers,
      offerForParticipation(),
    )
    .leftJoin(companies, eq(companies.companyId, placementOffers.companyId))
    // At most one role per offer, so this join cannot multiply participation rows.
    .leftJoin(driveRoles, eq(driveRoles.roleId, placementOffers.roleId))
    .where(placementRecordsScope(department?.departmentId ?? null, level))
    .orderBy(departments.code, placementCycles.code);

  return rows.map((row) => {
    const packageLpa = row.packageLpa === null ? null : Number(row.packageLpa);
    return {
      department: row.department,
      programmeId: row.programmeId,
      specialization: row.specialization,
      graduationYear: row.graduationYear,
      cycleId: row.cycleId,
      cycleCode: row.cycleCode,
      cycleStartsOn: row.cycleStartsOn,
      cycleEndsOn: row.cycleEndsOn,
      registrationStatus: row.registrationStatus,
      offer: row.company
        ? {
            company: row.company,
            domain: row.domain,
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
