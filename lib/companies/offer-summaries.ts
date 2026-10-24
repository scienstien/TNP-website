import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cohorts, enrollments, placementOffers, programmes, studentCycles } from "@/db/schema";
import { readDriveOptions } from "@/lib/drives/read";
import { requireCompanyPanelScope } from "./panel-scope";
import { assertCompanyOfferIntegrity, assertCompanyPanelSelection } from "./panel-read-guards";
import { isUuid } from "./records";

export interface CompensationSummary {
  knownCount: number; median: number | null; minimum: number | null; maximum: number | null;
}
export interface CompanyRolePackageRow {
  roleId: string | null; driveId: string | null; driveReference: string | null; jobTitle: string | null; domain: string | null;
  offerCount: number; package: CompensationSummary;
}

/** Only aggregates leave the server. All monetary summaries exclude NULL, retaining actual zero. */
export async function getCompanyOfferSummaries(companyId: string, cycleId: string, requestedRoleId: string | null = null) {
  const { departmentId, scopeLabel } = await requireCompanyPanelScope();
  if (!isUuid(companyId) || !isUuid(cycleId)) throw new Error("Choose a valid company and placement cycle.");
  if (requestedRoleId !== null && !isUuid(requestedRoleId)) throw new Error("Choose a valid role.");
  return db.transaction(async tx => {
    await assertCompanyPanelSelection(tx, companyId, cycleId);
    await assertCompanyOfferIntegrity(tx, { companyId, cycleId, departmentId });
    const options = await readDriveOptions(tx, { companyId, cycleId });
    const selectedRoleId = options.some(drive => drive.roles.some(role => role.roleId === requestedRoleId?.toLowerCase())) ? requestedRoleId!.toLowerCase() : null;
    const population = and(eq(placementOffers.companyId, companyId), eq(placementOffers.cycleId, cycleId),
      eq(studentCycles.registrationStatus, "REGISTERED"),
      departmentId === null ? undefined : eq(programmes.departmentId, departmentId));
    const participation = and(eq(studentCycles.enrollmentId, placementOffers.enrollmentId),
      eq(studentCycles.cycleId, placementOffers.cycleId), eq(studentCycles.cohortId, enrollments.cohortId));
    const amount = (column: typeof placementOffers.packageLpa) => ({
      knownCount: count(column),
      median: sql<string | null>`percentile_cont(0.5) within group (order by ${column}::double precision)`,
      minimum: sql<string | null>`min(${column})`,
      maximum: sql<string | null>`max(${column})`,
    });
    const grouped = await tx.select({ roleId: placementOffers.roleId, offerCount: count(), package: amount(placementOffers.packageLpa) })
      .from(placementOffers).innerJoin(enrollments, eq(enrollments.enrollmentId, placementOffers.enrollmentId))
      .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
      .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
      .innerJoin(studentCycles, participation).where(population).groupBy(placementOffers.roleId);
    const types = await tx.select({ type: placementOffers.offerType, count: count() }).from(placementOffers)
      .innerJoin(enrollments, eq(enrollments.enrollmentId, placementOffers.enrollmentId))
      .innerJoin(cohorts, eq(cohorts.cohortId, enrollments.cohortId))
      .innerJoin(programmes, eq(programmes.programmeId, cohorts.programmeId))
      .innerJoin(studentCycles, participation).where(and(population, selectedRoleId === null ? undefined : eq(placementOffers.roleId, selectedRoleId))).groupBy(placementOffers.offerType);
    const empty: CompensationSummary = { knownCount: 0, median: null, minimum: null, maximum: null };
    const numeric = (summary: { knownCount: number; median: string | null; minimum: string | null; maximum: string | null }): CompensationSummary => ({
      knownCount: summary.knownCount, median: summary.median === null ? null : Number(summary.median),
      minimum: summary.minimum === null ? null : Number(summary.minimum), maximum: summary.maximum === null ? null : Number(summary.maximum),
    });
    const metadata = options.flatMap(drive => drive.roles.map(role => ({
      roleId: role.roleId as string | null, driveId: drive.driveId as string | null, driveReference: drive.reference, jobTitle: role.jobTitle, domain: role.domain,
    })));
    metadata.push({ roleId: null, driveId: null, driveReference: null, jobTitle: null, domain: null });
    const rows: CompanyRolePackageRow[] = metadata.map(role => {
      const summary = grouped.find(row => row.roleId === role.roleId);
      return { ...role, offerCount: summary?.offerCount ?? 0, package: summary ? numeric(summary.package) : empty };
    });
    const totalOffers = grouped.reduce((sum, row) => sum + row.offerCount, 0);
    const typeTotal = grouped.filter(row => selectedRoleId === null || row.roleId === selectedRoleId).reduce((sum, row) => sum + row.offerCount, 0);
    if (types.reduce((sum, row) => sum + row.count, 0) !== typeTotal)
      throw new Error("These figures don't add up; please refresh or report this.");
    return { scopeLabel, rows, totalOffers, typeTotal, selectedRoleId, types: types.map(row => ({ key: row.type ?? "missing", label: row.type ?? "Not recorded", count: row.count })) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
