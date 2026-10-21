import "server-only";

import { asc, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireRole, resolveDepartment } from "@/lib/auth/dal";
import { findCycleId } from "@/lib/placements/cycles";
import { pvrStatusFromDatabase } from "./validation";
import { visitDatesByCompany } from "./visit";
import type { CompanyRecord } from "./types";

/**
 * The department's company directory: companies that made an offer to the department's
 * undergraduate batch, companies with a drive in that batch's placement cycle, and companies with
 * no offers anywhere. Companies tied only to other batches stay hidden. Contact details are
 * global company fields; the visit date is the earliest PPT event in the batch's cycle.
 * Returns an empty list when a super admin has not chosen a department.
 */
export async function getCompanies(batchYear: number): Promise<CompanyRecord[]> {
  const user = await requireRole("ADMIN");
  const department = await resolveDepartment(user);
  if (!department) return [];
  const departmentId = department.departmentId;
  const companyId = companies.companyId;
  const cycleId = await findCycleId(db, batchYear);

  const rows = await db
    .select()
    .from(companies)
    .where(
      or(
        sql`exists (
          select 1 from placement_offers o
          join enrollments e on e.enrollment_id = o.enrollment_id
          join cohorts c on c.cohort_id = e.cohort_id
          join programmes p on p.programme_id = c.programme_id
          where o.company_id = ${companyId} and p.department_id = ${departmentId}
            and c.graduation_year = ${batchYear})`,
        cycleId
          ? sql`exists (select 1 from drives d where d.company_id = ${companyId} and d.cycle_id = ${cycleId})`
          : undefined,
        sql`not exists (select 1 from placement_offers o where o.company_id = ${companyId})`,
      ),
    )
    .orderBy(asc(companies.name));
  const visits = await visitDatesByCompany(db, cycleId);
  return rows.map((row) => ({
    name: row.name,
    domain: row.domain,
    hrName: row.hrName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    remarks: row.remarks,
    pvrStatus: pvrStatusFromDatabase(row.pvrStatus),
    visitDate: visits.get(row.companyId) ?? null,
  }));
}
