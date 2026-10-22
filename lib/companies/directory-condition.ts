import { or, sql } from "drizzle-orm";
import { companies } from "@/db/schema";

/** Explicit cycle drives OR same-cycle UG offers in the selected department OR no offers anywhere. */
export function directoryCondition(cycleId: string | null, departmentId: string | null) {
  if (cycleId === null) return undefined;
  return or(
    sql`exists (select 1 from drives d where d.company_id = ${companies.companyId} and d.cycle_id = ${cycleId})`,
    sql`exists (select 1 from placement_offers o
      join enrollments e on e.enrollment_id = o.enrollment_id
      join cohorts c on c.cohort_id = e.cohort_id
      join programmes p on p.programme_id = c.programme_id
      join degrees g on g.degree_id = p.degree_id
      where o.company_id = ${companies.companyId} and o.cycle_id = ${cycleId} and g.level = 'UG'
        ${departmentId === null ? sql`` : sql`and p.department_id = ${departmentId}`})`,
    sql`not exists (select 1 from placement_offers o where o.company_id = ${companies.companyId})`,
  );
}
