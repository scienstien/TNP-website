import "server-only";
import { and, eq, isNotNull, min } from "drizzle-orm";
import { driveEvents, drives } from "@/db/schema";
import { ensureCycleId, type Database, type Transaction } from "@/lib/placements/cycles";

/**
 * A company's campus visit is not a company column any more: it is the date of its PPT drive
 * events (db/README.md). The visit date shown and edited in the directory is the earliest dated
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

/**
 * Sets (or, with null, clears) the company's visit date for a batch's cycle: every PPT event of
 * the company's drives in that cycle is moved to the date. A company with no drive that cycle
 * gets one, with a whole-drive PPT event, when a date is set.
 */
export async function setVisitDate(
  tx: Transaction,
  companyId: string,
  batchYear: number,
  visitDate: string | null,
): Promise<void> {
  const cycleId = await ensureCycleId(tx, batchYear);
  const events = await tx
    .select({ eventId: driveEvents.eventId })
    .from(driveEvents)
    .innerJoin(drives, eq(drives.driveId, driveEvents.driveId))
    .where(and(
      eq(drives.companyId, companyId),
      eq(drives.cycleId, cycleId),
      eq(driveEvents.processType, "PPT"),
    ));
  for (const { eventId } of events) {
    await tx.update(driveEvents).set({ scheduledDate: visitDate }).where(eq(driveEvents.eventId, eventId));
  }
  if (events.length > 0 || visitDate === null) return;

  let [drive] = await tx
    .select({ driveId: drives.driveId })
    .from(drives)
    .where(and(eq(drives.companyId, companyId), eq(drives.cycleId, cycleId)))
    .limit(1);
  if (!drive) [drive] = await tx.insert(drives).values({ companyId, cycleId }).returning({ driveId: drives.driveId });
  await tx.insert(driveEvents).values({
    driveId: drive.driveId,
    processType: "PPT",
    scheduledDate: visitDate,
    scope: "WHOLE_DRIVE",
  });
}
