import "server-only";

import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cohorts,
  departments,
  enrollments,
  genderTypes,
  placementOffers,
  programmes,
  reservationCategories,
  studentCycles,
  students,
} from "@/db/schema";
import {
  assertCompanyOfferIntegrity,
  assertCompanyPanelSelection,
} from "./panel-read-guards";
import { requireCompanyPanelScope } from "./panel-scope";
import { isUuid } from "./records";
import { readDriveOptions } from "@/lib/drives/read";

export type CompanyOfferDimension = "department" | "gender" | "reservationCategory";

export interface CompanyOfferDistributionInput {
  companyId: string;
  cycleId: string;
  dimension: CompanyOfferDimension;
  selectedRoleId: string | null;
}

export interface CompanyOfferDistributionData {
  scopeLabel: string;
  /** Effective selection: a role outside this company/cycle is reset to All roles. */
  selectedRoleId: string | null;
  roleOptions: {
    roleId: string;
    driveId: string;
    driveReference: string | null;
    jobTitle: string | null;
  }[];
  buckets: { key: string; label: string; count: number }[];
  totalOffers: number;
  /** Missing roles in the scoped company/cycle population, before the role filter. */
  missingRoleCount: number;
}

/**
 * Final reported offers for an explicit cycle, including both UG and PG enrollments.
 * All joins are to single parent/reference rows; events and role links never fan out counts.
 */
export async function getCompanyOfferDistribution(
  input: CompanyOfferDistributionInput,
): Promise<CompanyOfferDistributionData> {
  const { departmentId, scopeLabel } = await requireCompanyPanelScope();
  if (!input || !["department", "gender", "reservationCategory"].includes(input.dimension)) {
    throw new Error("Choose a valid offer distribution dimension.");
  }
  // The shared selection guard also supports history's optional cycle; this
  // endpoint requires one even when invoked with an untyped runtime payload.
  if (!isUuid(input.companyId) || !isUuid(input.cycleId)) {
    throw new Error("Choose a valid company and placement cycle.");
  }
  if (input.selectedRoleId !== null && !isUuid(input.selectedRoleId)) {
    throw new Error("Choose a valid offer role.");
  }

  return db.transaction(async (tx) => {
    await assertCompanyPanelSelection(tx, input.companyId, input.cycleId);
    await assertCompanyOfferIntegrity(tx, {
      companyId: input.companyId,
      cycleId: input.cycleId,
      departmentId,
    });

    // Role metadata is institute-wide: the model has no department/role target links.
    // Keep zero-offer roles, repeated titles and untitled roles as separate options.
    const driveOptions = await readDriveOptions(tx, { companyId: input.companyId, cycleId: input.cycleId });
    const roleOptions = driveOptions.flatMap(drive => drive.roles.map(role => ({
      roleId: role.roleId, driveId: drive.driveId, driveReference: drive.reference, jobTitle: role.jobTitle,
    })));

    const requestedRoleId = input.selectedRoleId?.toLowerCase() ?? null;
    const selectedRoleId = roleOptions.some((role) => role.roleId === requestedRoleId)
      ? requestedRoleId
      : null;
    const population = and(
      eq(placementOffers.companyId, input.companyId),
      eq(placementOffers.cycleId, input.cycleId),
      eq(studentCycles.registrationStatus, "REGISTERED"),
      departmentId === null ? undefined : eq(programmes.departmentId, departmentId),
    );
    const participation = and(
      eq(studentCycles.enrollmentId, placementOffers.enrollmentId),
      eq(studentCycles.cycleId, placementOffers.cycleId),
      eq(studentCycles.cohortId, enrollments.cohortId),
    );

    const [missingRoles] = await tx
      .select({ count: count() })
      .from(placementOffers)
      .innerJoin(enrollments, eq(enrollments.enrollmentId, placementOffers.enrollmentId))
      .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
      .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
      .innerJoin(studentCycles, participation)
      .where(and(population, isNull(placementOffers.roleId)));

    // Prefix recorded codes separately from the missing sentinel: an institute code
    // named "missing" (or a label "Not recorded") must retain its own bucket identity.
    const bucketKey = input.dimension === "department"
      ? sql<string>`concat('department:', ${departments.departmentId})`
      : input.dimension === "gender"
        ? sql<string>`case when ${students.genderCode} is null then 'gender:missing' else concat('gender:code:', ${students.genderCode}) end`
        : sql<string>`case when ${enrollments.reservationCategoryCode} is null then 'reservationCategory:missing' else concat('reservationCategory:code:', ${enrollments.reservationCategoryCode}) end`;
    const bucketLabel = input.dimension === "department"
      ? sql<string>`${departments.name}`
      : input.dimension === "gender"
        ? sql<string>`coalesce(${genderTypes.label}, 'Not recorded')`
        : sql<string>`coalesce(${reservationCategories.label}, 'Not recorded')`;

    const buckets = await tx
      .select({ key: bucketKey, label: bucketLabel, count: count() })
      .from(placementOffers)
      .innerJoin(enrollments, eq(enrollments.enrollmentId, placementOffers.enrollmentId))
      .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
      .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
      .innerJoin(departments, eq(departments.departmentId, programmes.departmentId))
      .innerJoin(studentCycles, participation)
      .innerJoin(students, eq(students.studentId, enrollments.studentId))
      .leftJoin(genderTypes, eq(genderTypes.code, students.genderCode))
      .leftJoin(reservationCategories, eq(reservationCategories.code, enrollments.reservationCategoryCode))
      .where(and(
        population,
        selectedRoleId === null ? undefined : eq(placementOffers.roleId, selectedRoleId),
      ))
      .groupBy(bucketKey, bucketLabel)
      .orderBy(asc(bucketLabel), asc(bucketKey));

    const [total] = await tx.select({ count: count() }).from(placementOffers)
      .innerJoin(enrollments, eq(enrollments.enrollmentId, placementOffers.enrollmentId))
      .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
      .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
      .innerJoin(studentCycles, participation)
      .where(and(population, selectedRoleId === null ? undefined : eq(placementOffers.roleId, selectedRoleId)));
    const totalOffers = total?.count ?? 0;
    if (buckets.reduce((sum, bucket) => sum + bucket.count, 0) !== totalOffers)
      throw new Error("These figures don't add up; please refresh or report this.");

    return {
      scopeLabel,
      selectedRoleId,
      roleOptions,
      buckets,
      totalOffers,
      missingRoleCount: missingRoles?.count ?? 0,
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
