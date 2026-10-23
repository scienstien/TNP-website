import { sql } from "drizzle-orm";
import { companies, drives } from "@/db/schema";

/** All cycles includes every master record; a cycle requires an explicit drive. */
export function directoryCondition(cycleId: string | null) {
  return cycleId === null ? undefined : sql`exists (select 1 from ${drives} where ${drives.companyId} = ${companies.companyId} and ${drives.cycleId} = ${cycleId})`;
}
