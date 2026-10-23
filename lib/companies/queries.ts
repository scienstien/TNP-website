import "server-only";

import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { companies, placementCycles } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { requireCompanyPanelScope } from "./panel-scope";
import { directoryCondition } from "./directory-condition";
import { companyRecord, isUuid } from "./records";
import { visitDatesByCompany } from "./visit";
import type { CompanyRecord } from "./types";

export async function getCompanyCycles(): Promise<{ cycleId: string; code: string }[]> {
  await requireRole("ADMIN");
  return db.select({ cycleId: placementCycles.cycleId, code: placementCycles.code }).from(placementCycles).orderBy(desc(placementCycles.code));
}

/**
 * Cycle mode requires an explicit retained drive, including companies with zero offers.
 * All cycles lists every master record, including prospective companies.
 */
export async function getCompanies(cycleId: string | null): Promise<CompanyRecord[]> {
  await requireCompanyPanelScope();
  if (cycleId !== null && !isUuid(cycleId)) return [];
  if (cycleId !== null && !(await getCompanyCycles()).some(cycle => cycle.cycleId === cycleId)) return [];
  const rows = await db.select().from(companies).where(directoryCondition(cycleId)).orderBy(asc(companies.name));
  const visits = await visitDatesByCompany(db, cycleId);
  return rows.map(row => companyRecord(row, visits.get(row.companyId) ?? null));
}
