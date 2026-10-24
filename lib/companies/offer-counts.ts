import "server-only";
import { and, count, eq } from "drizzle-orm";
import { cohorts, enrollments, placementOffers, programmes, studentCycles } from "@/db/schema";
import { type Database, type Transaction } from "@/lib/placements/cycles";

/**
 * Final reported offers per company, for one placement cycle or for every cycle. Same population
 * as the company panel's offer aggregates: REGISTERED participation, UG and PG, limited to the
 * authorized department (null reads every department). An offer is unique per enrollment, so the
 * participation join cannot multiply rows.
 */
export async function offerCountsByCompany(
  connection: Database | Transaction,
  cycleId: string | null,
  departmentId: string | null,
): Promise<Map<string, number>> {
  const rows = await connection
    .select({ companyId: placementOffers.companyId, offers: count() })
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
      eq(studentCycles.registrationStatus, "REGISTERED"),
      cycleId === null ? undefined : eq(placementOffers.cycleId, cycleId),
      departmentId === null ? undefined : eq(programmes.departmentId, departmentId),
    ))
    .groupBy(placementOffers.companyId);
  return new Map(rows.map((row) => [row.companyId, row.offers]));
}
