import "server-only";
import { and, eq, isNotNull, min } from "drizzle-orm";
import { driveEvents, drives } from "@/db/schema";
import { type Database, type Transaction } from "@/lib/placements/cycles";

/**
 * A company's campus visit is not a company column any more: it is the date of its PPT drive
 * events (db/README.md). The visit date shown in the directory is the earliest dated
 * PPT event of the company's drives in one placement cycle.
 */
export async function visitDatesByCompany(
  connection: Database | Transaction,
  cycleId: string | null,
): Promise<Map<string, string>> {
  if (!cycleId) return new Map();
  const rows = await connection
    .select({ companyId: drives.companyId, visitDate: min(driveEvents.scheduledDate) })
    .from(driveEvents)
    .innerJoin(drives, eq(drives.driveId, driveEvents.driveId))
    .where(and(
      eq(drives.cycleId, cycleId),
      eq(driveEvents.processType, "PPT"),
      isNotNull(driveEvents.scheduledDate),
    ))
    .groupBy(drives.companyId);
  const dates = new Map<string, string>();
  for (const row of rows) if (row.visitDate) dates.set(row.companyId, row.visitDate);
  return dates;
}
