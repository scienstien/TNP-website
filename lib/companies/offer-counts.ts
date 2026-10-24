import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { cohorts, enrollments, placementOffers, programmes, studentCycles } from "@/db/schema";
import { type Database, type Transaction } from "@/lib/placements/cycles";

export interface CompanyOfferStats {
  /** Final reported offers (one per student). */
  offers: number;
  /** Median of the recorded packages (LPA); null when none is recorded. Missing amounts are excluded. */
  medianLpa: number | null;
}

/**
 * Final reported offers per company, for one placement cycle or for every cycle, with the median
 * recorded package across all of the company's roles. Same population as the company panel's
 * offer aggregates: REGISTERED participation, UG and PG, limited to the authorized department
 * (null reads every department). An offer is unique per enrollment, so the participation join
 * cannot multiply rows.
 */
export async function offerStatsByCompany(
  connection: Database | Transaction,
  cycleId: string | null,
  departmentId: string | null,
): Promise<Map<string, CompanyOfferStats>> {
  const rows = await connection
    .select({
      companyId: placementOffers.companyId,
      offers: count(),
      medianLpa: sql<string | null>`percentile_cont(0.5) within group (order by ${placementOffers.packageLpa}::double precision)`,
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
      eq(studentCycles.registrationStatus, "REGISTERED"),
      cycleId === null ? undefined : eq(placementOffers.cycleId, cycleId),
      departmentId === null ? undefined : eq(programmes.departmentId, departmentId),
    ))
    .groupBy(placementOffers.companyId);
  return new Map(rows.map((row) => [row.companyId, { offers: row.offers, medianLpa: row.medianLpa === null ? null : Number(row.medianLpa) }]));
}
