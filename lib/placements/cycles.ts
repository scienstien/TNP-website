import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { placementCycles } from "@/db/schema";
import { cycleCodeForBatch, cycleEndsOn, cycleStartsOn } from "./cycle";

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** The placement cycle for a graduating batch (July–June, e.g. "2026-27"), or null if none exists. */
export async function findCycleId(
  connection: Database | Transaction,
  batchYear: number,
): Promise<string | null> {
  const [cycle] = await connection
    .select({ cycleId: placementCycles.cycleId })
    .from(placementCycles)
    .where(eq(placementCycles.code, cycleCodeForBatch(batchYear)));
  return cycle?.cycleId ?? null;
}

/** Same, creating the cycle when it does not exist yet. */
export async function ensureCycleId(tx: Transaction, batchYear: number): Promise<string> {
  const existing = await findCycleId(tx, batchYear);
  if (existing) return existing;
  const [cycle] = await tx
    .insert(placementCycles)
    .values({
      code: cycleCodeForBatch(batchYear),
      startsOn: cycleStartsOn(batchYear),
      endsOn: cycleEndsOn(batchYear),
    })
    .returning({ cycleId: placementCycles.cycleId });
  return cycle.cycleId;
}
