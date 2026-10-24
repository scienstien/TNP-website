import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cohorts,
  degrees,
  departments,
  enrollments,
  genderTypes,
  placementOffers,
  programmes,
  reservationCategories,
  studentCycles,
  students,
} from "@/db/schema";
import { requireUser, resolveDepartment } from "@/lib/auth/dal";
import type { BreakdownDimension, PlacementBreakdown } from "./breakdown-types";
import { offerForParticipation, placementRecordsScope } from "./query-conditions";
import type { DegreeLevel } from "./types";

/**
 * Registered and placed counts per department, gender or reservation category for the
 * dashboard's requested degree level, in one explicit cycle or in every cycle. Only
 * aggregates leave the server. A department user gets their own department; a super admin
 * gets the chosen department or all of them. Offer join cannot fan out: an offer is unique per
 * enrollment and must match the participation's cycle.
 */
export async function getPlacementBreakdown(
  dimension: BreakdownDimension,
  cycleId: string | null,
  degreeLevel: DegreeLevel = "UG",
  specialization: string | null = null,
  branch: string | null = null,
): Promise<PlacementBreakdown> {
  const user = await requireUser();
  const department = await resolveDepartment(user);

  // Recorded codes are prefixed apart from the missing sentinel so a code can never collide with it.
  const key =
    dimension === "department"
      ? sql<string>`concat('department:', ${departments.departmentId})`
      : dimension === "gender"
        ? sql<string>`case when ${students.genderCode} is null then 'gender:missing' else concat('gender:code:', ${students.genderCode}) end`
        : sql<string>`case when ${enrollments.reservationCategoryCode} is null then 'reservationCategory:missing' else concat('reservationCategory:code:', ${enrollments.reservationCategoryCode}) end`;
  const label =
    dimension === "department"
      ? sql<string>`${departments.name}`
      : dimension === "gender"
        ? sql<string>`coalesce(${genderTypes.label}, 'Not recorded')`
        : sql<string>`coalesce(${reservationCategories.label}, 'Not recorded')`;

  const rows = await db
    .select({
      key,
      label,
      registered: count(),
      placed: count(placementOffers.offerId),
    })
    .from(studentCycles)
    .innerJoin(enrollments, eq(enrollments.enrollmentId, studentCycles.enrollmentId))
    .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
    .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
    .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
    .innerJoin(departments, eq(departments.departmentId, programmes.departmentId))
    .innerJoin(students, eq(students.studentId, enrollments.studentId))
    .leftJoin(genderTypes, eq(genderTypes.code, students.genderCode))
    .leftJoin(
      reservationCategories,
      eq(reservationCategories.code, enrollments.reservationCategoryCode),
    )
    .leftJoin(placementOffers, offerForParticipation())
    .where(
      and(
        placementRecordsScope(department?.departmentId ?? null, degreeLevel),
        branch === null ? undefined : eq(departments.code, branch),
        specialization === "Not recorded"
          ? sql`${programmes.specialization} is null`
          : specialization === null
            ? undefined
            : eq(programmes.specialization, specialization),
        eq(studentCycles.registrationStatus, "REGISTERED"),
        cycleId === null ? undefined : eq(studentCycles.cycleId, cycleId),
      ),
    )
    .groupBy(key, label)
    .orderBy(asc(label), asc(key));

  // Same population without the department limit: one number, no other department's rows.
  const [institute] = await db
    .select({ placed: count(placementOffers.offerId) })
    .from(studentCycles)
    .innerJoin(enrollments, eq(enrollments.enrollmentId, studentCycles.enrollmentId))
    .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
    .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
    .innerJoin(degrees, eq(degrees.degreeId, programmes.degreeId))
    .leftJoin(placementOffers, offerForParticipation())
    .where(
      and(
        placementRecordsScope(null, degreeLevel),
        specialization === "Not recorded"
          ? sql`${programmes.specialization} is null`
          : specialization === null
            ? undefined
            : eq(programmes.specialization, specialization),
        eq(studentCycles.registrationStatus, "REGISTERED"),
        cycleId === null ? undefined : eq(studentCycles.cycleId, cycleId),
      ),
    );

  return { rows, institutePlaced: institute?.placed ?? 0 };
}
