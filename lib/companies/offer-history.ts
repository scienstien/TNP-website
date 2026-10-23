import "server-only";

import { and, asc, count, eq, exists, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cohorts,
  drives,
  enrollments,
  placementCycles,
  placementOffers,
  programmes,
  studentCycles,
} from "@/db/schema";
import {
  assertCompanyOfferIntegrity,
  assertCompanyPanelSelection,
} from "./panel-read-guards";
import { requireCompanyPanelScope } from "./panel-scope";

/**
 * Recorded company cycles across UG and PG, with one count per stored final offer.
 * Drive cycles remain visible even when the authorized department has no offers;
 * offer-only cycles are visible only when they have an offer in that scope.
 */
export async function getCompanyOfferHistory(companyId: string): Promise<{
  scopeLabel: string;
  rows: { cycleId: string; cycleCode: string; offerCount: number }[];
}> {
  const { departmentId, scopeLabel } = await requireCompanyPanelScope();

  return db.transaction(async (tx) => {
    await assertCompanyPanelSelection(tx, companyId);
    await assertCompanyOfferIntegrity(tx, { companyId, departmentId });

    // Aggregate before considering drives, so repeated drives never multiply offers.
    // No degree filter: both UG and PG enrollments belong to this population.
    const offerCounts = tx
      .select({
        cycleId: placementOffers.cycleId,
        offerCount: count(placementOffers.offerId).as("offer_count"),
      })
      .from(placementOffers)
      .innerJoin(enrollments, eq(enrollments.enrollmentId, placementOffers.enrollmentId))
      .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
      .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
      .innerJoin(studentCycles, and(
        eq(studentCycles.enrollmentId, placementOffers.enrollmentId),
        eq(studentCycles.cycleId, placementOffers.cycleId),
        eq(studentCycles.cohortId, enrollments.cohortId),
      ))
      .where(and(
        eq(placementOffers.companyId, companyId),
        eq(studentCycles.registrationStatus, "REGISTERED"),
        departmentId === null ? undefined : eq(programmes.departmentId, departmentId),
      ))
      .groupBy(placementOffers.cycleId)
      .as("company_history_offer_counts");

    const companyDriveInCycle = tx
      .select({ driveId: drives.driveId })
      .from(drives)
      .where(and(
        eq(drives.companyId, companyId),
        eq(drives.cycleId, placementCycles.cycleId),
      ));

    const rows = await tx
      .select({
        cycleId: placementCycles.cycleId,
        cycleCode: placementCycles.code,
        offerCount: sql<number>`coalesce(${offerCounts.offerCount}, 0)`.mapWith(Number),
      })
      .from(placementCycles)
      .leftJoin(offerCounts, eq(offerCounts.cycleId, placementCycles.cycleId))
      .where(or(exists(companyDriveInCycle), isNotNull(offerCounts.offerCount)))
      .orderBy(asc(placementCycles.code), asc(placementCycles.cycleId));

    return { scopeLabel, rows };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
