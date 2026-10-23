import "server-only";

import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import {
  cohorts,
  companies,
  enrollments,
  placementCycles,
  placementOffers,
  programmes,
  studentCycles,
} from "@/db/schema";
import type { Transaction } from "@/lib/placements/cycles";
import { isUuid } from "./records";

/** Run after authorization, in the same read snapshot as the aggregates. */
export async function assertCompanyPanelSelection(
  tx: Transaction,
  companyId: string,
  cycleId?: string,
): Promise<void> {
  if (!isUuid(companyId) || (cycleId !== undefined && !isUuid(cycleId))) {
    throw new Error("Invalid company or placement cycle selection.");
  }
  const [company] = await tx.select({ id: companies.companyId }).from(companies)
    .where(eq(companies.companyId, companyId)).limit(1);
  if (!company) throw new Error("The selected company no longer exists.");
  if (cycleId !== undefined) {
    const [cycle] = await tx.select({ id: placementCycles.cycleId }).from(placementCycles)
      .where(eq(placementCycles.cycleId, cycleId)).limit(1);
    if (!cycle) throw new Error("The selected placement cycle no longer exists.");
  }
}

/**
 * Registration is not enforced by a database trigger yet. Reject inconsistent
 * source data in the authorized population instead of reporting a false total.
 * Existence only: no student/offer identifiers leave this guard.
 */
export async function assertCompanyOfferIntegrity(
  tx: Transaction,
  scope: { companyId: string; departmentId: string | null; cycleId?: string },
): Promise<void> {
  const [invalid] = await tx.select({ present: sql<number>`1` })
    .from(placementOffers)
    .innerJoin(enrollments, eq(enrollments.enrollmentId, placementOffers.enrollmentId))
    .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
    .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
    .leftJoin(studentCycles, and(
      eq(studentCycles.enrollmentId, placementOffers.enrollmentId),
      eq(studentCycles.cycleId, placementOffers.cycleId),
    ))
    .where(and(
      eq(placementOffers.companyId, scope.companyId),
      scope.departmentId === null ? undefined : eq(programmes.departmentId, scope.departmentId),
      scope.cycleId === undefined ? undefined : eq(placementOffers.cycleId, scope.cycleId),
      or(
        isNull(studentCycles.enrollmentId),
        ne(studentCycles.registrationStatus, "REGISTERED"),
        ne(studentCycles.cohortId, enrollments.cohortId),
      ),
    )).limit(1);
  if (invalid) {
    throw new Error("Offer totals are unavailable: recorded offers have inconsistent cycle registration. An administrator must review the source data.");
  }
}
