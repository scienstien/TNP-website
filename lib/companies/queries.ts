import "server-only";

import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { companies, placementCycles } from "@/db/schema";
import { requireRole, resolveDepartment } from "@/lib/auth/dal";
import { directoryCondition } from "./directory-condition";
import { companyRecord, isUuid } from "./records";
import { visitDatesByCompany } from "./visit";
import type { CompanyRecord } from "./types";

export async function getCompanyCycles(): Promise<{ cycleId: string; code: string }[]> {
  await requireRole("ADMIN");
  return db.select({ cycleId: placementCycles.cycleId, code: placementCycles.code }).from(placementCycles).orderBy(desc(placementCycles.code));
}

/**
 * With a cycle: companies with drives in it, OR same-cycle offers to UG enrollments in
 * the caller's department (all departments for all-scope), OR no offers anywhere.
 * Without a cycle: global contacts only, with no cycle-specific projection. No batch filter.
 */
export async function getCompanies(cycleId: string | null): Promise<CompanyRecord[]> {
  const user = await requireRole("ADMIN");
  const department = await resolveDepartment(user);
  if (cycleId !== null && !isUuid(cycleId)) return [];
  if (cycleId !== null && !(await getCompanyCycles()).some(cycle => cycle.cycleId === cycleId)) return [];
  const rows = await db.select().from(companies).where(directoryCondition(cycleId, department?.departmentId ?? null)).orderBy(asc(companies.name));
  const visits = await visitDatesByCompany(db, cycleId);
  return rows.map(row => companyRecord(row, visits.get(row.companyId) ?? null));
}
